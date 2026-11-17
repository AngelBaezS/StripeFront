import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  Stripe,
  StripeCheckoutElementsSdk,
  StripeCheckoutLoadActionsSuccess,
  StripeCheckoutSession,
  StripePaymentElement,
} from '@stripe/stripe-js';
import { CartService } from '@features/cart/services/cart.service';
import { CheckoutService } from '@core/services/checkout.service';
import { AuthService } from '@core/services/auth.service';
import { InvoiceService } from '@core/services/invoice.service';
import { CartDetail } from '@shared/models/cart.model';
import { ApiErrorResponse, OrderDetail, StripePaymentResult } from '@shared/models/order.model';
import { InvoiceSummary } from '@shared/models/invoice.model';
import { CentsToCurrencyPipe } from '@shared/pipes/cents-to-currency.pipe';
import { CancelOrderDialog } from '@shared/components/cancel-order-dialog/cancel-order-dialog';
import {
  InvoiceFiscalFields,
  InvoiceFiscalFormGroup,
  createInvoiceFiscalForm,
} from '@shared/components/invoice-fiscal-fields/invoice-fiscal-fields';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideShieldCheck,
  lucideCreditCard,
  lucideLock,
  lucideExternalLink,
  lucideLandmark,
  lucideCopy,
  lucideCheck,
  lucideClock,
  lucideFileDown,
  lucideMail,
  lucideFileText,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-checkout-page',
  imports: [
    RouterLink,
    CentsToCurrencyPipe,
    CancelOrderDialog,
    InvoiceFiscalFields,
    HlmAlertDialogImports,
    HlmCardImports,
    HlmButtonImports,
    HlmAlertImports,
    HlmBadgeImports,
    HlmSeparatorImports,
    HlmTabsImports,
    HlmSkeletonImports,
    HlmSpinnerImports,
    HlmInputImports,
    HlmCheckboxImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideShieldCheck,
      lucideCreditCard,
      lucideLock,
      lucideExternalLink,
      lucideLandmark,
      lucideCopy,
      lucideCheck,
      lucideClock,
      lucideFileDown,
      lucideMail,
      lucideFileText,
    }),
  ],
  templateUrl: './checkout-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPage implements OnInit, OnDestroy {
  private readonly cartService = inject(CartService);
  private readonly checkoutService = inject(CheckoutService);
  private readonly authService = inject(AuthService);
  private readonly invoiceService = inject(InvoiceService, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  @ViewChild('paymentElementContainer', { static: false })
  public paymentElementRef!: ElementRef<HTMLDivElement>;

  @ViewChild('speiPaymentElementContainer', { static: false })
  public speiPaymentElementRef!: ElementRef<HTMLDivElement>;

  public readonly cart = signal<CartDetail | null>(null);
  public readonly existingOrder = signal<OrderDetail | null>(null);
  public readonly targetOrderId = signal<string | null>(null);
  public readonly directOrderId = signal<string | null>(null);

  public readonly isLoadingCart = signal<boolean>(true);
  public readonly isInitializingOrder = signal<boolean>(false);
  public readonly isInitializingSpei = signal<boolean>(false);
  public readonly isDownloadingSpeiPdf = signal<boolean>(false);
  public readonly isCancelingOrder = signal<boolean>(false);
  public readonly orderCreated = signal<boolean>(false);
  public readonly elementsReady = signal<boolean>(false);
  public readonly mountedElementsMode = signal<'direct' | 'spei' | null>(null);
  public readonly isProcessingPayment = signal<boolean>(false);
  public readonly errorMessage = signal<string | null>(null);
  public readonly speiResult = signal<StripePaymentResult | null>(null);
  public readonly paymentLinkUrl = signal<string | null>(null);
  public readonly checkoutSession = signal<StripeCheckoutSession | null>(null);
  public readonly speiCopied = signal<boolean>(false);
  public readonly speiEmail = signal<string>('');
  public readonly speiEmailError = signal<string | null>(null);
  public readonly isSpeiEmailValid = computed(() => EMAIL_PATTERN.test(this.speiEmail().trim()));

  public readonly requiresInvoice = signal<boolean>(false);
  public readonly invoiceRegistered = signal<InvoiceSummary | null>(null);
  public readonly isSavingInvoice = signal<boolean>(false);
  public readonly invoiceForm: InvoiceFiscalFormGroup = createInvoiceFiscalForm(this.fb);

  public readonly activeCurrency = computed(() =>
    (this.checkoutSession()?.currency ?? this.existingOrder()?.currency ?? 'MXN').toUpperCase()
  );

  public readonly hasCheckoutBreakdown = computed(() => {
    const total = this.checkoutSession()?.total;
    if (!total) return false;
    return (
      total.discount.minorUnitsAmount > 0 ||
      total.shippingRate.minorUnitsAmount > 0 ||
      total.taxExclusive.minorUnitsAmount > 0 ||
      total.taxInclusive.minorUnitsAmount > 0
    );
  });

  public readonly activeOrderId = computed(
    () =>
      this.speiResult()?.speiDetails?.orderId ??
      this.speiResult()?.orderId ??
      this.directOrderId() ??
      this.targetOrderId()
  );

  private stripe: Stripe | null = null;
  private checkoutSdk: StripeCheckoutElementsSdk | null = null;
  private checkoutActions: StripeCheckoutLoadActionsSuccess | null = null;
  private paymentElement: StripePaymentElement | null = null;

  public ngOnInit(): void {
    this.prefillSpeiEmail();
    const orderIdParam = this.route.snapshot.queryParamMap.get('orderId');

    if (orderIdParam) {
      this.targetOrderId.set(orderIdParam);
      this.loadExistingOrder(orderIdParam);
    } else {
      this.loadActiveCart();
    }
  }

  private prefillSpeiEmail(): void {
    const profileEmail = this.authService.currentProfile()?.email;
    if (profileEmail) {
      this.speiEmail.set(profileEmail);
      return;
    }

    if (this.authService.isAuthenticated()) {
      this.authService.getProfile().subscribe({
        next: (profile) => {
          if (profile?.email && !this.speiEmail()) {
            this.speiEmail.set(profile.email);
          }
        },
        error: () => {
          // Mantener campo editable si no se pudo cargar el perfil
        },
      });
    }
  }

  public onToggleRequiresInvoice(checked: boolean): void {
    this.requiresInvoice.set(checked);
  }

  private validateInvoiceSectionIfRequired(): boolean {
    if (!this.requiresInvoice()) {
      return true;
    }
    this.invoiceForm.markAllAsTouched();
    if (this.invoiceForm.invalid) {
      const msg = 'Completa correctamente tus datos fiscales CFDI 4.0 antes de continuar con el pago.';
      this.errorMessage.set(msg);
      toast.error(msg);
      return false;
    }
    return true;
  }

  private async syncCheckoutInvoiceForOrder(orderId: string | null): Promise<boolean> {
    if (!this.requiresInvoice() || !orderId || !this.invoiceService) {
      return true;
    }
    this.invoiceForm.markAllAsTouched();
    if (this.invoiceForm.invalid) {
      const msg = 'Completa correctamente tus datos fiscales CFDI 4.0 para poder emitir tu factura.';
      this.errorMessage.set(msg);
      toast.error(msg);
      return false;
    }

    const payload = this.invoiceForm.getRawValue();
    this.isSavingInvoice.set(true);
    try {
      this.invoiceService.saveOrderDraft(orderId, payload);
      const summary = await firstValueFrom(
        this.invoiceService.saveCheckoutInvoiceRequest(orderId, payload)
      );
      this.invoiceRegistered.set(summary);
      return true;
    } catch (err: unknown) {
      this.handleBackendError(err);
      return false;
    } finally {
      this.isSavingInvoice.set(false);
    }
  }

  private loadActiveCart(): void {
    this.cartService.getCart().subscribe({
      next: (currentCart) => {
        this.cart.set(currentCart);
        this.isLoadingCart.set(false);

        if (!currentCart.items || currentCart.items.length === 0) {
          toast.warning('Tu carrito está vacío. Agrega productos antes de pagar.');
          this.router.navigate(['/cart']);
        }
      },
      error: (err) => {
        this.isLoadingCart.set(false);
        this.handleBackendError(err);
      },
    });
  }

  private loadExistingOrder(orderId: string): void {
    this.checkoutService.getUserOrders().subscribe({
      next: (orders) => {
        const found = orders.find((o) => o.id === orderId);
        if (found) {
          this.existingOrder.set(found);
          this.isLoadingCart.set(false);

          if (found.status === 'PAID') {
            toast.info('Esta orden ya fue pagada exitosamente.');
            this.router.navigate(['/orders']);
            return;
          }

          if (found.invoice) {
            this.invoiceRegistered.set(found.invoice);
            this.requiresInvoice.set(true);
            this.invoiceForm.patchValue({
              rfc: found.invoice.rfc,
              legalName: found.invoice.legalName,
              zipCode: found.invoice.zipCode,
              taxRegime: found.invoice.taxRegime,
              cfdiUse: found.invoice.cfdiUse,
              email: found.invoice.email,
            });
          }

          // Iniciar montaje directo de Elements para esta orden
          this.initPaymentForOrder(orderId);
        } else {
          toast.error('No se encontró la orden solicitada.');
          this.router.navigate(['/orders']);
        }
      },
      error: (err) => {
        this.isLoadingCart.set(false);
        this.handleBackendError(err);
      },
    });
  }

  public initPaymentForOrder(orderId: string): void {
    this.errorMessage.set(null);
    this.isInitializingOrder.set(true);

    this.checkoutService.getOrRetryOrderPayment(orderId).subscribe({
      next: async (result) => {
        if (result.orderId) {
          this.directOrderId.set(result.orderId);
        }
        await this.mountStripeElements(result.clientSecret);
      },
      error: (err) => {
        this.isInitializingOrder.set(false);
        this.handleBackendError(err);
      },
    });
  }

  public async initDirectPayment(): Promise<void> {
    if (!this.validateInvoiceSectionIfRequired()) {
      return;
    }

    const existingId = this.targetOrderId();
    if (existingId) {
      await this.syncCheckoutInvoiceForOrder(existingId);
      this.initPaymentForOrder(existingId);
      return;
    }

    this.errorMessage.set(null);
    this.isInitializingOrder.set(true);

    this.checkoutService.createDirectPaymentOrder().subscribe({
      next: async (result) => {
        if (result.orderId) {
          this.directOrderId.set(result.orderId);
          if (this.requiresInvoice() && this.invoiceService) {
            await this.syncCheckoutInvoiceForOrder(result.orderId);
          }
        }
        await this.mountStripeElements(result.clientSecret);
      },
      error: (err) => {
        this.isInitializingOrder.set(false);
        this.handleBackendError(err);
      },
    });
  }

  private async initCheckoutSdkSession(
    clientSecret: string,
    mode: 'direct' | 'spei'
  ): Promise<void> {
    this.stripe = await this.checkoutService.getStripe();
    if (!this.stripe) {
      throw new Error('No se pudo inicializar la librería de Stripe.');
    }

    this.paymentElement?.destroy();
    this.paymentElement = null;
    this.checkoutActions = null;
    this.checkoutSession.set(null);
    this.elementsReady.set(false);
    this.mountedElementsMode.set(mode);

    this.checkoutSdk = this.stripe.initCheckoutElementsSdk({
      clientSecret,
      elementsOptions: {
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#09090b',
            borderRadius: '0.75rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          },
        },
      },
    });

    const loadActionsResult = await this.checkoutSdk.loadActions();
    if (loadActionsResult.type === 'error') {
      throw new Error(loadActionsResult.error.message || 'No se pudieron cargar las acciones de Stripe Checkout.');
    }

    this.checkoutActions = loadActionsResult.actions;
    this.checkoutSession.set(this.checkoutActions.getSession?.() ?? null);
    this.checkoutSdk.on?.('change', (updatedSession) => {
      this.checkoutSession.set(updatedSession);
    });
    this.orderCreated.set(true);
  }

  private async mountStripeElements(
    clientSecret: string | null,
    mode: 'direct' | 'spei' = 'direct'
  ): Promise<void> {
    if (!clientSecret) {
      this.errorMessage.set('El servidor no devolvió una clave clientSecret válida.');
      this.isInitializingOrder.set(false);
      this.isInitializingSpei.set(false);
      return;
    }

    try {
      await this.initCheckoutSdkSession(clientSecret, mode);
      this.isInitializingOrder.set(false);

      setTimeout(() => {
        const container =
          mode === 'spei'
            ? this.speiPaymentElementRef?.nativeElement
            : this.paymentElementRef?.nativeElement;
        if (!container || !this.checkoutSdk) return;

        this.paymentElement = this.checkoutSdk.createPaymentElement({
          layout: 'tabs',
          paymentMethodOrder: mode === 'spei' ? ['customer_balance', 'card'] : ['card', 'customer_balance'],
        });

        this.paymentElement.on('ready', () => {
          this.elementsReady.set(true);
        });

        this.paymentElement.mount(container);
      }, 50);
    } catch (err: unknown) {
      this.mountedElementsMode.set(null);
      this.isInitializingOrder.set(false);
      this.isInitializingSpei.set(false);
      this.handleBackendError(err);
    }
  }

  private async mountAndAutoConfirmSpeiElements(
    clientSecret: string,
    orderId: string | null,
    email: string
  ): Promise<void> {
    await this.initCheckoutSdkSession(clientSecret, 'spei');

    setTimeout(() => {
      const container = this.speiPaymentElementRef?.nativeElement;
      if (!container || !this.checkoutSdk) {
        this.isInitializingSpei.set(false);
        this.isProcessingPayment.set(false);
        this.errorMessage.set('No se pudo inicializar el contenedor de confirmación SPEI.');
        return;
      }

      let confirmedOnce = false;
      this.paymentElement = this.checkoutSdk.createPaymentElement({
        layout: 'tabs',
        paymentMethodOrder: ['customer_balance', 'card'],
      });

      this.paymentElement.on('ready', async () => {
        this.elementsReady.set(true);
        if (confirmedOnce) return;
        confirmedOnce = true;
        await this.executeStripeConfirmation(true, orderId, email);
      });

      this.paymentElement.mount(container);
    }, 50);
  }

  public async confirmStripePayment(): Promise<void> {
    await this.executeStripeConfirmation(false, this.activeOrderId(), this.speiEmail().trim());
  }

  private async executeStripeConfirmation(
    isSpeiAutoFlow: boolean,
    explicitOrderId: string | null,
    explicitEmail: string
  ): Promise<void> {
    if (!this.checkoutActions || (!isSpeiAutoFlow && this.isProcessingPayment())) return;

    const targetIdForInvoice = explicitOrderId ?? this.activeOrderId();
    if (!isSpeiAutoFlow && this.requiresInvoice() && !(await this.syncCheckoutInvoiceForOrder(targetIdForInvoice))) {
      return;
    }

    this.isProcessingPayment.set(true);
    this.errorMessage.set(null);

    try {
      const sessionEmail = this.checkoutActions.getSession?.().email;
      const customerEmail = explicitEmail || this.authService.currentProfile()?.email;

      // return_url ya se configura en el backend al crear la Checkout Session;
      // enviarlo también en confirm() provoca conflicto IntegrationError en Stripe.js.
      const confirmResult = await this.checkoutActions.confirm({
        redirect: 'if_required',
        ...(!sessionEmail && customerEmail ? { email: customerEmail } : {}),
      });

      if (confirmResult.type === 'error') {
        this.errorMessage.set(confirmResult.error.message ?? 'No se pudo completar el pago con Stripe.');
        toast.error('Error al procesar el pago');
        return;
      }

      const session = confirmResult.session;
      const resolvedOrderId = explicitOrderId ?? this.activeOrderId();
      this.cartService.resetLocalState();

      let normalizedStatus = 'succeeded';
      if (isSpeiAutoFlow) {
        normalizedStatus = 'requires_action';
        if (resolvedOrderId) {
          // Sincroniza detalles SPEI en backend (CLABE + envío de correo) y descarga el PDF de inmediato
          await firstValueFrom(
            this.checkoutService.createOrGetOrderSpeiPayment(resolvedOrderId, customerEmail || undefined)
          ).catch(() => null);
          await this.downloadSpeiPdfAsync(resolvedOrderId);
        }
        toast.success('CLABE SPEI generada y ficha PDF descargada.');
      } else if (session.status.type === 'complete') {
        normalizedStatus = session.status.paymentStatus === 'unpaid' ? 'requires_action' : 'succeeded';
      } else if (session.status.type === 'open') {
        normalizedStatus = 'processing';
      } else if (session.status.type === 'expired') {
        normalizedStatus = 'failed';
      }

      this.router.navigate(['/cart/resultado'], {
        queryParams: {
          session_id: session.id,
          ...(resolvedOrderId ? { order_id: resolvedOrderId } : {}),
          redirect_status: normalizedStatus,
        },
      });
    } catch (err: unknown) {
      this.handleBackendError(err);
    } finally {
      this.isProcessingPayment.set(false);
      this.isInitializingSpei.set(false);
    }
  }

  public onSpeiEmailInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.speiEmail.set(value);
    if (this.speiEmailError()) {
      this.speiEmailError.set(null);
    }
  }

  public initSpeiPayment(closeDialog?: () => void): void {
    if (!this.validateInvoiceSectionIfRequired()) {
      closeDialog?.();
      return;
    }

    const email = this.speiEmail().trim();
    if (!email || !EMAIL_PATTERN.test(email)) {
      this.speiEmailError.set('Ingresa un correo electrónico válido para enviarte las instrucciones y la ficha SPEI.');
      toast.error('Por favor ingresa un correo electrónico válido.');
      return;
    }

    closeDialog?.();
    const existingId = this.targetOrderId();
    this.errorMessage.set(null);
    this.speiEmailError.set(null);
    this.isInitializingSpei.set(true);
    this.isProcessingPayment.set(true);

    const request$ = existingId
      ? this.checkoutService.createOrGetOrderSpeiPayment(existingId, email)
      : this.checkoutService.createSpeiPaymentOrder(email);

    request$.subscribe({
      next: async (result) => {
        const resolvedOrderId = result.orderId ?? existingId ?? null;
        if (resolvedOrderId) {
          this.directOrderId.set(resolvedOrderId);
          if (this.requiresInvoice() && this.invoiceService) {
            await this.syncCheckoutInvoiceForOrder(resolvedOrderId);
          }
        }
        if (!existingId) {
          this.cartService.resetLocalState();
        }

        if (result.speiDetails) {
          this.speiResult.set(result);
          this.orderCreated.set(true);
          if (resolvedOrderId) {
            await this.downloadSpeiPdfAsync(resolvedOrderId);
          }
          this.isInitializingSpei.set(false);
          this.isProcessingPayment.set(false);
          toast.success(`Ficha SPEI generada e instrucciones registradas para ${email}.`);
          this.router.navigate(['/cart/resultado'], {
            queryParams: {
              ...(result.stripeId ? { session_id: result.stripeId } : {}),
              ...(resolvedOrderId ? { order_id: resolvedOrderId } : {}),
              redirect_status: 'requires_action',
            },
          });
          return;
        }

        if (result.clientSecret) {
          try {
            await this.mountAndAutoConfirmSpeiElements(result.clientSecret, resolvedOrderId, email);
          } catch (err: unknown) {
            this.isInitializingSpei.set(false);
            this.isProcessingPayment.set(false);
            this.handleBackendError(err);
          }
          return;
        }

        this.isInitializingSpei.set(false);
        this.isProcessingPayment.set(false);
        this.errorMessage.set('El servidor no devolvió datos SPEI ni clientSecret de Checkout.');
      },
      error: (err) => {
        this.isInitializingSpei.set(false);
        this.isProcessingPayment.set(false);
        this.handleBackendError(err);
      },
    });
  }

  private async downloadSpeiPdfAsync(orderId: string): Promise<void> {
    this.isDownloadingSpeiPdf.set(true);
    try {
      const blob = await firstValueFrom(this.checkoutService.downloadOrderSpeiPdf(orderId));
      this.checkoutService.saveBlobAsFile(blob, `ficha-spei-${orderId}.pdf`);
    } catch {
      // Si la descarga automática es bloqueada o falla, el botón en /cart/resultado permite reintentar
    } finally {
      this.isDownloadingSpeiPdf.set(false);
    }
  }

  public downloadSpeiPdf(): void {
    const orderId = this.speiResult()?.speiDetails?.orderId ?? this.targetOrderId();
    if (!orderId) {
      toast.error('No se encontró el folio de la orden para descargar la ficha PDF.');
      return;
    }

    this.isDownloadingSpeiPdf.set(true);
    this.checkoutService.downloadOrderSpeiPdf(orderId).subscribe({
      next: (blob) => {
        this.isDownloadingSpeiPdf.set(false);
        this.checkoutService.saveBlobAsFile(blob, `ficha-spei-${orderId}.pdf`);
        toast.success('Ficha SPEI en PDF descargada.');
      },
      error: (err) => {
        this.isDownloadingSpeiPdf.set(false);
        this.handleBackendError(err);
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

  public redirectToPaymentLink(): void {
    if (!this.validateInvoiceSectionIfRequired()) {
      return;
    }

    const existingOrderId = this.activeOrderId();
    this.errorMessage.set(null);
    this.isInitializingOrder.set(true);

    // Abrir la pestaña de forma síncrona dentro del evento de clic evita bloqueos de popups
    const popup = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    if (popup) {
      try {
        popup.opener = null;
        if (popup.document) {
          popup.document.title = 'Redirigiendo a Stripe Checkout...';
          popup.document.body.innerHTML =
            '<p style="font-family:sans-serif;padding:24px;color:#334155;">Preparando sesión segura en Stripe Checkout...</p>';
        }
      } catch {
        // Ignorar si el navegador restringe acceso al documento de about:blank
      }
    }

    const request$ = existingOrderId
      ? this.checkoutService.createOrGetOrderPaymentLink(existingOrderId)
      : this.checkoutService.createPaymentLinkOrder();

    request$.subscribe({
      next: (result) => {
        const resolvedOrderId = result.orderId ?? existingOrderId ?? null;
        if (resolvedOrderId) {
          this.directOrderId.set(resolvedOrderId);
        }
        const finalizeLink = () => {
          this.isInitializingOrder.set(false);
          if (!existingOrderId) {
            this.cartService.resetLocalState();
          }

          if (result.paymentUrl) {
            this.paymentLinkUrl.set(result.paymentUrl);
            if (popup && !popup.closed) {
              popup.location.href = result.paymentUrl;
            } else if (typeof window !== 'undefined') {
              window.open(result.paymentUrl, '_blank', 'noopener,noreferrer');
            }
            toast.success('Stripe Checkout se abrió en una nueva pestaña.');
          } else {
            if (popup && !popup.closed) {
              popup.close();
            }
            this.errorMessage.set('El servidor no devolvió una URL válida de pago.');
          }
        };

        if (this.requiresInvoice() && resolvedOrderId && this.invoiceService) {
          this.syncCheckoutInvoiceForOrder(resolvedOrderId).then(() => finalizeLink());
        } else {
          finalizeLink();
        }
      },
      error: (err) => {
        if (popup && !popup.closed) {
          popup.close();
        }
        this.isInitializingOrder.set(false);
        this.handleBackendError(err);
      },
    });
  }

  private handleBackendError(err: unknown): void {
    if (err instanceof HttpErrorResponse && err.error) {
      const apiErr = err.error as ApiErrorResponse;
      const msg = apiErr.message || (typeof err.error === 'string' ? err.error : 'Error en la orden');
      this.errorMessage.set(msg);
      toast.error(msg);
    } else if (err instanceof Error) {
      this.errorMessage.set(err.message);
      toast.error(err.message);
    } else {
      this.errorMessage.set('Ocurrió un error inesperado al procesar la solicitud.');
      toast.error('Error inesperado');
    }
  }

  public cancelActiveOrder(closeDialog?: () => void): void {
    const orderId = this.activeOrderId();
    if (!orderId || this.isCancelingOrder()) return;

    this.isCancelingOrder.set(true);
    this.checkoutService.cancelOrder(orderId).subscribe({
      next: () => {
        this.isCancelingOrder.set(false);
        this.checkoutSession.set(null);
        closeDialog?.();
        this.cartService.resetLocalState();
        toast.success(`Orden ${orderId} cancelada correctamente.`);
        this.router.navigate(['/orders']);
      },
      error: (err) => {
        this.isCancelingOrder.set(false);
        this.handleBackendError(err);
      },
    });
  }

  public ngOnDestroy(): void {
    this.paymentElement?.destroy();
  }
}
