import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CheckoutService } from '@core/services/checkout.service';
import { StripePaymentResult } from '@shared/models/order.model';
import { PaymentStatusPage } from './payment-status-page';
import { CartService } from '@features/cart/services/cart.service';

describe('PaymentStatusPage', () => {
  it('should handle Checkout Session return query params (session_id and order_id) and reset cart state', async () => {
    const cartServiceMock = {
      resetLocalState: vi.fn(),
      getCart: vi.fn().mockReturnValue(of(null)),
    };
    const checkoutServiceMock = {
      getUserOrders: vi.fn().mockReturnValue(of([])),
      createOrGetOrderSpeiPayment: vi.fn(),
      downloadOrderSpeiPdf: vi.fn(),
      saveBlobAsFile: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PaymentStatusPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                session_id: 'cs_test_return_1',
                order_id: 'ord_return_1',
              }),
            },
          },
        },
        { provide: CartService, useValue: cartServiceMock },
        { provide: CheckoutService, useValue: checkoutServiceMock },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PaymentStatusPage);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.status()).toBe('succeeded');
    expect(component.sessionId()).toBe('cs_test_return_1');
    expect(component.orderId()).toBe('ord_return_1');
    expect(cartServiceMock.resetLocalState).toHaveBeenCalled();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('cs_test_return_1');
    expect(text).toContain('ord_return_1');
  });

  it('should load SPEI details and allow downloading PDF and viewing Stripe instructions when redirect_status is requires_action', async () => {
    const pdfBlob = new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' });
    const mockSpeiResult: StripePaymentResult = {
      stripeId: 'cs_spei_return_1',
      clientSecret: null,
      paymentUrl: 'https://payments.stripe.com/bank_transfer/instructions_test',
      status: 'PENDING',
      orderId: 'ord_spei_return_1',
      speiDetails: {
        clabe: '646180111812345678',
        bankName: 'STP',
        bankCode: '646',
        reference: 'REF998877',
        hostedInstructionsUrl: 'https://payments.stripe.com/bank_transfer/instructions_test',
        amountCents: 150000,
        currency: 'mxn',
        orderId: 'ord_spei_return_1',
        recipientEmail: 'cliente@correo.mx',
      },
    };

    const cartServiceMock = {
      resetLocalState: vi.fn(),
      getCart: vi.fn().mockReturnValue(of(null)),
    };
    const checkoutServiceMock = {
      getUserOrders: vi.fn().mockReturnValue(of([])),
      createOrGetOrderSpeiPayment: vi.fn().mockReturnValue(of(mockSpeiResult)),
      downloadOrderSpeiPdf: vi.fn().mockReturnValue(of(pdfBlob)),
      saveBlobAsFile: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PaymentStatusPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                session_id: 'cs_spei_return_1',
                order_id: 'ord_spei_return_1',
                redirect_status: 'requires_action',
              }),
            },
          },
        },
        { provide: CartService, useValue: cartServiceMock },
        { provide: CheckoutService, useValue: checkoutServiceMock },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PaymentStatusPage);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.status()).toBe('requires_action');
    expect(checkoutServiceMock.createOrGetOrderSpeiPayment).toHaveBeenCalledWith('ord_spei_return_1');
    expect(component.speiDetails()?.clabe).toBe('646180111812345678');

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('646180111812345678');
    expect(text).toContain('REF998877');
    expect(text).toContain('Copiar');
    expect(text).toContain('Descargar Ficha SPEI (PDF)');
    expect(text).toContain('Ver Instrucciones Stripe');

    component.downloadSpeiPdf();
    expect(checkoutServiceMock.downloadOrderSpeiPdf).toHaveBeenCalledWith('ord_spei_return_1');
    expect(checkoutServiceMock.saveBlobAsFile).toHaveBeenCalledWith(
      pdfBlob,
      'ficha-spei-ord_spei_return_1.pdf'
    );
  });
});
