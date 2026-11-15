import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CheckoutService } from './checkout.service';
import { environment } from '@env/environment';
import { StripePaymentResult } from '@shared/models/order.model';

describe('CheckoutService', () => {
  let service: CheckoutService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), CheckoutService],
    });
    service = TestBed.inject(CheckoutService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should get user orders list', () => {
    const mockOrders = [
      {
        id: 'ord_123',
        userId: 'usr_1',
        totalAmountCents: 50000,
        currency: 'mxn',
        status: 'PENDING' as const,
        items: [],
      },
    ];

    service.getUserOrders().subscribe((orders) => {
      expect(orders).toEqual(mockOrders);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/order`);
    expect(req.request.method).toBe('GET');
    req.flush(mockOrders);
  });

  it('should get or retry order payment for specific orderId', () => {
    const mockResult: StripePaymentResult = {
      stripeId: 'pi_test_existing',
      clientSecret: 'pi_test_existing_secret',
      paymentUrl: null,
      status: 'PENDING',
    };

    service.getOrRetryOrderPayment('ord_123').subscribe((res) => {
      expect(res).toEqual(mockResult);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/order/ord_123/payment`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResult);
  });

  it('should call direct-payment endpoint', () => {
    const mockResult: StripePaymentResult = {
      stripeId: 'pi_test_123',
      clientSecret: 'pi_test_123_secret_456',
      paymentUrl: null,
      status: 'PENDING',
    };

    service.createDirectPaymentOrder().subscribe((res) => {
      expect(res).toEqual(mockResult);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/order/direct-payment`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(mockResult);
  });

  it('should call payment-link endpoint', () => {
    const mockResult: StripePaymentResult = {
      stripeId: 'cs_test_123',
      clientSecret: null,
      paymentUrl: 'https://checkout.stripe.com/pay/cs_test_123',
      status: 'PENDING',
    };

    service.createPaymentLinkOrder().subscribe((res) => {
      expect(res).toEqual(mockResult);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/order/payment-link`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(mockResult);
  });

  it('should call spei-payment endpoint with email and receive speiDetails', () => {
    const mockResult: StripePaymentResult = {
      stripeId: 'pi_spei_123',
      clientSecret: 'pi_spei_123_secret',
      paymentUrl: 'https://payments.stripe.com/bank_transfer/instructions_test',
      status: 'PENDING',
      speiDetails: {
        clabe: '646180111812345678',
        bankName: 'STP',
        bankCode: '646',
        reference: 'REF12345',
        hostedInstructionsUrl: 'https://payments.stripe.com/bank_transfer/instructions_test',
        amountCents: 150000,
        currency: 'mxn',
        orderId: 'ord_spei_123',
        recipientEmail: 'pagos@cliente.mx',
      },
    };

    service.createSpeiPaymentOrder('pagos@cliente.mx').subscribe((res) => {
      expect(res).toEqual(mockResult);
      expect(res.speiDetails?.clabe).toBe('646180111812345678');
      expect(res.speiDetails?.recipientEmail).toBe('pagos@cliente.mx');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/order/spei-payment`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'pagos@cliente.mx' });
    req.flush(mockResult);
  });

  it('should call order/{orderId}/spei-payment endpoint for existing pending order', () => {
    const mockResult: StripePaymentResult = {
      stripeId: 'pi_spei_456',
      clientSecret: 'pi_spei_456_secret',
      paymentUrl: 'https://payments.stripe.com/bank_transfer/instructions_456',
      status: 'PENDING',
    };

    service.createOrGetOrderSpeiPayment('ord_456', 'finanzas@empresa.mx').subscribe((res) => {
      expect(res).toEqual(mockResult);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/order/ord_456/spei-payment`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'finanzas@empresa.mx' });
    req.flush(mockResult);
  });

  it('should download SPEI PDF as Blob from order/{orderId}/spei-pdf', () => {
    const pdfBlob = new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' });

    service.downloadOrderSpeiPdf('ord_789').subscribe((blob) => {
      expect(blob.size).toBe(pdfBlob.size);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/order/ord_789/spei-pdf`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(pdfBlob);
  });

  it('should call POST order/{orderId}/cancel when canceling an order', () => {
    const canceledOrder = {
      id: 'ord_123',
      userId: 'usr_1',
      totalAmountCents: 50000,
      currency: 'mxn',
      status: 'CANCELED' as const,
      canceledAt: '2026-11-13T15:00:00',
      items: [],
    };

    service.cancelOrder('ord_123').subscribe((res) => {
      expect(res).toEqual(canceledOrder);
      expect(res.status).toBe('CANCELED');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/order/ord_123/cancel`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(canceledOrder);
  });
});

