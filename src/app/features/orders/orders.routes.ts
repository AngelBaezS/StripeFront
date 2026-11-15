import { Routes } from '@angular/router';

export const orderRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/order-list/order-list-page').then((m) => m.OrderListPage),
  },
];

