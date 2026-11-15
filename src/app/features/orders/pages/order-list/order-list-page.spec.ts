import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { OrderListPage } from './order-list-page';
import { CheckoutService } from '@core/services/checkout.service';
import { CartService } from '@features/cart/services/cart.service';
import { OrderDetail } from '@shared/models/order.model';

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

    const checkoutServiceMock = {
      getUserOrders: vi.fn().mockReturnValue(of(ordersFromApi)),
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
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OrderListPage);
    fixture.detectChanges();

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

  it('should filter canceled orders and render exact cancellation date when status is CANCELED', async () => {
    const ordersFromApi: OrderDetail[] = [
      {
        id: 'ord_pending_1',
        userId: 'usr_1',
        totalAmountCents: 10000,
        currency: 'mxn',
        status: 'PENDING',
        createdAt: '2026-11-13T08:00:00',
        expiresAt: '2026-11-15T08:00:00',
        items: [],
      },
      {
        id: 'ord_canceled_1',
        userId: 'usr_1',
        totalAmountCents: 20000,
        currency: 'mxn',
        status: 'CANCELED',
        createdAt: '2026-11-10T10:00:00',
        expiresAt: '2026-11-12T10:00:00',
        canceledAt: '2026-11-12T10:05:00',
        items: [],
      },
    ];

    const pdfBlob = new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' });
    const canceledOrder: OrderDetail = {
      ...ordersFromApi[0],
      status: 'CANCELED',
      canceledAt: '2026-11-13T15:00:00',
    };
    const checkoutServiceMock = {
      getUserOrders: vi.fn().mockReturnValue(of(ordersFromApi)),
      downloadOrderSpeiPdf: vi.fn().mockReturnValue(of(pdfBlob)),
      saveBlobAsFile: vi.fn(),
      cancelOrder: vi.fn().mockReturnValue(of(canceledOrder)),
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
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OrderListPage);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.canceledOrders().map((o) => o.id)).toEqual(['ord_canceled_1']);

    component.onDownloadSpeiPdf(ordersFromApi[0]);
    expect(checkoutServiceMock.downloadOrderSpeiPdf).toHaveBeenCalledWith('ord_pending_1');
    expect(checkoutServiceMock.saveBlobAsFile).toHaveBeenCalledWith(
      pdfBlob,
      'ficha-spei-ord_pending_1.pdf'
    );

    component.setTab('canceled');
    fixture.detectChanges();

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
    expect(component.pendingOrders()).toEqual([]);
    expect(component.canceledOrders().map((o) => o.id)).toEqual([
      'ord_pending_1',
      'ord_canceled_1',
    ]);
  });
});

