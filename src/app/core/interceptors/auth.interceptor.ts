import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { EMPTY, catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  const isPublicAuthRequest =
    req.url.endsWith('/auth/login') || req.url.endsWith('/auth/register');
  const isRefreshRequest = req.url.endsWith('/auth/refresh');
  const isLogoutRequest = req.url.endsWith('/auth/logout');
  const isProfileCheckRequest = req.url.endsWith('/auth/me');

  // Todas las peticiones viajan con credenciales para enviar/recibir la cookie HttpOnly automáticamente
  const requestToSend = req.clone({
    withCredentials: true,
  });

  return next(requestToSend).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !isPublicAuthRequest &&
        !isRefreshRequest &&
        !isLogoutRequest
      ) {
        const errorCode =
          typeof error.error === 'object' && error.error !== null
            ? (error.error as { code?: unknown }).code
            : null;
        const isTokenExpiredError = errorCode === 'TOKEN_EXPIRED';

        if (!authService.isAuthenticated() && !isTokenExpiredError) {
          authService.clearLocalSessionState();
          return isProfileCheckRequest ? throwError(() => error) : EMPTY;
        }

        return authService.refreshToken().pipe(
          switchMap(() =>
            next(
              req.clone({
                withCredentials: true,
              })
            )
          ),
          catchError((refreshError: unknown) => {
            if (
              refreshError instanceof HttpErrorResponse &&
              (refreshError.status === 401 || refreshError.status === 403)
            ) {
              authService.handleSessionExpired();
              return isProfileCheckRequest ? throwError(() => refreshError) : EMPTY;
            }
            return throwError(() => refreshError);
          })
        );
      }

      return throwError(() => error);
    })
  );
};
