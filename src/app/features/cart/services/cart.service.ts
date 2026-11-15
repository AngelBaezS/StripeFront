import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, tap } from 'rxjs';
import { environment } from '@env/environment';
import { AddCartItemRequest, CartDetail, CartItemDetail } from '@shared/models/cart.model';
import { toast } from '@spartan-ng/brain/sonner';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/v1/cart`;

  private readonly _cart = signal<CartDetail | null>(null);
  private readonly _isLoading = signal<boolean>(false);

  public readonly cart = this._cart.asReadonly();
  public readonly isLoading = this._isLoading.asReadonly();

  public readonly items = computed<CartItemDetail[]>(() => this._cart()?.items ?? []);

  public readonly totalItems = computed(() =>
    this.items().reduce((total, item) => total + item.quantity, 0)
  );

  public readonly totalAmountCents = computed(() => this._cart()?.totalAmountCents ?? 0);

  public getCart(): Observable<CartDetail> {
    this._isLoading.set(true);
    return this.http.get<CartDetail>(this.apiUrl).pipe(
      tap({
        next: (cartDetail) => {
          this._cart.set(cartDetail);
          this._isLoading.set(false);
        },
        error: () => {
          this._isLoading.set(false);
        },
      })
    );
  }

  public addItem(productId: string, quantity = 1, productName?: string): Observable<CartDetail> {
    const body: AddCartItemRequest = { productId, quantity };
    return this.http.post<CartDetail>(`${this.apiUrl}/items`, body).pipe(
      tap({
        next: (updatedCart) => {
          this._cart.set(updatedCart);
          const label = productName ? `"${productName}"` : 'Producto';
          toast.success(`${label} agregado al carrito`);
        },
        error: (err) => {
          const msg =
            err?.error?.message ||
            err?.error ||
            'No se pudo agregar el producto al carrito (verifica el stock disponible).';
          toast.error(typeof msg === 'string' ? msg : 'Error al agregar al carrito');
        },
      })
    );
  }

  public removeItem(itemOrProductId: string): Observable<CartDetail> {
    return this.http.delete<CartDetail>(`${this.apiUrl}/items/${itemOrProductId}`).pipe(
      tap({
        next: (updatedCart) => {
          this._cart.set(updatedCart);
          toast.info('Producto eliminado del carrito');
        },
        error: () => {
          toast.error('No se pudo eliminar el producto del carrito');
        },
      })
    );
  }

  public decrementItem(item: CartItemDetail): Observable<CartDetail> {
    if (item.quantity <= 1) {
      return this.removeItem(item.id);
    }

    const previousOrder = this.items().map((i) => i.productId);
    const body: AddCartItemRequest = {
      productId: item.productId,
      quantity: item.quantity - 1,
    };

    return this.http.delete<CartDetail>(`${this.apiUrl}/items/${item.id}`).pipe(
      switchMap(() => this.http.post<CartDetail>(`${this.apiUrl}/items`, body)),
      tap({
        next: (updatedCart) => {
          const orderedItems = [...updatedCart.items].sort((a, b) => {
            const idxA = previousOrder.indexOf(a.productId);
            const idxB = previousOrder.indexOf(b.productId);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          });
          this._cart.set({ ...updatedCart, items: orderedItems });
          toast.info(`Cantidad de "${item.productName}" actualizada`);
        },
        error: (err) => {
          const msg =
            err?.error?.message ||
            err?.error ||
            'No se pudo reducir la cantidad del producto.';
          toast.error(typeof msg === 'string' ? msg : 'Error al actualizar el carrito');
          this.getCart().subscribe({ error: () => {} });
        },
      })
    );
  }

  public clearCart(): Observable<void> {
    return this.http.delete<void>(this.apiUrl).pipe(
      tap({
        next: () => {
          const current = this._cart();
          if (current) {
            this._cart.set({
              ...current,
              items: [],
              totalAmountCents: 0,
            });
          } else {
            this._cart.set(null);
          }
          toast.info('Se ha vaciado el carrito de compras');
        },
        error: () => {
          toast.error('No se pudo vaciar el carrito');
        },
      })
    );
  }

  public resetLocalState(): void {
    this._cart.set(null);
  }
}
