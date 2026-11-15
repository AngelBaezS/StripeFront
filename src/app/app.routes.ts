import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '@core/guards/auth.guard';
import { roleGuard } from '@core/guards/role.guard';
import { AuthService } from '@core/services/auth.service';
import { MainLayout } from '@layout/main-layout/main-layout';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () => import('@features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      {
        path: 'products',
        canActivate: [roleGuard('CLIENT')],
        loadChildren: () =>
          import('@features/products/products.routes').then((m) => m.productRoutes),
      },
      {
        path: 'cart',
        canActivate: [roleGuard('CLIENT')],
        loadChildren: () =>
          import('@features/cart/cart.routes').then((m) => m.cartRoutes),
      },
      {
        path: 'orders',
        canActivate: [roleGuard('CLIENT')],
        loadChildren: () =>
          import('@features/orders/orders.routes').then((m) => m.orderRoutes),
      },
      {
        path: 'admin',
        canActivate: [roleGuard('ADMIN')],
        loadChildren: () =>
          import('@features/admin/admin.routes').then((m) => m.adminRoutes),
      },
      {
        path: 'profile',
        canActivate: [roleGuard('CLIENT', 'ADMIN')],
        loadComponent: () =>
          import('@features/profile/pages/profile-page/profile-page').then(
            (m) => m.ProfilePage
          ),
      },
      {
        path: '',
        redirectTo: () => inject(AuthService).getDefaultRoute(),
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '**',
    redirectTo: () => inject(AuthService).getDefaultRoute(),
  },
];
