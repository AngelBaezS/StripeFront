import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CheckoutService } from '@core/services/checkout.service';
import { InvoiceService } from '@core/services/invoice.service';
import { CartService } from '@features/cart/services/cart.service';
import { OrderDetail, OrderStatus } from '@shared/models/order.model';
import { InvoiceSummary } from '@shared/models/invoice.model';
import { CentsToCurrencyPipe } from '@shared/pipes/cents-to-currency.pipe';
import { CancelOrderDialog } from '@shared/components/cancel-order-dialog/cancel-order-dialog';
import { IssueInvoiceDialog } from '@shared/components/issue-invoice-dialog/issue-invoice-dialog';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { HlmPaginationImports } from '@spartan-ng/helm/pagination';
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
  lucideFileText,
  lucideMail,
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
    IssueInvoiceDialog,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmAlertImports,
    HlmSkeletonImports,
    HlmEmptyImports,
    HlmTabsImports,
    HlmPaginationImports,
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
      lucideFileText,
      lucideMail,
    }),
  ],
  templateUrl: './order-list-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderListPage implements OnInit {
  private readonly checkoutService = inject(CheckoutService);
  private readonly invoiceService = inject(InvoiceService, { optional: true });
  private readonly cartService = inject(CartService);
  private readonly router = inject(Router);

  public readonly pageSize = 10;

  public readonly orders = signal<OrderDetail[]>([]);
  public readonly isLoading = signal<boolean>(true);
  public readonly errorMessage = signal<string | null>(null);
  public readonly activeTab = signal<OrderFilterTab>('all');
  public readonly currentPage = signal<number>(1);
  public readonly totalElements = signal<number>(0);
  public readonly totalPages = signal<number>(0);
  public readonly hasNext = signal<boolean>(false);
  public readonly hasPrevious = signal<boolean>(false);
  public readonly totalAll = signal<number>(0);
  public readonly totalPaid = signal<number>(0);
  public readonly totalPending = signal<number>(0);
  public readonly totalCanceled = signal<number>(0);
  public readonly isReordering = signal<boolean>(false);
  public readonly downloadingPdfOrderId = signal<string | null>(null);
  public readonly downloadingInvoiceOrderId = signal<string | null>(null);
  public readonly resendingInvoiceOrderId = signal<string | null>(null);
  public readonly cancelingOrderId = signal<string | null>(null);

  public readonly paidOrders = computed(() =>
    this.orders().filter((o) => o.status === 'PAID')
  );

  public readonly pendingOrders = computed(() =>
    this.orders().filter((o) => o.status === 'PENDING')
  );

  public readonly canceledOrders = computed(() =>
    this.orders().filter((o) => o.status === 'CANCELED' || o.status === 'FAILED')
  );

  public readonly filteredOrders = computed(() => this.orders());

  public readonly rangeStart = computed(() =>
    this.totalElements() === 0 ? 0 : (this.currentPage() - 1) * this.pageSize + 1
  );

  public readonly rangeEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize, this.totalElements())
  );

  public readonly visiblePages = computed<(number | 'ellipsis')[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 1) {
      return [];
    }
    if (total <= 7) {
      return Array.from({ length: total }, (_, idx) => idx + 1);
    }

    const pages: (number | 'ellipsis')[] = [1];
    const windowStart = Math.max(2, current - 1);
    const windowEnd = Math.min(total - 1, current + 1);

    if (windowStart > 2) {
      pages.push('ellipsis');
    }
    for (let p = windowStart; p <= windowEnd; p++) {
      pages.push(p);
    }
    if (windowEnd < total - 1) {
      pages.push('ellipsis');
    }
    pages.push(total);
    return pages;
  });

  public ngOnInit(): void {
    this.loadOrders(1);
  }

  public setTab(tab: OrderFilterTab): void {
    if (this.activeTab() === tab) {
      return;
    }
    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.loadOrders(1);
  }

  public goToPage(page: number): void {
    if (
      page === this.currentPage() ||
      page < 1 ||
      (this.totalPages() > 0 && page > this.totalPages()) ||
      this.isLoading()
    ) {
      return;
    }
    this.loadOrders(page);
  }

  public previousPage(): void {
    if (!this.hasPrevious() || this.isLoading()) {
      return;
    }
    this.goToPage(this.currentPage() - 1);
  }

  public nextPage(): void {
    if (!this.hasNext() || this.isLoading()) {
      return;
    }
    this.goToPage(this.currentPage() + 1);
  }

  public loadOrders(page = this.currentPage()): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const statusParam = this.mapTabToStatus(this.activeTab());
    const backendPage = Math.max(0, page - 1);

    this.checkoutService
      .getUserOrdersPage(backendPage, this.pageSize, statusParam)
      .subscribe({
        next: (response) => {
          const sortedContent = this.sortOrdersByDateDesc(response?.content ?? []);
          this.orders.set(sortedContent);
          this.currentPage.set((response?.page ?? backendPage) + 1);
          this.totalElements.set(response?.totalElements ?? sortedContent.length);
          this.totalPages.set(response?.totalPages ?? (sortedContent.length > 0 ? 1 : 0));
          this.hasNext.set(Boolean(response?.hasNext));
          this.hasPrevious.set(Boolean(response?.hasPrevious));
          this.totalAll.set(response?.totalAll ?? sortedContent.length);
          this.totalPaid.set(
            response?.totalPaid ?? sortedContent.filter((o) => o.status === 'PAID').length
          );
          this.totalPending.set(
            response?.totalPending ?? sortedContent.filter((o) => o.status === 'PENDING').length
          );
          this.totalCanceled.set(
            response?.totalCanceled ??
            sortedContent.filter((o) => o.status === 'CANCELED' || o.status === 'FAILED').length
          );
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

  private mapTabToStatus(tab: OrderFilterTab): OrderStatus | undefined {
    switch (tab) {
      case 'paid':
        return 'PAID';
      case 'pending':
        return 'PENDING';
      case 'canceled':
        return 'CANCELED';
      default:
        return undefined;
    }
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

  public onInvoiceIssued(orderId: string, invoice: InvoiceSummary): void {
    this.orders.update((list) =>
      list.map((order) => (order.id === orderId ? { ...order, invoice } : order))
    );
  }

  public onDownloadInvoicePdf(order: OrderDetail): void {
    if (!order?.id || !this.invoiceService) return;
    this.downloadingInvoiceOrderId.set(order.id);
    this.invoiceService.downloadInvoicePdf(order.id).subscribe({
      next: (blob) => {
        this.downloadingInvoiceOrderId.set(null);
        this.checkoutService.saveBlobAsFile(blob, `factura-${order.id}.pdf`);
        toast.success(`Factura PDF de la orden ${order.id} descargada.`);
      },
      error: (err) => {
        this.downloadingInvoiceOrderId.set(null);
        toast.error(err?.error?.message || 'No se pudo descargar el PDF de la factura.');
      },
    });
  }

  public onDownloadInvoiceXml(order: OrderDetail): void {
    if (!order?.id || !this.invoiceService) return;
    this.downloadingInvoiceOrderId.set(order.id);
    this.invoiceService.downloadInvoiceXml(order.id).subscribe({
      next: (blob) => {
        this.downloadingInvoiceOrderId.set(null);
        this.checkoutService.saveBlobAsFile(blob, `factura-${order.id}.xml`);
        toast.success(`Factura XML de la orden ${order.id} descargada.`);
      },
      error: (err) => {
        this.downloadingInvoiceOrderId.set(null);
        toast.error(err?.error?.message || 'No se pudo descargar el XML de la factura.');
      },
    });
  }

  public onResendInvoiceEmail(order: OrderDetail): void {
    if (!order?.id || !this.invoiceService || this.resendingInvoiceOrderId()) return;
    this.resendingInvoiceOrderId.set(order.id);
    this.invoiceService.resendInvoiceEmail(order.id, order.invoice?.email).subscribe({
      next: (updated) => {
        this.resendingInvoiceOrderId.set(null);
        this.onInvoiceIssued(order.id, updated);
        toast.success(`Factura reenviada correctamente`);
      },
      error: (err) => {
        this.resendingInvoiceOrderId.set(null);
        toast.error(err?.error?.message || 'No se pudo reenviar la factura por correo.');
      },
    });
  }

  public onCancelOrder(orderId: string, closeDialog?: () => void): void {
    if (!orderId || this.cancelingOrderId()) return;

    this.cancelingOrderId.set(orderId);
    this.checkoutService.cancelOrder(orderId).subscribe({
      next: () => {
        this.cancelingOrderId.set(null);
        closeDialog?.();
        toast.success(`Orden ${orderId} cancelada correctamente.`);
        const shouldStepBack =
          this.activeTab() === 'pending' &&
          this.orders().length === 1 &&
          this.currentPage() > 1;
        const targetPage = shouldStepBack ? this.currentPage() - 1 : this.currentPage();
        this.loadOrders(targetPage);
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
