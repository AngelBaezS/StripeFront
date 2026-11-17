import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { UserRole } from '@core/models/auth.model';
import { AuthService } from '@core/services/auth.service';
import { toast } from '@spartan-ng/brain/sonner';

export const roleGuard = (...allowedRoles: UserRole[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Valida siempre la sesión y el rol real en el servidor (/api/v1/auth/me) usando la cookie HttpOnly
    return authService.getProfile().pipe(
      map((profile) => {
        if (profile?.role && allowedRoles.includes(profile.role)) {
          return true;
        }
        toast.error('No tienes permisos para acceder a esta sección.');
        return router.createUrlTree([authService.getDefaultRoute(profile?.role ?? null)]);
      }),
      catchError((err) => {
        if (err?.status === 401 || err?.status === 403) {
          authService.logout(false);
          return of(router.createUrlTree(['/auth/login']));
        }
        toast.error('No se pudo verificar tu rol de acceso.');
        return of(router.createUrlTree([authService.getDefaultRoute()]));
      })
    );
  };
};
