import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '@core/services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return authService
    .ensureSession()
    .pipe(
      map((authenticated) =>
        authenticated ? true : router.createUrlTree(['/auth/login'])
      )
    );
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return router.createUrlTree([authService.getDefaultRoute()]);
  }

  return authService
    .ensureSession()
    .pipe(
      map((authenticated) =>
        authenticated
          ? router.createUrlTree([authService.getDefaultRoute()])
          : true
      )
    );
};
