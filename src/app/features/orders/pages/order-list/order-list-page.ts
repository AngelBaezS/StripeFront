import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CheckoutService } from '@core/services/checkout.service';
import { CartService } from '@features/cart/services/cart.service';
import { OrderDetail } from '@shared/models/order.model';
import { CentsToCurrencyPipe } from '@shared/pipes/cents-to-currency.pipe';
import { CancelOrderDialog } from '@shared/components/cancel-order-dialog/cancel-order-dialog';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePackage,
  lucideCreditCard,
  lucideClock,
  lucideCheckCircle2,
  lucideRefreshCw,
  lucideShoppingCart,
  lucideShoppingBag,
  lucideRepeat,
  lucideCalendar,
  lucideXCircle,
  lucideExternalLink,
  lucideFileDown,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';

export type OrderFilterTab = 'all' | 'paid' | 'pending' | 'canceled';

@Component({
  selector: 'app-order-list-page',
  imports: [
    RouterLink,
    DatePipe,
    CentsToCurrencyPipe,
    CancelOrderDialog,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmAlertImports,
    HlmSkeletonImports,
    HlmEmptyImports,
    HlmTabsImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucidePackage,
      lucideCreditCard,
      lucideClock,
      lucideCheckCircle2,
      lucideRefreshCw,
      lucideShoppingCart,
      lucideShoppingBag,
      lucideRepeat,
      lucideCalendar,
      lucideXCircle,
      lucideExternalLink,
      lucideFileDown,
    }),
  ],
  templateUrl: './order-list-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderListPage implements OnInit {
  private readonly checkoutService = inject(CheckoutService);
  private readonly cartService = inject(CartService);
  private readonly router = inject(Router);

  public readonly orders = signal<OrderDetail[]>([]);
  public readonly isLoading = signal<boolean>(true);
  public readonly errorMessage = signal<string | null>(null);
  public readonly activeTab = signal<OrderFilterTab>('all');
  public readonly isReordering = signal<boolean>(false);
  public readonly downloadingPdfOrderId = signal<string | null>(null);
  public readonly cancelingOrderId = signal<string | null>(null);

  public readonly paidOrders = computed(() =>
    this.orders().filter((o) => o.status === 'PAID')
  );

  public readonly pendingOrders = computed(() =>
    this.orders().filter((o) => o.status === 'PENDING')
  );

  public readonly canceledOrders = computed(() =>
    this.orders().filter((o) => o.status === 'CANCELED')
  );

  public readonly filteredOrders = computed(() => {
    switch (this.activeTab()) {
      case 'paid':
        return this.paidOrders();
      case 'pending':
        return this.pendingOrders();
      case 'canceled':
        return this.canceledOrders();
      default:
        return this.orders();
    }
  });

  public ngOnInit(): void {
    this.loadOrders();
  }

  public setTab(tab: OrderFilterTab): void {
    this.activeTab.set(tab);
  }

  public loadOrders(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.checkoutService.getUserOrders().subscribe({
      next: (orders) => {
        this.orders.set(this.sortOrdersByDateDesc(orders ?? []));
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err?.error?.message || 'No se pudieron cargar tus pedidos. Por favor, reintenta.'
        );
      },
    });
  }

  private sortOrdersByDateDesc(orders: OrderDetail[]): OrderDetail[] {
    return [...orders].sort((a, b) => {
      const timeA = a.createdAt ? Date.parse(a.createdAt) : Number.NaN;
      const timeB = b.createdAt ? Date.parse(b.createdAt) : Number.NaN;
      const validA = Number.isFinite(timeA);
      const validB = Number.isFinite(timeB);

      if (validA && validB) {
        return timeB - timeA;
      }
      if (validA) return -1;
      if (validB) return 1;
      return 0;
    });
  }

  public getOrderExpiresAt(order: OrderDetail): string | null {
    if (order.expiresAt) {
      return order.expiresAt;
    }
    if (!order.createdAt) {
      return null;
    }
    const createdMs = Date.parse(order.createdAt);
    if (!Number.isFinite(createdMs)) {
      return null;
    }
    return new Date(createdMs + 48 * 60 * 60 * 1000).toISOString();
  }

  public isSpeiPaymentUrl(url?: string): boolean {
    return !!url && (url.includes('bank_transfer') || url.includes('instructions'));
  }

  public onDownloadSpeiPdf(order: OrderDetail): void {
    if (!order?.id) return;

    this.downloadingPdfOrderId.set(order.id);
    this.checkoutService.downloadOrderSpeiPdf(order.id).subscribe({
      next: (blob) => {
        this.downloadingPdfOrderId.set(null);
        this.checkoutService.saveBlobAsFile(blob, `ficha-spei-${order.id}.pdf`);
        toast.success(`Ficha SPEI de la orden ${order.id} descargada.`);
      },
      error: (err) => {
        this.downloadingPdfOrderId.set(null);
        toast.error(err?.error?.message || 'No se pudo descargar la ficha SPEI en PDF.');
      },
    });
  }

  public onCancelOrder(orderId: string, closeDialog?: () => void): void {
    if (!orderId || this.cancelingOrderId()) return;

    this.cancelingOrderId.set(orderId);
    this.checkoutService.cancelOrder(orderId).subscribe({
      next: (updatedOrder) => {
        this.cancelingOrderId.set(null);
        closeDialog?.();
        this.orders.update((list) =>
          list.map((order) => (order.id === updatedOrder.id ? updatedOrder : order))
        );
        toast.success(`Orden ${orderId} cancelada correctamente.`);
      },
      error: (err) => {
        this.cancelingOrderId.set(null);
        toast.error(err?.error?.message || 'No se pudo cancelar la orden.');
      },
    });
  }

  public onReorder(order: OrderDetail): void {
    if (!order.items || order.items.length === 0) return;

    this.isReordering.set(true);
    let addedCount = 0;

    order.items.forEach((item, index) => {
      this.cartService.addItem(item.productId, item.quantity, item.productName).subscribe({
        next: () => {
          addedCount++;
          if (addedCount === order.items.length) {
            this.isReordering.set(false);
            toast.success('Productos agregados al carrito.');
            this.router.navigate(['/cart']);
          }
        },
        error: () => {
          this.isReordering.set(false);
        },
      });
    });
  }
}
