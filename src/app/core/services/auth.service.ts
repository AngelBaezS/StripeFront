import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  Observable,
  Subscription,
  catchError,
  filter,
  finalize,
  fromEvent,
  interval,
  map,
  merge,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { environment } from '@env/environment';
import {
  LoginRequest,
  MessageResponse,
  RefreshTokenResponse,
  RegisterRequest,
  UpdatePasswordRequest,
  UpdateUsernameResponse,
  UserProfileResponse,
  UserRole,
} from '@core/models/auth.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = `${environment.apiUrl}/api/v1/auth`;
  private readonly TOKEN_KEY = 'auth_token';
  private readonly CHECK_INTERVAL_MS = 60_000;
  private readonly MAX_REFRESH_THRESHOLD_MS = 5 * 60_000;

  private readonly _token = signal<string | null>(this.getStoredItem(this.TOKEN_KEY));
  private readonly _role = signal<UserRole | null>(null);
  private readonly _profile = signal<UserProfileResponse | null>(null);

  private refreshInFlight$: Observable<string> | null = null;
  private monitorSubscription: Subscription | null = null;
  private isHandlingExpiration = false;

  public readonly isAuthenticated = computed(() => !!this._token());
  public readonly currentProfile = this._profile.asReadonly();

  public readonly currentRole = computed<UserRole | null>(() => {
    const token = this._token();
    if (!token) return null;

    const profileRole = this.normalizeRole(this._profile()?.role);
    if (profileRole) return profileRole;

    const payload = this.decodeJwtPayload(token);
    const jwtRole = this.normalizeRole(payload?.['role']);
    if (jwtRole) return jwtRole;

    return this._role();
  });

  public readonly isAdmin = computed(() => this.currentRole() === 'ADMIN');
  public readonly isClient = computed(() => this.currentRole() === 'CLIENT');

  public readonly currentUsername = computed(() => {
    const profileUsername = this._profile()?.username;
    if (profileUsername) return profileUsername;

    const payload = this.decodeJwtPayload(this._token());
    const sub = payload?.['sub'] ?? payload?.['username'] ?? payload?.['name'];
    return typeof sub === 'string' && sub.length > 0 ? sub : 'Usuario';
  });

  public ngOnDestroy(): void {
    this.stopTokenMonitor();
  }

  public login(credentials: LoginRequest): Observable<string> {
    return this.http
      .post(`${this.apiUrl}/login`, credentials, {
        responseType: 'text',
        observe: 'response',
      })
      .pipe(
        map((response) => {
          const rawResponse = response.body ?? '';
          let token = rawResponse.trim();

          try {
            const parsed = JSON.parse(rawResponse);
            if (parsed && typeof parsed === 'object') {
              token = parsed.token || parsed.jwt || parsed.accessToken || token;
            }
          } catch {
            // La respuesta ya es el token en texto plano
          }

          if (token.startsWith('"') && token.endsWith('"')) {
            token = token.slice(1, -1);
          }

          const headerRole = this.normalizeRole(response.headers.get('X-User-Role'));

          if (token) {
            this.saveToken(token, headerRole ?? undefined);
          }

          return token;
        }),
        switchMap((token) =>
          token
            ? this.getProfile().pipe(
                map(() => token),
                catchError(() => of(token))
              )
            : of(token)
        )
      );
  }

  public register(userData: RegisterRequest): Observable<string> {
    return this.http.post(`${this.apiUrl}/register`, userData, { responseType: 'text' });
  }

  public getProfile(): Observable<UserProfileResponse> {
    return this.http.get<UserProfileResponse>(`${this.apiUrl}/me`).pipe(
      tap((profile) => {
        this._profile.set(profile);
        const normalized = this.normalizeRole(profile?.role);
        if (normalized) {
          this.saveRole(normalized);
        }
      })
    );
  }

  public updateUsername(username: string): Observable<UpdateUsernameResponse> {
    return this.http
      .put<UpdateUsernameResponse>(`${this.apiUrl}/me/username`, { username })
      .pipe(
        tap((response) => {
          const normalizedRole = this.normalizeRole(response.profile?.role);
          if (response.token) {
            this.saveToken(response.token, normalizedRole ?? undefined);
          }
          if (response.profile) {
            this._profile.set(response.profile);
          }
        })
      );
  }

  public updatePassword(payload: UpdatePasswordRequest): Observable<MessageResponse> {
    return this.http.put<MessageResponse>(`${this.apiUrl}/me/password`, payload);
  }

  public refreshToken(): Observable<string> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    const currentToken = this._token();
    if (!currentToken) {
      return throwError(() => new Error('No hay token JWT activo para renovar.'));
    }

    this.refreshInFlight$ = this.http
      .post<RefreshTokenResponse>(`${this.apiUrl}/refresh`, {})
      .pipe(
        tap((response) => {
          const normalizedRole = this.normalizeRole(response.role);
          this.saveToken(response.token, normalizedRole ?? undefined);
          const profile = this._profile();
          if (profile && normalizedRole && profile.role !== normalizedRole) {
            this._profile.set({ ...profile, role: normalizedRole });
          }
        }),
        map((response) => response.token),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        shareReplay(1)
      );

    return this.refreshInFlight$;
  }

  public startTokenMonitor(checkIntervalMs = this.CHECK_INTERVAL_MS): void {
    if (typeof window === 'undefined' || this.monitorSubscription) {
      return;
    }

    this.validateSession();

    const visibility$ =
      typeof document !== 'undefined'
        ? fromEvent(document, 'visibilitychange').pipe(
            filter(() => document.visibilityState === 'visible')
          )
        : of();

    this.monitorSubscription = merge(interval(checkIntervalMs), visibility$).subscribe(() => {
      this.validateSession();
    });
  }

  public stopTokenMonitor(): void {
    this.monitorSubscription?.unsubscribe();
    this.monitorSubscription = null;
  }

  public validateSession(): void {
    const token = this._token();
    if (!token) {
      return;
    }

    const payload = this.decodeJwtPayload(token);
    if (!payload) {
      this.handleSessionExpired();
      return;
    }

    const expMs = this.getTokenExpirationMs(token);
    if (expMs === null) {
      return;
    }

    const remainingMs = expMs - Date.now();
    if (remainingMs <= 0 || remainingMs <= this.getRefreshThresholdMs(token)) {
      this.refreshToken().subscribe({
        error: (err) => {
          if (err?.status === 401 || err?.status === 403 || remainingMs <= 0) {
            this.handleSessionExpired();
          }
        },
      });
    }
  }

  public getTokenExpirationMs(token: string | null = this._token()): number | null {
    const payload = this.decodeJwtPayload(token);
    const exp = payload?.['exp'];
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null;
  }

  public getTokenIssuedAtMs(token: string | null = this._token()): number | null {
    const payload = this.decodeJwtPayload(token);
    const iat = payload?.['iat'];
    return typeof iat === 'number' && Number.isFinite(iat) ? iat * 1000 : null;
  }

  public isTokenExpired(token: string | null = this._token()): boolean {
    if (!token) return true;
    const payload = this.decodeJwtPayload(token);
    if (!payload) return true;
    const expMs = this.getTokenExpirationMs(token);
    if (expMs === null) return false;
    return Date.now() >= expMs;
  }

  public shouldRefreshToken(token: string | null = this._token()): boolean {
    if (!token) return false;
    const expMs = this.getTokenExpirationMs(token);
    if (expMs === null) return false;
    return expMs - Date.now() <= this.getRefreshThresholdMs(token);
  }

  public handleSessionExpired(): void {
    if (!this._token() || this.isHandlingExpiration) {
      return;
    }

    this.isHandlingExpiration = true;
    try {
      this.logout();
    } finally {
      this.isHandlingExpiration = false;
    }
  }

  public hasRole(required: UserRole | UserRole[]): boolean {
    const role = this.currentRole();
    if (!role) return false;
    const allowed = Array.isArray(required) ? required : [required];
    return allowed.includes(role);
  }

  public getDefaultRoute(role: UserRole | null = this.currentRole()): string {
    return role === 'ADMIN' ? '/admin/products' : '/products';
  }

  public saveToken(token: string, explicitRole?: UserRole): void {
    this.setStoredItem(this.TOKEN_KEY, token);
    this._token.set(token);

    const resolvedRole =
      explicitRole ?? this.normalizeRole(this.decodeJwtPayload(token)?.['role']);
    if (resolvedRole) {
      this.saveRole(resolvedRole);
    }
  }

  public getToken(): string | null {
    return this._token();
  }

  public logout(): void {
    this.refreshInFlight$ = null;
    this.removeStoredItem(this.TOKEN_KEY);
    this.removeStoredItem('auth_role');
    this._token.set(null);
    this._role.set(null);
    this._profile.set(null);
    if (!this.router.url.startsWith('/auth/login')) {
      this.router.navigate(['/auth/login']);
    }
  }

  private getRefreshThresholdMs(token: string | null): number {
    const expMs = this.getTokenExpirationMs(token);
    const iatMs = this.getTokenIssuedAtMs(token);
    if (expMs !== null && iatMs !== null && expMs > iatMs) {
      const lifetimeMs = expMs - iatMs;
      return Math.min(this.MAX_REFRESH_THRESHOLD_MS, Math.floor(lifetimeMs * 0.25));
    }
    return this.MAX_REFRESH_THRESHOLD_MS;
  }

  private saveRole(role: UserRole): void {
    this._role.set(role);
  }

  private normalizeRole(rawRole: unknown): UserRole | null {
    if (typeof rawRole !== 'string') return null;
    const upper = rawRole.trim().toUpperCase().replace(/^ROLE_/, '');
    if (upper === 'ADMIN' || upper === 'CLIENT') {
      return upper;
    }
    return null;
  }

  private decodeJwtPayload(token: string | null): Record<string, unknown> | null {
    if (!token) return null;
    try {
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return null;
      const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      const jsonPayload = decodeURIComponent(
        atob(padded)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private getStoredItem(key: string): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(key);
    }
    return null;
  }

  private setStoredItem(key: string, value: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, value);
    }
  }

  private removeStoredItem(key: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(key);
    }
  }
}
