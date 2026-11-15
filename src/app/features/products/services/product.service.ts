import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  CreateProductRequest,
  Product,
  UpdatePriceRequest,
} from '@shared/models/product.model';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly productsUrl = `${environment.apiUrl}/api/v1/products`;
  private readonly adminProductsUrl = `${environment.apiUrl}/api/v1/admin/products`;

  public getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.productsUrl);
  }

  public getAdminProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.adminProductsUrl);
  }

  public createProduct(product: CreateProductRequest): Observable<Product> {
    return this.http.post<Product>(this.adminProductsUrl, product);
  }

  public updateProductPrice(productId: string, newUnitAmountCents: number): Observable<Product> {
    const body: UpdatePriceRequest = { newUnitAmountCents };
    return this.http.put<Product>(`${this.adminProductsUrl}/${productId}/price`, body);
  }
}
