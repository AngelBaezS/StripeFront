import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  {
    path: 'products',
    loadComponent: () =>
      import('./pages/product-list/admin-product-list').then((m) => m.AdminProductList),
  },
  {
    path: 'products/new',
    loadComponent: () =>
      import('./pages/product-create/product-create').then((m) => m.ProductCreate),
  },
  {
    path: 'products/:id/price',
    loadComponent: () =>
      import('./pages/product-edit/admin-product-edit').then((m) => m.AdminProductEdit),
  },
  {
    path: '',
    redirectTo: 'products',
    pathMatch: 'full',
  },
];
