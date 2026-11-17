import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CartService } from '@features/cart/services/cart.service';
import { CheckoutService } from '@core/services/checkout.service';
import { InvoiceService } from '@core/services/invoice.service';
import { OrderDetail, SpeiPaymentDetails } from '@shared/models/order.model';
import { InvoiceSummary } from '@shared/models/invoice.model';
import { CentsToCurrencyPipe } from '@shared/pipes/cents-to-currency.pipe';
import { IssueInvoiceDialog } from '@shared/components/issue-invoice-dialog/issue-invoice-dialog';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheckCircle2,
  lucideClock,
  lucideAlertTriangle,
  lucideShoppingBag,
  lucideLandmark,
  lucideCopy,
  lucideCheck,
  lucideFileDown,
  lucideExternalLink,
  lucideFileText,
  lucideRefreshCw,
  lucideMail,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';

@Component({
  selector: 'app-payment-status-page',
  imports: [
    RouterLink,
    CentsToCurrencyPipe,
    IssueInvoiceDialog,
    HlmCardImports,
    HlmButtonImports,
    HlmAlertImports,
    HlmBadgeImports,
    HlmSpinnerImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideCheckCircle2,
      lucideClock,
      lucideAlertTriangle,
      lucideShoppingBag,
      lucideLandmark,
      lucideCopy,
      lucideCheck,
      lucideFileDown,
      lucideExternalLink,
      lucideFileText,
      lucideRefreshCw,
      lucideMail,
    }),
  ],
  templateUrl: './payment-status-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentStatusPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly cartService = inject(CartService);
  private readonly checkoutService = inject(CheckoutService);
  private readonly invoiceService = inject(InvoiceService, { optional: true });

  public readonly status = signal<string>('unknown');
  public readonly paymentIntentId = signal<string | null>(null);
  public readonly sessionId = signal<string | null>(null);
  public readonly orderId = signal<string | null>(null);

  public readonly speiDetails = signal<SpeiPaymentDetails | null>(null);
  public readonly paymentUrl = signal<string | null>(null);
  public readonly isLoadingSpeiDetails = signal<boolean>(false);
  public readonly isDownloadingSpeiPdf = signal<boolean>(false);
  public readonly speiCopied = signal<boolean>(false);

  public readonly invoiceSummary = signal<InvoiceSummary | null>(null);
  public readonly isLoadingInvoice = signal<boolean>(false);
  public readonly isDownloadingInvoiceFile = signal<boolean>(false);
  public readonly isResendingInvoiceEmail = signal<boolean>(false);

  public ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    const sessionId = query.get('session_id');
    const paymentIntent = query.get('payment_intent');
    const orderId = query.get('order_id');
    const explicitStatus = query.get('redirect_status');
    const redirectStatus = explicitStatus ?? (sessionId ? 'succeeded' : 'unknown');

    this.status.set(redirectStatus);
    this.sessionId.set(sessionId);
    this.paymentIntentId.set(paymentIntent);
    this.orderId.set(orderId);

    // Si el pago fue acreditado o está en proceso (ej. SPEI), refrescamos el carrito activo del usuario
    if (redirectStatus === 'succeeded' || redirectStatus === 'processing' || redirectStatus === 'requires_action') {
      this.cartService.resetLocalState();
      this.cartService.getCart().subscribe({ error: () => {} });
    }

    if (orderId) {
      if (explicitStatus === 'processing' || explicitStatus === 'requires_action') {
        this.loadInvoiceStatus(orderId);
        this.loadSpeiDetails(orderId);
      } else {
        const applyOrderState = (order: OrderDetail) => {
          if (order.status === 'PAID') {
            this.status.set('succeeded');
            if (order.invoice) {
              this.invoiceSummary.set(order.invoice);
              if (order.invoice.status === 'STAMPED') {
                this.invoiceService?.clearOrderDraft(orderId);
              }
            } else {
              this.loadInvoiceStatus(orderId);
            }
          } else if (order.status === 'FAILED' || order.status === 'CANCELED') {
            this.status.set('failed');
          } else if (order.status === 'PENDING') {
            this.status.set('requires_action');
            this.loadSpeiDetails(orderId);
          }
        };

        if (this.checkoutService.syncOrderPaymentStatus) {
          this.isLoadingInvoice.set(true);
          this.checkoutService.syncOrderPaymentStatus(orderId, sessionId).subscribe({
            next: (syncedOrder) => {
              this.isLoadingInvoice.set(false);
              applyOrderState(syncedOrder);
            },
            error: () => {
              this.isLoadingInvoice.set(false);
              this.loadOrderFallback(orderId, applyOrderState);
            },
          });
        } else {
          this.loadInvoiceStatus(orderId);
          this.loadOrderFallback(orderId, applyOrderState);
        }
      }
    }
  }

  private loadOrderFallback(orderId: string, applyOrderState: (order: OrderDetail) => void): void {
    this.checkoutService.getUserOrders().subscribe({
      next: (orders) => {
        const order = orders.find((o) => o.id === orderId);
        if (order) {
          applyOrderState(order);
        }
      },
      error: () => {},
    });
  }

  private loadSpeiDetails(orderId: string): void {
    this.isLoadingSpeiDetails.set(true);
    this.checkoutService.createOrGetOrderSpeiPayment(orderId).subscribe({
      next: (result) => {
        this.isLoadingSpeiDetails.set(false);
        if (result.status === 'PAID') {
          this.status.set('succeeded');
          return;
        }
        if (result.speiDetails) {
          this.speiDetails.set(result.speiDetails);
        }
        const resolvedUrl = result.paymentUrl ?? result.speiDetails?.hostedInstructionsUrl ?? null;
        if (resolvedUrl) {
          this.paymentUrl.set(resolvedUrl);
        }
      },
      error: () => {
        this.isLoadingSpeiDetails.set(false);
      },
    });
  }

  public downloadSpeiPdf(): void {
    const id = this.speiDetails()?.orderId ?? this.orderId();
    if (!id) {
      toast.error('No se encontró el folio de la orden para descargar la ficha PDF.');
      return;
    }

    this.isDownloadingSpeiPdf.set(true);
    this.checkoutService.downloadOrderSpeiPdf(id).subscribe({
      next: (blob) => {
        this.isDownloadingSpeiPdf.set(false);
        this.checkoutService.saveBlobAsFile(blob, `ficha-spei-${id}.pdf`);
        toast.success('Ficha SPEI en PDF descargada.');
      },
      error: () => {
        this.isDownloadingSpeiPdf.set(false);
        toast.error('No se pudo descargar la ficha SPEI en este momento.');
      },
    });
  }

  public copySpeiClabe(clabe: string | null | undefined): void {
    if (!clabe || typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(clabe).then(() => {
      this.speiCopied.set(true);
      toast.success('CLABE interbancaria copiada al portapapeles.');
      setTimeout(() => this.speiCopied.set(false), 2500);
    });
  }

  public loadInvoiceStatus(orderId = this.orderId()): void {
    if (!orderId || !this.invoiceService) return;
    this.isLoadingInvoice.set(true);
    this.invoiceService.getInvoiceForOrder(orderId).subscribe({
      next: (summary) => {
        this.isLoadingInvoice.set(false);
        this.invoiceSummary.set(summary);
        if (summary?.status === 'STAMPED') {
          this.invoiceService?.clearOrderDraft(orderId);
        }
      },
      error: () => {
        this.isLoadingInvoice.set(false);
      },
    });
  }

  public onInvoiceIssued(summary: InvoiceSummary): void {
    this.invoiceSummary.set(summary);
    if (summary.orderId) {
      this.invoiceService?.clearOrderDraft(summary.orderId);
    }
  }

  public downloadInvoicePdf(): void {
    const id = this.orderId();
    if (!id || !this.invoiceService) return;
    this.isDownloadingInvoiceFile.set(true);
    this.invoiceService.downloadInvoicePdf(id).subscribe({
      next: (blob) => {
        this.isDownloadingInvoiceFile.set(false);
        this.checkoutService.saveBlobAsFile(blob, `factura-${id}.pdf`);
        toast.success('Factura PDF descargada.');
      },
      error: (err) => {
        this.isDownloadingInvoiceFile.set(false);
        toast.error(err?.error?.message || 'No se pudo descargar la factura PDF.');
      },
    });
  }

  public downloadInvoiceXml(): void {
    const id = this.orderId();
    if (!id || !this.invoiceService) return;
    this.isDownloadingInvoiceFile.set(true);
    this.invoiceService.downloadInvoiceXml(id).subscribe({
      next: (blob) => {
        this.isDownloadingInvoiceFile.set(false);
        this.checkoutService.saveBlobAsFile(blob, `factura-${id}.xml`);
        toast.success('Factura XML descargada.');
      },
      error: (err) => {
        this.isDownloadingInvoiceFile.set(false);
        toast.error(err?.error?.message || 'No se pudo descargar la factura XML.');
      },
    });
  }

  public resendInvoiceEmail(): void {
    const id = this.orderId();
    if (!id || !this.invoiceService || this.isResendingInvoiceEmail()) return;
    this.isResendingInvoiceEmail.set(true);
    this.invoiceService.resendInvoiceEmail(id, this.invoiceSummary()?.email).subscribe({
      next: (updated) => {
        this.isResendingInvoiceEmail.set(false);
        this.invoiceSummary.set(updated);
        toast.success('Factura reenviada por Mailtrap correctamente.');
      },
      error: (err) => {
        this.isResendingInvoiceEmail.set(false);
        toast.error(err?.error?.message || 'No se pudo reenviar la factura por correo.');
      },
    });
  }
}

