import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { EMPTY, catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  const isPublicAuthRequest =
    req.url.endsWith('/auth/login') || req.url.endsWith('/auth/register');
  const isRefreshRequest = req.url.endsWith('/auth/refresh');
  const isProfileCheckRequest = req.url.endsWith('/auth/me');

  const requestToSend =
    token && !isPublicAuthRequest
      ? req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        })
      : req;

  return next(requestToSend).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !isPublicAuthRequest &&
        !isRefreshRequest
      ) {
        if (!authService.getToken()) {
          authService.logout();
          return isProfileCheckRequest ? throwError(() => error) : EMPTY;
        }

        return authService.refreshToken().pipe(
          switchMap((newToken) =>
            next(
              req.clone({
                setHeaders: {
                  Authorization: `Bearer ${newToken}`,
                },
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
