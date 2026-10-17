import { Routes } from '@angular/router';
import { ListaArticulo } from './articulo/article-list/article-list';
import { DetalleArticulo } from './articulo/article-detail/article-detail';

export const routes: Routes = [
    { path: '', redirectTo: 'list', pathMatch: 'full' },
    { path: 'list', component: ListaArticulo },
    { path: 'detail/:id', component: DetalleArticulo },
    { path: '**', redirectTo: '' },
];
