import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { Observable, isObservable, firstValueFrom, forkJoin } from 'rxjs';
import { vi } from 'vitest';
import { toast } from '@spartan-ng/brain/sonner';
import { AuthService } from './auth.service';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { roleGuard } from '../guards/role.guard';
import { environment } from '@env/environment';

function createFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe('AuthService & roleGuard (Roles & Security)', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'auth/login', children: [] },
          { path: 'products', children: [] },
        ]),
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    service.stopTokenMonitor();
    httpMock.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should extract role from JWT and /me profile without persisting auth_role in localStorage', () => {
    const fakeToken = createFakeJwt({ sub: 'angel', role: 'ADMIN' });

    service.login({ username: 'angel', password: 'Password123!' }).subscribe((token) => {
      expect(token).toBe(fakeToken);
    });

    const loginReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/login`);
    expect(loginReq.request.method).toBe('POST');
    loginReq.flush(fakeToken, {
      headers: { 'X-User-Role': 'ADMIN' },
    });

    const meReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/me`);
    expect(meReq.request.method).toBe('GET');
    meReq.flush({
      id: 'usr_123',
      username: 'angel',
      email: 'angel@correo.com',
      phone: '5512345678',
      role: 'ADMIN',
    });

    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentRole()).toBe('ADMIN');
    expect(service.isAdmin()).toBe(true);
    expect(service.isClient()).toBe(false);
    expect(service.hasRole('ADMIN')).toBe(true);
    expect(localStorage.getItem('auth_token')).toBe(fakeToken);
    expect(localStorage.getItem('auth_role')).toBeNull();
  });

  it('should ignore tampered auth_role in localStorage and rely on JWT/profile', () => {
    localStorage.setItem('auth_role', 'ADMIN');
    const clientToken = createFakeJwt({ sub: 'cliente1', role: 'CLIENT' });
    service.saveToken(clientToken);

    expect(service.currentRole()).toBe('CLIENT');
    expect(service.isAdmin()).toBe(false);
    expect(service.isClient()).toBe(true);
  });

  it('should verify role against /me in roleGuard and block CLIENT even if localStorage was modified', async () => {
    localStorage.setItem('auth_role', 'ADMIN');
    const clientToken = createFakeJwt({ sub: 'cliente1', role: 'CLIENT' });
    service.saveToken(clientToken);

    const guard = roleGuard('ADMIN');
    const result$ = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    ) as Observable<boolean | UrlTree>;

    expect(isObservable(result$)).toBe(true);
    const resultPromise = firstValueFrom(result$);

    const meReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/me`);
    meReq.flush({
      id: 'usr_456',
      username: 'cliente1',
      email: 'cliente@correo.com',
      phone: '5512345678',
      role: 'CLIENT',
    });

    const outcome = await resultPromise;
    expect(outcome instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(outcome as UrlTree)).toBe('/products');
  });

  it('should logout and redirect to /auth/login when /me returns 403 in roleGuard (tampered JWT)', async () => {
    const forgedToken = createFakeJwt({ sub: 'cliente1', role: 'ADMIN' });
    service.saveToken(forgedToken);

    const guard = roleGuard('ADMIN');
    const result$ = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    ) as Observable<boolean | UrlTree>;

    const resultPromise = firstValueFrom(result$);

    const meReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/me`);
    meReq.flush('Forbidden', { status: 403, statusText: 'Forbidden' });

    const outcome = await resultPromise;
    expect(outcome instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(outcome as UrlTree)).toBe('/auth/login');
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should refresh token proactively when close to expiration via validateSession', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const expiringSoonToken = createFakeJwt({
      sub: 'angel',
      role: 'CLIENT',
      iat: nowSec - 3500,
      exp: nowSec + 60, // quedan 60s (< umbral de 5 min)
    });
    const refreshedToken = createFakeJwt({
      sub: 'angel',
      role: 'ADMIN',
      iat: nowSec,
      exp: nowSec + 3600,
    });

    service.saveToken(expiringSoonToken);
    expect(service.shouldRefreshToken()).toBe(true);

    service.validateSession();

    const refreshReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/refresh`);
    expect(refreshReq.request.method).toBe('POST');
    expect(refreshReq.request.headers.get('Authorization')).toBe(`Bearer ${expiringSoonToken}`);
    refreshReq.flush({
      token: refreshedToken,
      role: 'ADMIN',
      expiresAt: new Date((nowSec + 3600) * 1000).toISOString(),
      refreshed: true,
    });

    expect(service.getToken()).toBe(refreshedToken);
    expect(service.currentRole()).toBe('ADMIN');
    expect(localStorage.getItem('auth_token')).toBe(refreshedToken);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('should logout when validateSession receives 401 from /refresh for an expired token', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const expiredToken = createFakeJwt({
      sub: 'angel',
      role: 'CLIENT',
      iat: nowSec - 3600,
      exp: nowSec - 10,
    });
    service.saveToken(expiredToken);

    service.validateSession();

    const refreshReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/refresh`);
    refreshReq.flush(
      { code: 'TOKEN_EXPIRED', message: 'El token JWT ha expirado.', status: 401 },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('should deduplicate /refresh on concurrent 401 responses and retry requests via authInterceptor', async () => {
    const http = TestBed.inject(HttpClient);
    const nowSec = Math.floor(Date.now() / 1000);
    const oldToken = createFakeJwt({ sub: 'angel', role: 'CLIENT', iat: nowSec - 100, exp: nowSec + 300 });
    const newToken = createFakeJwt({ sub: 'angel', role: 'CLIENT', iat: nowSec, exp: nowSec + 3600 });
    service.saveToken(oldToken);

    const combinedPromise = firstValueFrom(
      forkJoin([
        http.get<{ ok: boolean }>(`${environment.apiUrl}/api/v1/cart`),
        http.get<{ ok: boolean }>(`${environment.apiUrl}/api/v1/order`),
      ])
    );

    const req1 = httpMock.expectOne(`${environment.apiUrl}/api/v1/cart`);
    const req2 = httpMock.expectOne(`${environment.apiUrl}/api/v1/order`);
    expect(req1.request.headers.get('Authorization')).toBe(`Bearer ${oldToken}`);
    expect(req2.request.headers.get('Authorization')).toBe(`Bearer ${oldToken}`);

    req1.flush({ code: 'TOKEN_EXPIRED' }, { status: 401, statusText: 'Unauthorized' });
    req2.flush({ code: 'TOKEN_EXPIRED' }, { status: 401, statusText: 'Unauthorized' });

    const refreshReqs = httpMock.match(`${environment.apiUrl}/api/v1/auth/refresh`);
    expect(refreshReqs.length).toBe(1);
    refreshReqs[0].flush({
      token: newToken,
      role: 'CLIENT',
      expiresAt: new Date((nowSec + 3600) * 1000).toISOString(),
      refreshed: true,
    });

    const retry1 = httpMock.expectOne(`${environment.apiUrl}/api/v1/cart`);
    const retry2 = httpMock.expectOne(`${environment.apiUrl}/api/v1/order`);
    expect(retry1.request.headers.get('Authorization')).toBe(`Bearer ${newToken}`);
    expect(retry2.request.headers.get('Authorization')).toBe(`Bearer ${newToken}`);

    retry1.flush({ ok: true });
    retry2.flush({ ok: true });

    const [res1, res2] = await combinedPromise;
    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
  });

  it('should logout silently and redirect to login when authInterceptor fails to refresh on 401', async () => {
    const http = TestBed.inject(HttpClient);
    const navigateSpy = vi.spyOn(router, 'navigate');
    const toastErrorSpy = vi.spyOn(toast, 'error');
    const toastWarningSpy = vi.spyOn(toast, 'warning');
    const oldToken = createFakeJwt({ sub: 'angel', role: 'CLIENT' });
    service.saveToken(oldToken);

    let completedWithoutError = false;
    let receivedError = false;

    http.get(`${environment.apiUrl}/api/v1/cart`).subscribe({
      error: () => {
        receivedError = true;
      },
      complete: () => {
        completedWithoutError = true;
      },
    });

    const cartReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/cart`);
    cartReq.flush({ code: 'TOKEN_EXPIRED' }, { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/refresh`);
    refreshReq.flush({ code: 'TOKEN_EXPIRED' }, { status: 401, statusText: 'Unauthorized' });

    await Promise.resolve();

    expect(receivedError).toBe(false);
    expect(completedWithoutError).toBe(true);
    expect(toastErrorSpy).not.toHaveBeenCalled();
    expect(toastWarningSpy).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/auth/login']);
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('should resolve default route by role and redirect ADMIN away from /products in roleGuard', async () => {
    const adminToken = createFakeJwt({ sub: 'admin1', role: 'ADMIN' });
    service.saveToken(adminToken);

    expect(service.getDefaultRoute()).toBe('/admin/products');
    expect(service.getDefaultRoute('CLIENT')).toBe('/products');

    const guard = roleGuard('CLIENT');
    const result$ = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    ) as Observable<boolean | UrlTree>;

    const resultPromise = firstValueFrom(result$);

    const meReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/me`);
    meReq.flush({
      id: 'usr_admin',
      username: 'admin1',
      email: 'admin@correo.com',
      phone: '5512345678',
      role: 'ADMIN',
    });

    const outcome = await resultPromise;
    expect(outcome instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(outcome as UrlTree)).toBe('/admin/products');
  });

  it('should update username via PUT /me/username, save refreshed token, and sync signals', () => {
    const initialToken = createFakeJwt({ sub: 'user1', role: 'CLIENT' });
    const nextToken = createFakeJwt({ sub: 'user1_new', role: 'CLIENT' });
    service.saveToken(initialToken);

    let capturedUsername = '';
    service.updateUsername('user1_new').subscribe((res) => {
      capturedUsername = res.profile.username;
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/me/username`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ username: 'user1_new' });

    req.flush({
      token: nextToken,
      profile: {
        id: 'usr_1',
        username: 'user1_new',
        email: 'user1@correo.com',
        phone: '5512345678',
        role: 'CLIENT',
      },
    });

    expect(capturedUsername).toBe('user1_new');
    expect(service.getToken()).toBe(nextToken);
    expect(service.currentUsername()).toBe('user1_new');
    expect(service.currentProfile()?.username).toBe('user1_new');
  });

  it('should update password via PUT /me/password', () => {
    let responseMessage = '';
    service
      .updatePassword({
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword456',
      })
      .subscribe((res) => {
        responseMessage = res.message;
      });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/me/password`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword456',
    });

    req.flush({ message: 'Contraseña actualizada correctamente.' });
    expect(responseMessage).toBe('Contraseña actualizada correctamente.');
  });
});
