import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CartService } from '@features/cart/services/cart.service';
import { CheckoutService } from '@core/services/checkout.service';
import { SpeiPaymentDetails } from '@shared/models/order.model';
import { CentsToCurrencyPipe } from '@shared/pipes/cents-to-currency.pipe';
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
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';

@Component({
  selector: 'app-payment-status-page',
  imports: [
    RouterLink,
    CentsToCurrencyPipe,
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
    }),
  ],
  templateUrl: './payment-status-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentStatusPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly cartService = inject(CartService);
  private readonly checkoutService = inject(CheckoutService);

  public readonly status = signal<string>('unknown');
  public readonly paymentIntentId = signal<string | null>(null);
  public readonly sessionId = signal<string | null>(null);
  public readonly orderId = signal<string | null>(null);

  public readonly speiDetails = signal<SpeiPaymentDetails | null>(null);
  public readonly paymentUrl = signal<string | null>(null);
  public readonly isLoadingSpeiDetails = signal<boolean>(false);
  public readonly isDownloadingSpeiPdf = signal<boolean>(false);
  public readonly speiCopied = signal<boolean>(false);

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
        this.loadSpeiDetails(orderId);
      } else {
        this.checkoutService.getUserOrders().subscribe({
          next: (orders) => {
            const order = orders.find((o) => o.id === orderId);
            if (!order) return;

            if (order.status === 'PAID') {
              this.status.set('succeeded');
            } else if (order.status === 'FAILED' || order.status === 'CANCELED') {
              this.status.set('failed');
            } else if (order.status === 'PENDING') {
              this.status.set('requires_action');
              this.loadSpeiDetails(orderId);
            }
          },
          error: () => {},
        });
      }
    }
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
}

