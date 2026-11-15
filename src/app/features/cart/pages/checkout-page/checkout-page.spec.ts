import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CheckoutPage } from './checkout-page';
import { CartService } from '@features/cart/services/cart.service';
import { CheckoutService } from '@core/services/checkout.service';
import { AuthService } from '@core/services/auth.service';
import { StripePaymentResult } from '@shared/models/order.model';

describe('CheckoutPage', () => {
  it('should validate email, generate SPEI instructions with email, auto-download SPEI PDF, and navigate to resultado', async () => {
    const mockSpeiResult: StripePaymentResult = {
      stripeId: 'pi_spei_test_1',
      clientSecret: 'pi_spei_test_1_secret',
      paymentUrl: 'https://payments.stripe.com/bank_transfer/instructions_test',
      status: 'PENDING',
      orderId: 'ord_spei_test_1',
      speiDetails: {
        clabe: '646180111812345678',
        bankName: 'STP',
        bankCode: '646',
        reference: 'REF998877',
        hostedInstructionsUrl: 'https://payments.stripe.com/bank_transfer/instructions_test',
        amountCents: 150000,
        currency: 'mxn',
        orderId: 'ord_spei_test_1',
        recipientEmail: 'cliente@correo.mx',
      },
    };

    const cartServiceMock = {
      getCart: vi.fn().mockReturnValue(
        of({
          id: 'crt_1',
          userId: 'usr_1',
          status: 'ACTIVE',
          totalAmountCents: 150000,
          items: [
            {
              id: 'cit_1',
              productId: 'prd_1',
              productName: 'Laptop',
              unitAmountCents: 150000,
              quantity: 1,
              subtotalCents: 150000,
            },
          ],
        })
      ),
      resetLocalState: vi.fn(),
    };

    const pdfBlob = new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' });
    const checkoutServiceMock = {
      getStripe: vi.fn().mockResolvedValue(null),
      getUserOrders: vi.fn().mockReturnValue(of([])),
      createSpeiPaymentOrder: vi.fn().mockReturnValue(of(mockSpeiResult)),
      downloadOrderSpeiPdf: vi.fn().mockReturnValue(of(pdfBlob)),
      saveBlobAsFile: vi.fn(),
      cancelOrder: vi.fn().mockReturnValue(
        of({
          id: 'ord_spei_test_1',
          userId: 'usr_1',
          totalAmountCents: 150000,
          currency: 'mxn',
          status: 'CANCELED',
          canceledAt: '2026-11-13T15:00:00',
          items: [],
        })
      ),
    };

    const authServiceMock = {
      currentProfile: vi.fn().mockReturnValue({ email: 'cliente@correo.mx' }),
      isAuthenticated: vi.fn().mockReturnValue(true),
      getProfile: vi.fn().mockReturnValue(of({ email: 'cliente@correo.mx' })),
    };

    await TestBed.configureTestingModule({
      imports: [CheckoutPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => null,
              },
            },
          },
        },
        { provide: CartService, useValue: cartServiceMock },
        { provide: CheckoutService, useValue: checkoutServiceMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CheckoutPage);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.speiEmail()).toBe('cliente@correo.mx');

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const closeDialogSpy = vi.fn();

    // Validar rechazo de correo inválido
    component.speiEmail.set('correo-invalido');
    component.initSpeiPayment(closeDialogSpy);
    expect(component.speiEmailError()).toBeTruthy();
    expect(checkoutServiceMock.createSpeiPaymentOrder).not.toHaveBeenCalled();
    expect(closeDialogSpy).not.toHaveBeenCalled();

    // Enviar con correo válido: cierra modal, descarga PDF automático y redirige a resultado
    component.speiEmail.set('cliente@correo.mx');
    component.initSpeiPayment(closeDialogSpy);
    await new Promise((resolve) => setTimeout(resolve, 20));
    fixture.detectChanges();

    expect(closeDialogSpy).toHaveBeenCalled();
    expect(checkoutServiceMock.createSpeiPaymentOrder).toHaveBeenCalledWith('cliente@correo.mx');
    expect(cartServiceMock.resetLocalState).toHaveBeenCalled();
    expect(component.speiResult()?.speiDetails?.clabe).toBe('646180111812345678');
    expect(checkoutServiceMock.downloadOrderSpeiPdf).toHaveBeenCalledWith('ord_spei_test_1');
    expect(checkoutServiceMock.saveBlobAsFile).toHaveBeenCalledWith(
      pdfBlob,
      'ficha-spei-ord_spei_test_1.pdf'
    );
    expect(navigateSpy).toHaveBeenCalledWith(['/cart/resultado'], {
      queryParams: {
        session_id: 'pi_spei_test_1',
        order_id: 'ord_spei_test_1',
        redirect_status: 'requires_action',
      },
    });

    // Probar cancelación de la orden activa desde checkout
    const closeCancelDialogSpy = vi.fn();
    expect(component.activeOrderId()).toBe('ord_spei_test_1');
    component.cancelActiveOrder(closeCancelDialogSpy);

    expect(checkoutServiceMock.cancelOrder).toHaveBeenCalledWith('ord_spei_test_1');
    expect(closeCancelDialogSpy).toHaveBeenCalled();
    expect(cartServiceMock.resetLocalState).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenLastCalledWith(['/orders']);
  });

  it('should initialize Checkout Elements SDK (Checkout Sessions API) and confirm payment with actions.confirm', async () => {
    const paymentElementMock = {
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'ready') cb();
      }),
      mount: vi.fn(),
      destroy: vi.fn(),
    };
    const confirmMock = vi.fn().mockResolvedValue({
      type: 'success',
      session: {
        id: 'cs_test_elements_1',
        status: { type: 'complete', paymentStatus: 'paid' },
      },
    });
    let changeHandler: ((session: unknown) => void) | undefined;
    const initialSession = {
      id: 'cs_test_elements_1',
      email: 'cliente@correo.mx',
      currency: 'usd',
      lineItems: [
        {
          id: 'li_1',
          name: 'Laptop Pro',
          quantity: 1,
          unitAmount: { minorUnitsAmount: 8500, amount: '$85.00' },
          subtotal: { minorUnitsAmount: 8500, amount: '$85.00' },
          total: { minorUnitsAmount: 8500, amount: '$85.00' },
          discount: { minorUnitsAmount: 0, amount: '$0.00' },
        },
      ],
      total: {
        subtotal: { minorUnitsAmount: 8500, amount: '$85.00' },
        discount: { minorUnitsAmount: 0, amount: '$0.00' },
        shippingRate: { minorUnitsAmount: 0, amount: '$0.00' },
        taxExclusive: { minorUnitsAmount: 0, amount: '$0.00' },
        taxInclusive: { minorUnitsAmount: 0, amount: '$0.00' },
        total: { minorUnitsAmount: 8500, amount: '$85.00' },
      },
    };
    const checkoutSdkMock = {
      on: vi.fn((event: string, handler: (session: unknown) => void) => {
        if (event === 'change') changeHandler = handler;
      }),
      loadActions: vi.fn().mockResolvedValue({
        type: 'success',
        actions: {
          confirm: confirmMock,
          getSession: vi.fn().mockReturnValue(initialSession),
        },
      }),
      createPaymentElement: vi.fn().mockReturnValue(paymentElementMock),
    };
    const stripeMock = {
      initCheckoutElementsSdk: vi.fn().mockReturnValue(checkoutSdkMock),
    };

    const cartServiceMock = {
      getCart: vi.fn().mockReturnValue(
        of({
          id: 'crt_2',
          userId: 'usr_1',
          status: 'ACTIVE',
          totalAmountCents: 150000,
          items: [
            {
              id: 'cit_2',
              productId: 'prd_1',
              productName: 'Laptop',
              unitAmountCents: 150000,
              quantity: 1,
              subtotalCents: 150000,
            },
          ],
        })
      ),
      resetLocalState: vi.fn(),
    };

    const checkoutServiceMock = {
      getStripe: vi.fn().mockResolvedValue(stripeMock),
      getUserOrders: vi.fn().mockReturnValue(of([])),
      createDirectPaymentOrder: vi.fn().mockReturnValue(
        of({
          stripeId: 'cs_test_elements_1',
          clientSecret: 'cs_test_elements_1_secret_xyz',
          paymentUrl: null,
          status: 'PENDING',
          orderId: 'ord_elements_1',
        } satisfies StripePaymentResult)
      ),
    };

    const authServiceMock = {
      currentProfile: vi.fn().mockReturnValue({ email: 'cliente@correo.mx' }),
      isAuthenticated: vi.fn().mockReturnValue(true),
      getProfile: vi.fn().mockReturnValue(of({ email: 'cliente@correo.mx' })),
    };

    await TestBed.configureTestingModule({
      imports: [CheckoutPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => null,
              },
            },
          },
        },
        { provide: CartService, useValue: cartServiceMock },
        { provide: CheckoutService, useValue: checkoutServiceMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CheckoutPage);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    await component.initDirectPayment();
    fixture.detectChanges();

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(stripeMock.initCheckoutElementsSdk).toHaveBeenCalledWith(
      expect.objectContaining({
        clientSecret: 'cs_test_elements_1_secret_xyz',
      })
    );
    expect(checkoutSdkMock.loadActions).toHaveBeenCalled();
    expect(checkoutSdkMock.createPaymentElement).toHaveBeenCalledWith({
      layout: 'tabs',
      paymentMethodOrder: ['card', 'customer_balance'],
    });
    expect(paymentElementMock.mount).toHaveBeenCalled();
    expect(component.activeOrderId()).toBe('ord_elements_1');
    expect(component.activeCurrency()).toBe('USD');

    const initialText = fixture.nativeElement.textContent as string;
    expect(initialText).toContain('Precios en USD');
    expect(initialText).toContain('Laptop Pro');
    expect(initialText).toContain('1 × $85.00');
    expect(initialText).toContain('Pagar $85.00');

    // Simular actualización de sesión desde Stripe (ej. cupón/impuesto) vía evento 'change'
    changeHandler?.({
      ...initialSession,
      lineItems: [
        {
          ...initialSession.lineItems[0],
          discount: { minorUnitsAmount: 1000, amount: '$10.00' },
          total: { minorUnitsAmount: 7500, amount: '$75.00' },
        },
      ],
      total: {
        ...initialSession.total,
        discount: { minorUnitsAmount: 1000, amount: '$10.00' },
        taxExclusive: { minorUnitsAmount: 1200, amount: '$12.00' },
        total: { minorUnitsAmount: 8700, amount: '$87.00' },
      },
    });
    fixture.detectChanges();

    const updatedText = fixture.nativeElement.textContent as string;
    expect(updatedText).toContain('-$10.00');
    expect(updatedText).toContain('$12.00');
    expect(updatedText).toContain('Pagar $87.00');

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await component.confirmStripePayment();

    expect(confirmMock).toHaveBeenCalledWith({
      redirect: 'if_required',
    });
    expect(component.isProcessingPayment()).toBe(false);
    expect(cartServiceMock.resetLocalState).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/cart/resultado'], {
      queryParams: {
        session_id: 'cs_test_elements_1',
        order_id: 'ord_elements_1',
        redirect_status: 'succeeded',
      },
    });
  });

  it('should reset loading state and show error when actions.confirm throws or rejects', async () => {
    const paymentElementMock = {
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'ready') cb();
      }),
      mount: vi.fn(),
      destroy: vi.fn(),
    };
    const confirmMock = vi.fn().mockRejectedValue(new Error('IntegrationError simulado'));
    const sessionStub = {
      id: 'cs_test_err_1',
      email: 'cliente@correo.mx',
      currency: 'mxn',
      lineItems: [],
      total: {
        subtotal: { minorUnitsAmount: 10000, amount: '$100.00' },
        discount: { minorUnitsAmount: 0, amount: '$0.00' },
        shippingRate: { minorUnitsAmount: 0, amount: '$0.00' },
        taxExclusive: { minorUnitsAmount: 0, amount: '$0.00' },
        taxInclusive: { minorUnitsAmount: 0, amount: '$0.00' },
        total: { minorUnitsAmount: 10000, amount: '$100.00' },
      },
    };
    const checkoutSdkMock = {
      on: vi.fn(),
      loadActions: vi.fn().mockResolvedValue({
        type: 'success',
        actions: {
          confirm: confirmMock,
          getSession: vi.fn().mockReturnValue(sessionStub),
        },
      }),
      createPaymentElement: vi.fn().mockReturnValue(paymentElementMock),
    };
    const stripeMock = {
      initCheckoutElementsSdk: vi.fn().mockReturnValue(checkoutSdkMock),
    };

    const cartServiceMock = {
      getCart: vi.fn().mockReturnValue(
        of({
          id: 'crt_err',
          userId: 'usr_1',
          status: 'ACTIVE',
          totalAmountCents: 10000,
          items: [
            {
              id: 'cit_err',
              productId: 'prd_1',
              productName: 'Mouse',
              unitAmountCents: 10000,
              quantity: 1,
              subtotalCents: 10000,
            },
          ],
        })
      ),
      resetLocalState: vi.fn(),
    };

    const checkoutServiceMock = {
      getStripe: vi.fn().mockResolvedValue(stripeMock),
      getUserOrders: vi.fn().mockReturnValue(of([])),
      createDirectPaymentOrder: vi.fn().mockReturnValue(
        of({
          stripeId: 'cs_test_err_1',
          clientSecret: 'cs_test_err_1_secret',
          paymentUrl: null,
          status: 'PENDING',
          orderId: 'ord_err_1',
        } satisfies StripePaymentResult)
      ),
    };

    const authServiceMock = {
      currentProfile: vi.fn().mockReturnValue({ email: 'cliente@correo.mx' }),
      isAuthenticated: vi.fn().mockReturnValue(true),
      getProfile: vi.fn().mockReturnValue(of({ email: 'cliente@correo.mx' })),
    };

    await TestBed.configureTestingModule({
      imports: [CheckoutPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => null,
              },
            },
          },
        },
        { provide: CartService, useValue: cartServiceMock },
        { provide: CheckoutService, useValue: checkoutServiceMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CheckoutPage);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.initDirectPayment();
    await new Promise((resolve) => setTimeout(resolve, 60));
    fixture.detectChanges();

    await component.confirmStripePayment();
    fixture.detectChanges();

    expect(confirmMock).toHaveBeenCalled();
    expect(component.isProcessingPayment()).toBe(false);
    expect(component.errorMessage()).toBe('IntegrationError simulado');
  });

  it('should mount hidden Stripe Elements in SPEI mode, auto-confirm, sync CLABE, download PDF, and navigate to resultado', async () => {
    const paymentElementMock = {
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'ready') cb();
      }),
      mount: vi.fn(),
      destroy: vi.fn(),
    };
    const confirmMock = vi.fn().mockResolvedValue({
      type: 'success',
      session: {
        id: 'cs_spei_elements_1',
        status: { type: 'complete', paymentStatus: 'unpaid' },
      },
    });
    const checkoutSdkMock = {
      on: vi.fn(),
      loadActions: vi.fn().mockResolvedValue({
        type: 'success',
        actions: {
          confirm: confirmMock,
          getSession: vi.fn().mockReturnValue({
            id: 'cs_spei_elements_1',
            email: 'cliente@correo.mx',
            currency: 'mxn',
            lineItems: [],
            total: null,
          }),
        },
      }),
      createPaymentElement: vi.fn().mockReturnValue(paymentElementMock),
    };
    const stripeMock = {
      initCheckoutElementsSdk: vi.fn().mockReturnValue(checkoutSdkMock),
    };

    const cartServiceMock = {
      getCart: vi.fn().mockReturnValue(
        of({
          id: 'crt_spei',
          userId: 'usr_1',
          status: 'ACTIVE',
          totalAmountCents: 150000,
          items: [
            {
              id: 'cit_1',
              productId: 'prd_1',
              productName: 'Laptop',
              unitAmountCents: 150000,
              quantity: 1,
              subtotalCents: 150000,
            },
          ],
        })
      ),
      resetLocalState: vi.fn(),
    };

    const pdfBlob = new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' });
    const checkoutServiceMock = {
      getStripe: vi.fn().mockResolvedValue(stripeMock),
      getUserOrders: vi.fn().mockReturnValue(of([])),
      createSpeiPaymentOrder: vi.fn().mockReturnValue(
        of({
          stripeId: 'cs_spei_elements_1',
          clientSecret: 'cs_spei_elements_1_secret_xyz',
          paymentUrl: null,
          status: 'PENDING',
          orderId: 'ord_spei_cs_1',
        } satisfies StripePaymentResult)
      ),
      createOrGetOrderSpeiPayment: vi.fn().mockReturnValue(
        of({
          stripeId: 'cs_spei_elements_1',
          clientSecret: null,
          paymentUrl: 'https://payments.stripe.com/bank_transfer/instructions_test',
          status: 'PENDING',
          orderId: 'ord_spei_cs_1',
          speiDetails: {
            clabe: '646180111812345678',
            bankName: 'STP',
            bankCode: '646',
            reference: 'REF998877',
            hostedInstructionsUrl: 'https://payments.stripe.com/bank_transfer/instructions_test',
            amountCents: 150000,
            currency: 'mxn',
            orderId: 'ord_spei_cs_1',
            recipientEmail: 'cliente@correo.mx',
          },
        } satisfies StripePaymentResult)
      ),
      downloadOrderSpeiPdf: vi.fn().mockReturnValue(of(pdfBlob)),
      saveBlobAsFile: vi.fn(),
    };

    const authServiceMock = {
      currentProfile: vi.fn().mockReturnValue({ email: 'cliente@correo.mx' }),
      isAuthenticated: vi.fn().mockReturnValue(true),
      getProfile: vi.fn().mockReturnValue(of({ email: 'cliente@correo.mx' })),
    };

    await TestBed.configureTestingModule({
      imports: [CheckoutPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => null,
              },
            },
          },
        },
        { provide: CartService, useValue: cartServiceMock },
        { provide: CheckoutService, useValue: checkoutServiceMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CheckoutPage);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const closeDialogSpy = vi.fn();

    component.initSpeiPayment(closeDialogSpy);
    await new Promise((resolve) => setTimeout(resolve, 120));
    fixture.detectChanges();

    expect(closeDialogSpy).toHaveBeenCalled();
    expect(checkoutServiceMock.createSpeiPaymentOrder).toHaveBeenCalledWith('cliente@correo.mx');
    expect(cartServiceMock.resetLocalState).toHaveBeenCalled();
    expect(component.mountedElementsMode()).toBe('spei');
    expect(component.directOrderId()).toBe('ord_spei_cs_1');
    expect(stripeMock.initCheckoutElementsSdk).toHaveBeenCalledWith(
      expect.objectContaining({ clientSecret: 'cs_spei_elements_1_secret_xyz' })
    );
    expect(checkoutSdkMock.createPaymentElement).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethodOrder: ['customer_balance', 'card'] })
    );
    expect(paymentElementMock.mount).toHaveBeenCalledWith(component.speiPaymentElementRef.nativeElement);
    expect(confirmMock).toHaveBeenCalled();
    expect(checkoutServiceMock.createOrGetOrderSpeiPayment).toHaveBeenCalledWith(
      'ord_spei_cs_1',
      'cliente@correo.mx'
    );
    expect(checkoutServiceMock.downloadOrderSpeiPdf).toHaveBeenCalledWith('ord_spei_cs_1');
    expect(checkoutServiceMock.saveBlobAsFile).toHaveBeenCalledWith(
      pdfBlob,
      'ficha-spei-ord_spei_cs_1.pdf'
    );
    expect(navigateSpy).toHaveBeenCalledWith(['/cart/resultado'], {
      queryParams: {
        session_id: 'cs_spei_elements_1',
        order_id: 'ord_spei_cs_1',
        redirect_status: 'requires_action',
      },
    });
  });

  it('should open Stripe Checkout payment link in a new tab and regenerate link when activeOrderId exists', async () => {
    const mockPopup = {
      closed: false,
      opener: {} as unknown,
      location: { href: '' },
      document: { title: '', body: { innerHTML: '' } },
      close: vi.fn(),
    };
    const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(mockPopup as unknown as Window);

    const cartServiceMock = {
      getCart: vi.fn().mockReturnValue(
        of({
          id: 'crt_link_1',
          userId: 'usr_1',
          status: 'ACTIVE',
          totalAmountCents: 150000,
          items: [
            {
              id: 'cit_1',
              productId: 'prd_1',
              productName: 'Laptop',
              unitAmountCents: 150000,
              quantity: 1,
              subtotalCents: 150000,
            },
          ],
        })
      ),
      resetLocalState: vi.fn(),
    };

    const checkoutServiceMock = {
      getStripe: vi.fn().mockResolvedValue(null),
      getUserOrders: vi.fn().mockReturnValue(of([])),
      createPaymentLinkOrder: vi.fn().mockReturnValue(
        of({
          stripeId: 'cs_hosted_1',
          clientSecret: null,
          paymentUrl: 'https://checkout.stripe.com/c/pay/cs_hosted_1',
          status: 'PENDING',
          orderId: 'ord_hosted_1',
        } satisfies StripePaymentResult)
      ),
      createOrGetOrderPaymentLink: vi.fn().mockReturnValue(
        of({
          stripeId: 'cs_hosted_2',
          clientSecret: null,
          paymentUrl: 'https://checkout.stripe.com/c/pay/cs_hosted_2',
          status: 'PENDING',
          orderId: 'ord_hosted_1',
        } satisfies StripePaymentResult)
      ),
    };

    const authServiceMock = {
      currentProfile: vi.fn().mockReturnValue({ email: 'cliente@correo.mx' }),
      isAuthenticated: vi.fn().mockReturnValue(true),
      getProfile: vi.fn().mockReturnValue(of({ email: 'cliente@correo.mx' })),
    };

    await TestBed.configureTestingModule({
      imports: [CheckoutPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => null,
              },
            },
          },
        },
        { provide: CartService, useValue: cartServiceMock },
        { provide: CheckoutService, useValue: checkoutServiceMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CheckoutPage);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    try {
      component.redirectToPaymentLink();
      fixture.detectChanges();

      expect(windowOpenSpy).toHaveBeenCalledWith('about:blank', '_blank');
      expect(checkoutServiceMock.createPaymentLinkOrder).toHaveBeenCalled();
      expect(cartServiceMock.resetLocalState).toHaveBeenCalled();
      expect(component.directOrderId()).toBe('ord_hosted_1');
      expect(component.paymentLinkUrl()).toBe('https://checkout.stripe.com/c/pay/cs_hosted_1');
      expect(mockPopup.opener).toBeNull();
      expect(mockPopup.location.href).toBe('https://checkout.stripe.com/c/pay/cs_hosted_1');

      // Al volver a pulsar con orden activa, regenera enlace vía endpoint por orderId
      component.redirectToPaymentLink();
      fixture.detectChanges();

      expect(checkoutServiceMock.createOrGetOrderPaymentLink).toHaveBeenCalledWith('ord_hosted_1');
      expect(mockPopup.location.href).toBe('https://checkout.stripe.com/c/pay/cs_hosted_2');
    } finally {
      windowOpenSpy.mockRestore();
    }
  });
});

