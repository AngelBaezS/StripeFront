import { Routes } from '@angular/router';

export const cartRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/cart-page/cart-page').then((m) => m.CartPage),
  },
  {
    path: 'checkout',
    loadComponent: () =>
      import('./pages/checkout-page/checkout-page').then((m) => m.CheckoutPage),
  },
  {
    path: 'resultado',
    loadComponent: () =>
      import('./pages/payment-status-page/payment-status-page').then(
        (m) => m.PaymentStatusPage
      ),
  },
];
