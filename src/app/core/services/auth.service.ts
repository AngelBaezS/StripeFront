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
  private readonly CHECK_INTERVAL_MS = 60_000;
  private readonly MAX_REFRESH_THRESHOLD_MS = 5 * 60_000;

  // El JWT nunca se almacena en localStorage ni en variables JS accesibles:
  // reside exclusivamente en una cookie HttpOnly + Secure + SameSite=Strict gestionada por el backend.
  private readonly _authenticated = signal<boolean>(false);
  private readonly _role = signal<UserRole | null>(null);
  private readonly _profile = signal<UserProfileResponse | null>(null);
  private readonly _sessionExpiresAtMs = signal<number | null>(null);
  private readonly _sessionIssuedAtMs = signal<number | null>(null);

  private refreshInFlight$: Observable<void> | null = null;
  private ensureSessionInFlight$: Observable<boolean> | null = null;
  private monitorSubscription: Subscription | null = null;
  private isHandlingExpiration = false;

  public readonly isAuthenticated = computed(
    () => this._authenticated() || this._profile() !== null
  );
  public readonly currentProfile = this._profile.asReadonly();

  public readonly currentRole = computed<UserRole | null>(() => {
    const profileRole = this.normalizeRole(this._profile()?.role);
    if (profileRole) return profileRole;
    return this._role();
  });

  public readonly isAdmin = computed(() => this.currentRole() === 'ADMIN');
  public readonly isClient = computed(() => this.currentRole() === 'CLIENT');

  public readonly currentUsername = computed(
    () => this._profile()?.username || 'Usuario'
  );

  constructor() {
    this.clearLegacyStorage();
  }

  public ngOnDestroy(): void {
    this.stopTokenMonitor();
  }

  public login(credentials: LoginRequest): Observable<string> {
    return this.http
      .post(`${this.apiUrl}/login`, credentials, {
        responseType: 'text',
        observe: 'response',
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          this.clearLegacyStorage();
          this._authenticated.set(true);

          const headerRole = this.normalizeRole(response.headers.get('X-User-Role'));
          if (headerRole) {
            this._role.set(headerRole);
          }

          const expiresHeader = response.headers.get('X-Token-Expires-At');
          if (expiresHeader) {
            const parsedExp = Number(expiresHeader);
            if (Number.isFinite(parsedExp) && parsedExp > 0) {
              this._sessionIssuedAtMs.set(Date.now());
              this._sessionExpiresAtMs.set(parsedExp);
            }
          }
        }),
        switchMap((response) =>
          this.getProfile().pipe(
            map(() => response.body ?? 'OK'),
            catchError(() => of(response.body ?? 'OK'))
          )
        )
      );
  }

  public register(userData: RegisterRequest): Observable<string> {
    return this.http.post(`${this.apiUrl}/register`, userData, {
      responseType: 'text',
      withCredentials: true,
    });
  }

  public getProfile(): Observable<UserProfileResponse> {
    return this.http
      .get<UserProfileResponse>(`${this.apiUrl}/me`, {
        withCredentials: true,
      })
      .pipe(
        tap((profile) => {
          this._profile.set(profile);
          this._authenticated.set(true);
          const normalized = this.normalizeRole(profile?.role);
          if (normalized) {
            this._role.set(normalized);
          }
        })
      );
  }

  /**
   * Valida contra el servidor (/me) si existe una cookie HttpOnly de sesión activa.
   */
  public ensureSession(forceServerCheck = false): Observable<boolean> {
    if (!forceServerCheck && this._profile() !== null) {
      return of(true);
    }

    if (this.ensureSessionInFlight$) {
      return this.ensureSessionInFlight$;
    }

    this.ensureSessionInFlight$ = this.getProfile().pipe(
      map(() => true),
      catchError(() => {
        this.clearLocalSessionState();
        return of(false);
      }),
      finalize(() => {
        this.ensureSessionInFlight$ = null;
      }),
      shareReplay(1)
    );

    return this.ensureSessionInFlight$;
  }

  public updateUsername(username: string): Observable<UpdateUsernameResponse> {
    return this.http
      .put<UpdateUsernameResponse>(
        `${this.apiUrl}/me/username`,
        { username },
        { withCredentials: true }
      )
      .pipe(
        tap((response) => {
          const normalizedRole = this.normalizeRole(response.profile?.role);
          if (normalizedRole) {
            this._role.set(normalizedRole);
          }
          if (response.profile) {
            this._profile.set(response.profile);
            this._authenticated.set(true);
          }
        })
      );
  }

  public updatePassword(payload: UpdatePasswordRequest): Observable<MessageResponse> {
    return this.http.put<MessageResponse>(`${this.apiUrl}/me/password`, payload, {
      withCredentials: true,
    });
  }

  public refreshToken(): Observable<void> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    this.refreshInFlight$ = this.http
      .post<RefreshTokenResponse>(
        `${this.apiUrl}/refresh`,
        {},
        { withCredentials: true }
      )
      .pipe(
        tap((response) => {
          this._authenticated.set(true);
          const normalizedRole = this.normalizeRole(response.role);
          if (normalizedRole) {
            this._role.set(normalizedRole);
          }
          const profile = this._profile();
          if (profile && normalizedRole && profile.role !== normalizedRole) {
            this._profile.set({ ...profile, role: normalizedRole });
          }
          const expMs = response.expiresAt ? Date.parse(response.expiresAt) : Number.NaN;
          if (Number.isFinite(expMs)) {
            this._sessionIssuedAtMs.set(Date.now());
            this._sessionExpiresAtMs.set(expMs);
          }
        }),
        map(() => void 0),
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
    if (!this.isAuthenticated()) {
      return;
    }

    const expMs = this._sessionExpiresAtMs();
    if (expMs === null) {
      this.getProfile().subscribe({
        error: (err) => {
          if (err?.status === 401 || err?.status === 403) {
            this.handleSessionExpired();
          }
        },
      });
      return;
    }

    const remainingMs = expMs - Date.now();
    if (remainingMs <= 0 || remainingMs <= this.getRefreshThresholdMs(expMs)) {
      this.refreshToken().subscribe({
        error: (err) => {
          if (err?.status === 401 || err?.status === 403 || remainingMs <= 0) {
            this.handleSessionExpired();
          }
        },
      });
    }
  }

  public handleSessionExpired(): void {
    if (!this.isAuthenticated() || this.isHandlingExpiration) {
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

  public setSessionMetadata(
    role: UserRole,
    expiresAtMs?: number | null,
    issuedAtMs: number = Date.now()
  ): void {
    this._authenticated.set(true);
    this._role.set(role);
    if (typeof expiresAtMs === 'number' && Number.isFinite(expiresAtMs)) {
      this._sessionIssuedAtMs.set(issuedAtMs);
      this._sessionExpiresAtMs.set(expiresAtMs);
    }
  }

  public clearLocalSessionState(): void {
    this.refreshInFlight$ = null;
    this.ensureSessionInFlight$ = null;
    this.clearLegacyStorage();
    this._authenticated.set(false);
    this._role.set(null);
    this._profile.set(null);
    this._sessionExpiresAtMs.set(null);
    this._sessionIssuedAtMs.set(null);
  }

  public logout(notifyServer = true): void {
    this.clearLocalSessionState();
    if (notifyServer) {
      this.http
        .post(`${this.apiUrl}/logout`, {}, { withCredentials: true })
        .pipe(finalize(() => this.navigateToLogin()))
        .subscribe({ error: () => {} });
      return;
    }
    this.navigateToLogin();
  }

  private navigateToLogin(): void {
    if (!this.router.url.startsWith('/auth/login')) {
      this.router.navigate(['/auth/login']);
    }
  }

  private getRefreshThresholdMs(expMs: number): number {
    const iatMs = this._sessionIssuedAtMs();
    if (iatMs !== null && expMs > iatMs) {
      const lifetimeMs = expMs - iatMs;
      return Math.min(this.MAX_REFRESH_THRESHOLD_MS, Math.floor(lifetimeMs * 0.25));
    }
    return this.MAX_REFRESH_THRESHOLD_MS;
  }

  private normalizeRole(rawRole: unknown): UserRole | null {
    if (typeof rawRole !== 'string') return null;
    const upper = rawRole.trim().toUpperCase().replace(/^ROLE_/, '');
    if (upper === 'ADMIN' || upper === 'CLIENT') {
      return upper;
    }
    return null;
  }

  private clearLegacyStorage(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_role');
    }
  }
}
