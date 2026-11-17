import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { OrderListPage } from './order-list-page';
import { CheckoutService } from '@core/services/checkout.service';
import { InvoiceService } from '@core/services/invoice.service';
import { AuthService } from '@core/services/auth.service';
import { CartService } from '@features/cart/services/cart.service';
import { OrderDetail, OrderPageResponse, OrderStatus } from '@shared/models/order.model';

describe('OrderListPage', () => {
  it('should sort orders chronologically newest-first regardless of ID alphabetical order and render creation date', async () => {
    const ordersFromApi: OrderDetail[] = [
      {
        id: 'ord_zzzz9999',
        userId: 'usr_1',
        totalAmountCents: 10000,
        currency: 'mxn',
        status: 'PAID',
        createdAt: '2026-11-10T10:15:00',
        items: [],
      },
      {
        id: 'ord_aaaa1111',
        userId: 'usr_1',
        totalAmountCents: 25000,
        currency: 'mxn',
        status: 'PENDING',
        createdAt: '2026-11-13T09:20:00',
        items: [],
      },
      {
        id: 'ord_mmmm5555',
        userId: 'usr_1',
        totalAmountCents: 15000,
        currency: 'mxn',
        status: 'PAID',
        items: [],
      },
    ];

    const pageResponse: OrderPageResponse = {
      content: ordersFromApi,
      page: 0,
      size: 10,
      totalElements: 3,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
      totalAll: 3,
      totalPaid: 2,
      totalPending: 1,
      totalCanceled: 0,
    };

    const checkoutServiceMock = {
      getUserOrdersPage: vi.fn().mockReturnValue(of(pageResponse)),
    };
    const cartServiceMock = {
      addItem: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [OrderListPage],
      providers: [
        provideRouter([]),
        { provide: CheckoutService, useValue: checkoutServiceMock },
        { provide: CartService, useValue: cartServiceMock },
        {
          provide: InvoiceService,
          useValue: {
            issueInvoiceForOrder: vi.fn(),
            downloadInvoicePdf: vi.fn(),
            downloadInvoiceXml: vi.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: { currentProfile: vi.fn().mockReturnValue({ email: 'a@b.mx' }) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OrderListPage);
    fixture.detectChanges();

    expect(checkoutServiceMock.getUserOrdersPage).toHaveBeenCalledWith(0, 10, undefined);

    const component = fixture.componentInstance;
    expect(component.orders().map((o) => o.id)).toEqual([
      'ord_aaaa1111',
      'ord_zzzz9999',
      'ord_mmmm5555',
    ]);

    const compiledText = fixture.nativeElement.textContent as string;
    expect(compiledText).toContain('Creada el 13/11/2026, 09:20');
    expect(compiledText).toContain('Creada el 10/11/2026, 10:15');
  });

  it('should filter canceled orders by tab and reload paginated orders after canceling a pending order', async () => {
    const pendingOrder: OrderDetail = {
      id: 'ord_pending_1',
      userId: 'usr_1',
      totalAmountCents: 10000,
      currency: 'mxn',
      status: 'PENDING',
      createdAt: '2026-11-13T08:00:00',
      expiresAt: '2026-11-15T08:00:00',
      items: [],
    };
    const canceledOrder1: OrderDetail = {
      id: 'ord_canceled_1',
      userId: 'usr_1',
      totalAmountCents: 20000,
      currency: 'mxn',
      status: 'CANCELED',
      createdAt: '2026-11-10T10:00:00',
      expiresAt: '2026-11-12T10:00:00',
      canceledAt: '2026-11-12T10:05:00',
      items: [],
    };
    const manualCanceledOrder: OrderDetail = {
      ...pendingOrder,
      status: 'CANCELED',
      canceledAt: '2026-11-13T15:00:00',
    };

    const allPage: OrderPageResponse = {
      content: [pendingOrder, canceledOrder1],
      page: 0,
      size: 10,
      totalElements: 2,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
      totalAll: 2,
      totalPaid: 0,
      totalPending: 1,
      totalCanceled: 1,
    };
    const canceledPage: OrderPageResponse = {
      content: [canceledOrder1],
      page: 0,
      size: 10,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
      totalAll: 2,
      totalPaid: 0,
      totalPending: 1,
      totalCanceled: 1,
    };
    const canceledPageAfterCancel: OrderPageResponse = {
      content: [manualCanceledOrder, canceledOrder1],
      page: 0,
      size: 10,
      totalElements: 2,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
      totalAll: 2,
      totalPaid: 0,
      totalPending: 0,
      totalCanceled: 2,
    };

    let canceledTabCalls = 0;
    const pdfBlob = new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' });
    const checkoutServiceMock = {
      getUserOrdersPage: vi
        .fn()
        .mockImplementation((_page: number, _size: number, status?: OrderStatus) => {
          if (status === 'CANCELED') {
            canceledTabCalls++;
            return of(canceledTabCalls === 1 ? canceledPage : canceledPageAfterCancel);
          }
          return of(allPage);
        }),
      downloadOrderSpeiPdf: vi.fn().mockReturnValue(of(pdfBlob)),
      saveBlobAsFile: vi.fn(),
      cancelOrder: vi.fn().mockReturnValue(of(manualCanceledOrder)),
    };
    const cartServiceMock = {
      addItem: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [OrderListPage],
      providers: [
        provideRouter([]),
        { provide: CheckoutService, useValue: checkoutServiceMock },
        { provide: CartService, useValue: cartServiceMock },
        {
          provide: InvoiceService,
          useValue: {
            issueInvoiceForOrder: vi.fn(),
            downloadInvoicePdf: vi.fn(),
            downloadInvoiceXml: vi.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: { currentProfile: vi.fn().mockReturnValue({ email: 'a@b.mx' }) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OrderListPage);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.canceledOrders().map((o) => o.id)).toEqual(['ord_canceled_1']);

    component.onDownloadSpeiPdf(pendingOrder);
    expect(checkoutServiceMock.downloadOrderSpeiPdf).toHaveBeenCalledWith('ord_pending_1');
    expect(checkoutServiceMock.saveBlobAsFile).toHaveBeenCalledWith(
      pdfBlob,
      'ficha-spei-ord_pending_1.pdf'
    );

    component.setTab('canceled');
    fixture.detectChanges();

    expect(checkoutServiceMock.getUserOrdersPage).toHaveBeenCalledWith(0, 10, 'CANCELED');
    expect(component.filteredOrders().map((o) => o.id)).toEqual(['ord_canceled_1']);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('CANCELADO');
    expect(text).toContain('Cancelado el 12/11/2026, 10:05');

    // Probar cancelación manual de orden pendiente
    const closeDialogSpy = vi.fn();
    component.onCancelOrder('ord_pending_1', closeDialogSpy);
    fixture.detectChanges();

    expect(checkoutServiceMock.cancelOrder).toHaveBeenCalledWith('ord_pending_1');
    expect(closeDialogSpy).toHaveBeenCalled();
    expect(component.totalPending()).toBe(0);
    expect(component.totalCanceled()).toBe(2);
    expect(component.canceledOrders().map((o) => o.id)).toEqual([
      'ord_pending_1',
      'ord_canceled_1',
    ]);
  });

  it('should render Spartan pagination controls for 10 items per page and navigate between pages', async () => {
    const buildOrders = (start: number, count: number): OrderDetail[] =>
      Array.from({ length: count }, (_, idx) => {
        const num = start + idx;
        return {
          id: `ord_stripe_${num}`,
          userId: 'usr_1',
          stripePaymentIntentId: `pi_${num}`,
          totalAmountCents: 10000,
          currency: 'mxn',
          status: 'PAID',
          createdAt: `2026-11-${String(25 - num).padStart(2, '0')}T10:00:00`,
          items: [],
        };
      });

    const page0: OrderPageResponse = {
      content: buildOrders(1, 10),
      page: 0,
      size: 10,
      totalElements: 14,
      totalPages: 2,
      hasNext: true,
      hasPrevious: false,
      totalAll: 14,
      totalPaid: 14,
      totalPending: 0,
      totalCanceled: 0,
    };
    const page1: OrderPageResponse = {
      content: buildOrders(11, 4),
      page: 1,
      size: 10,
      totalElements: 14,
      totalPages: 2,
      hasNext: false,
      hasPrevious: true,
      totalAll: 14,
      totalPaid: 14,
      totalPending: 0,
      totalCanceled: 0,
    };

    const checkoutServiceMock = {
      getUserOrdersPage: vi
        .fn()
        .mockImplementation((page: number) => of(page === 0 ? page0 : page1)),
    };

    await TestBed.configureTestingModule({
      imports: [OrderListPage],
      providers: [
        provideRouter([]),
        { provide: CheckoutService, useValue: checkoutServiceMock },
        { provide: CartService, useValue: { addItem: vi.fn() } },
        {
          provide: InvoiceService,
          useValue: {
            issueInvoiceForOrder: vi.fn(),
            downloadInvoicePdf: vi.fn(),
            downloadInvoiceXml: vi.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: { currentProfile: vi.fn().mockReturnValue({ email: 'a@b.mx' }) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OrderListPage);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.orders().length).toBe(10);
    expect(component.currentPage()).toBe(1);
    expect(component.totalPages()).toBe(2);

    const textPage1 = fixture.nativeElement.textContent as string;
    expect(textPage1).toContain('Mostrando 1 - 10 de 14 pedidos (Página 1 de 2)');

    component.nextPage();
    fixture.detectChanges();

    expect(checkoutServiceMock.getUserOrdersPage).toHaveBeenLastCalledWith(1, 10, undefined);
    expect(component.orders().length).toBe(4);
    expect(component.currentPage()).toBe(2);
    const textPage2 = fixture.nativeElement.textContent as string;
    expect(textPage2).toContain('Mostrando 11 - 14 de 14 pedidos (Página 2 de 2)');
  });

  it('should render Solicitar Factura CFDI on unbilled PAID orders and PDF/XML download buttons once STAMPED', async () => {
    const unbilledPaid: OrderDetail = {
      id: 'ord_paid_no_cfdi',
      userId: 'usr_1',
      stripePaymentIntentId: 'pi_1',
      totalAmountCents: 116000,
      currency: 'mxn',
      status: 'PAID',
      createdAt: '2026-11-15T10:00:00',
      items: [],
      invoice: null,
    };
    const stampedPaid: OrderDetail = {
      id: 'ord_paid_with_cfdi',
      userId: 'usr_1',
      stripePaymentIntentId: 'pi_2',
      totalAmountCents: 58000,
      currency: 'mxn',
      status: 'PAID',
      createdAt: '2026-11-14T10:00:00',
      items: [],
      invoice: {
        id: 'invo_1',
        orderId: 'ord_paid_with_cfdi',
        status: 'STAMPED',
        cfdiExpressId: 'inv_1',
        uuid: 'UUID-STAMPED-999',
        rfc: 'XIA190128J61',
        legalName: 'XENON SA',
        zipCode: '01160',
        taxRegime: '601',
        cfdiUse: 'G03',
        email: 'cfdi@xenon.mx',
        hasPdf: true,
        hasXml: true,
      },
    };

    const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    const xmlBlob = new Blob(['<cfdi/>'], { type: 'application/xml' });

    const checkoutServiceMock = {
      getUserOrdersPage: vi.fn().mockReturnValue(
        of({
          content: [unbilledPaid, stampedPaid],
          page: 0,
          size: 10,
          totalElements: 2,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
          totalAll: 2,
          totalPaid: 2,
          totalPending: 0,
          totalCanceled: 0,
        })
      ),
      saveBlobAsFile: vi.fn(),
    };
    const invoiceServiceMock = {
      issueInvoiceForOrder: vi.fn(),
      downloadInvoicePdf: vi.fn().mockReturnValue(of(pdfBlob)),
      downloadInvoiceXml: vi.fn().mockReturnValue(of(xmlBlob)),
      resendInvoiceEmail: vi.fn().mockReturnValue(
        of({
          ...stampedPaid.invoice!,
          emailSent: true,
        })
      ),
    };

    await TestBed.configureTestingModule({
      imports: [OrderListPage],
      providers: [
        provideRouter([]),
        { provide: CheckoutService, useValue: checkoutServiceMock },
        { provide: CartService, useValue: { addItem: vi.fn() } },
        { provide: InvoiceService, useValue: invoiceServiceMock },
        {
          provide: AuthService,
          useValue: { currentProfile: vi.fn().mockReturnValue({ email: 'a@b.mx' }) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OrderListPage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Solicitar Factura CFDI');
    expect(text).toContain('UUID-STAMPED-999');
    expect(text).toContain('Factura PDF');
    expect(text).toContain('Factura XML');
    expect(text).toContain('Reenviar Correo');

    const component = fixture.componentInstance;
    component.onDownloadInvoicePdf(stampedPaid);
    expect(invoiceServiceMock.downloadInvoicePdf).toHaveBeenCalledWith('ord_paid_with_cfdi');
    expect(checkoutServiceMock.saveBlobAsFile).toHaveBeenCalledWith(
      pdfBlob,
      'factura-ord_paid_with_cfdi.pdf'
    );

    component.onDownloadInvoiceXml(stampedPaid);
    expect(invoiceServiceMock.downloadInvoiceXml).toHaveBeenCalledWith('ord_paid_with_cfdi');
    expect(checkoutServiceMock.saveBlobAsFile).toHaveBeenCalledWith(
      xmlBlob,
      'factura-ord_paid_with_cfdi.xml'
    );

    component.onResendInvoiceEmail(stampedPaid);
    expect(invoiceServiceMock.resendInvoiceEmail).toHaveBeenCalledWith(
      'ord_paid_with_cfdi',
      'cfdi@xenon.mx'
    );
  });
});
