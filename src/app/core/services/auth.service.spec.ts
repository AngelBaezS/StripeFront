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
import { authGuard, guestGuard } from '../guards/auth.guard';
import { roleGuard } from '../guards/role.guard';
import { environment } from '@env/environment';

describe('AuthService, Guards & Interceptor (HttpOnly Cookie Security)', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('auth_token', 'legacy_token_should_be_cleared');
    localStorage.setItem('auth_role', 'ADMIN');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'auth/login', children: [] },
          { path: 'products', children: [] },
          { path: 'admin/products', children: [] },
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

  it('should clear legacy localStorage keys, login with withCredentials, and rely on /me without storing JWT locally', () => {
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('auth_role')).toBeNull();

    service.login({ username: 'angel', password: 'Password123!' }).subscribe();

    const loginReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/login`);
    expect(loginReq.request.method).toBe('POST');
    expect(loginReq.request.withCredentials).toBe(true);
    expect(loginReq.request.headers.has('Authorization')).toBe(false);
    loginReq.flush('Autenticación exitosa.', {
      headers: {
        'X-User-Role': 'ADMIN',
        'X-Token-Expires-At': String(Date.now() + 3_600_000),
      },
    });

    const meReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/me`);
    expect(meReq.request.method).toBe('GET');
    expect(meReq.request.withCredentials).toBe(true);
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
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('auth_role')).toBeNull();
  });

  it('should validate existing HttpOnly cookie session on authGuard / guestGuard reload', async () => {
    const authResult$ = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    ) as Observable<boolean | UrlTree>;

    const authPromise = firstValueFrom(authResult$);
    const meReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/me`);
    expect(meReq.request.withCredentials).toBe(true);
    meReq.flush({
      id: 'usr_123',
      username: 'angel',
      email: 'angel@correo.com',
      phone: '5512345678',
      role: 'CLIENT',
    });

    expect(await authPromise).toBe(true);
    expect(service.isAuthenticated()).toBe(true);

    const guestResult = TestBed.runInInjectionContext(() =>
      guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    ) as UrlTree;
    expect(guestResult instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(guestResult)).toBe('/products');
  });

  it('should block guest access in authGuard and allow /auth/login in guestGuard when unauthenticated', async () => {
    const authResult$ = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    ) as Observable<boolean | UrlTree>;

    const authPromise = firstValueFrom(authResult$);
    const meReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/me`);
    meReq.flush(
      { code: 'UNAUTHORIZED', message: 'Token ausente' },
      { status: 401, statusText: 'Unauthorized' }
    );

    const outcome = await authPromise;
    expect(outcome instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(outcome as UrlTree)).toBe('/auth/login');
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should verify role against /me in roleGuard and block CLIENT from ADMIN routes', async () => {
    service.setSessionMetadata('ADMIN');

    const guard = roleGuard('ADMIN');
    const result$ = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    ) as Observable<boolean | UrlTree>;

    expect(isObservable(result$)).toBe(true);
    const resultPromise = firstValueFrom(result$);

    const meReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/me`);
    expect(meReq.request.withCredentials).toBe(true);
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

  it('should clear session and redirect to /auth/login when /me returns 403 in roleGuard', async () => {
    service.setSessionMetadata('ADMIN');

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

  it('should refresh HttpOnly cookie proactively when close to expiration via validateSession', () => {
    service.setSessionMetadata('CLIENT', Date.now() + 60_000, Date.now() - 3_500_000);

    service.validateSession();

    const refreshReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/refresh`);
    expect(refreshReq.request.method).toBe('POST');
    expect(refreshReq.request.withCredentials).toBe(true);
    expect(refreshReq.request.headers.has('Authorization')).toBe(false);
    refreshReq.flush({
      token: null,
      role: 'ADMIN',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      refreshed: true,
    });

    expect(service.currentRole()).toBe('ADMIN');
    expect(service.isAuthenticated()).toBe(true);
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('should call /logout and clear session when validateSession receives 401 from /refresh', () => {
    service.setSessionMetadata('CLIENT', Date.now() - 10_000);

    service.validateSession();

    const refreshReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/refresh`);
    refreshReq.flush(
      { code: 'TOKEN_EXPIRED', message: 'El token JWT ha expirado.', status: 401 },
      { status: 401, statusText: 'Unauthorized' }
    );

    const logoutReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/logout`);
    expect(logoutReq.request.method).toBe('POST');
    expect(logoutReq.request.withCredentials).toBe(true);
    logoutReq.flush({ message: 'Sesión cerrada correctamente.' });

    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('should deduplicate /refresh on concurrent 401 responses and retry requests with withCredentials', async () => {
    const http = TestBed.inject(HttpClient);
    service.setSessionMetadata('CLIENT', Date.now() + 300_000);

    const combinedPromise = firstValueFrom(
      forkJoin([
        http.get<{ ok: boolean }>(`${environment.apiUrl}/api/v1/cart`),
        http.get<{ ok: boolean }>(`${environment.apiUrl}/api/v1/order`),
      ])
    );

    const req1 = httpMock.expectOne(`${environment.apiUrl}/api/v1/cart`);
    const req2 = httpMock.expectOne(`${environment.apiUrl}/api/v1/order`);
    expect(req1.request.withCredentials).toBe(true);
    expect(req2.request.withCredentials).toBe(true);
    expect(req1.request.headers.has('Authorization')).toBe(false);

    req1.flush({ code: 'TOKEN_EXPIRED' }, { status: 401, statusText: 'Unauthorized' });
    req2.flush({ code: 'TOKEN_EXPIRED' }, { status: 401, statusText: 'Unauthorized' });

    const refreshReqs = httpMock.match(`${environment.apiUrl}/api/v1/auth/refresh`);
    expect(refreshReqs.length).toBe(1);
    expect(refreshReqs[0].request.withCredentials).toBe(true);
    refreshReqs[0].flush({
      token: null,
      role: 'CLIENT',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      refreshed: true,
    });

    const retry1 = httpMock.expectOne(`${environment.apiUrl}/api/v1/cart`);
    const retry2 = httpMock.expectOne(`${environment.apiUrl}/api/v1/order`);
    expect(retry1.request.withCredentials).toBe(true);
    expect(retry2.request.withCredentials).toBe(true);

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
    service.setSessionMetadata('CLIENT', Date.now() + 300_000);

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

    const logoutReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/logout`);
    logoutReq.flush({ message: 'Sesión cerrada correctamente.' });

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
    service.setSessionMetadata('ADMIN');

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

  it('should update username via PUT /me/username with withCredentials and sync signals', () => {
    service.setSessionMetadata('CLIENT');

    let capturedUsername = '';
    service.updateUsername('user1_new').subscribe((res) => {
      capturedUsername = res.profile.username;
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/me/username`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({ username: 'user1_new' });

    req.flush({
      token: null,
      profile: {
        id: 'usr_1',
        username: 'user1_new',
        email: 'user1@correo.com',
        phone: '5512345678',
        role: 'CLIENT',
      },
    });

    expect(capturedUsername).toBe('user1_new');
    expect(service.currentUsername()).toBe('user1_new');
    expect(service.currentProfile()?.username).toBe('user1_new');
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('should update password via PUT /me/password with withCredentials', () => {
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
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.body).toEqual({
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword456',
    });

    req.flush({ message: 'Contraseña actualizada correctamente.' });
    expect(responseMessage).toBe('Contraseña actualizada correctamente.');
  });

  it('should clear session and wait for POST /logout before navigating to /auth/login', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    service.setSessionMetadata('CLIENT', Date.now() + 300_000);

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(navigateSpy).not.toHaveBeenCalled();

    const logoutReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/auth/logout`);
    expect(logoutReq.request.method).toBe('POST');
    expect(logoutReq.request.withCredentials).toBe(true);
    logoutReq.flush({ message: 'Sesión cerrada correctamente.' });

    expect(navigateSpy).toHaveBeenCalledWith(['/auth/login']);
  });
});
