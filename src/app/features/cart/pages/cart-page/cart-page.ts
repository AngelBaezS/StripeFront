import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartItemDetail } from '@shared/models/cart.model';
import { CartService } from '@features/cart/services/cart.service';
import { CheckoutService } from '@core/services/checkout.service';
import { CartItemComponent } from '@features/cart/components/cart-item/cart-item';
import { CentsToCurrencyPipe } from '@shared/pipes/cents-to-currency.pipe';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideShoppingCart,
  lucideTrash2,
  lucideArrowLeft,
  lucideRefreshCw,
  lucideShoppingBag,
  lucideCreditCard,
  lucideClock,
  lucidePackage,
} from '@ng-icons/lucide';

@Component({
  selector: 'app-cart-page',
  imports: [
    RouterLink,
    CartItemComponent,
    CentsToCurrencyPipe,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmSeparatorImports,
    HlmSkeletonImports,
    HlmEmptyImports,
    HlmAlertImports,
    HlmSpinnerImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideShoppingCart,
      lucideTrash2,
      lucideArrowLeft,
      lucideRefreshCw,
      lucideShoppingBag,
      lucideCreditCard,
      lucideClock,
      lucidePackage,
    }),
  ],
  templateUrl: './cart-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartPage implements OnInit {
  public readonly cartService = inject(CartService);
  private readonly checkoutService = inject(CheckoutService);

  public readonly errorMessage = signal<string | null>(null);
  public readonly processingProductId = signal<string | null>(null);
  public readonly isClearing = signal<boolean>(false);
  public readonly pendingOrdersCount = signal<number>(0);
  public readonly skeletonRows = [1, 2, 3];

  public ngOnInit(): void {
    this.loadCart();
    this.checkPendingOrders();
  }

  public checkPendingOrders(): void {
    this.checkoutService.getUserOrders().subscribe({
      next: (orders) => {
        const pending = orders.filter((o) => o.status === 'PENDING').length;
        this.pendingOrdersCount.set(pending);
      },
      error: () => {},
    });
  }

  public loadCart(): void {
    this.errorMessage.set(null);
    this.cartService.getCart().subscribe({
      error: (err) => {
        const msg =
          err?.error?.message ||
          'No se pudo cargar tu carrito de compras. Verifica tu conexión.';
        this.errorMessage.set(msg);
      },
    });
  }

  public onIncrementItem(item: CartItemDetail): void {
    this.processingProductId.set(item.productId);
    this.cartService.addItem(item.productId, 1, item.productName).subscribe({
      next: () => this.processingProductId.set(null),
      error: () => this.processingProductId.set(null),
    });
  }

  public onDecrementItem(item: CartItemDetail): void {
    this.processingProductId.set(item.productId);
    this.cartService.decrementItem(item).subscribe({
      next: () => this.processingProductId.set(null),
      error: () => this.processingProductId.set(null),
    });
  }

  public onRemoveItem(item: CartItemDetail): void {
    this.processingProductId.set(item.productId);
    this.cartService.removeItem(item.id).subscribe({
      next: () => this.processingProductId.set(null),
      error: () => this.processingProductId.set(null),
    });
  }

  public onClearCart(): void {
    this.isClearing.set(true);
    this.cartService.clearCart().subscribe({
      next: () => this.isClearing.set(false),
      error: () => this.isClearing.set(false),
    });
  }
}

