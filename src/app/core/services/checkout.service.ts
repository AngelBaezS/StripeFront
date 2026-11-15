import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { environment } from '@env/environment';
import { OrderDetail, StripePaymentResult } from '@shared/models/order.model';

@Injectable({
  providedIn: 'root',
})
export class CheckoutService {
  private readonly http = inject(HttpClient);
  private readonly orderApiUrl = `${environment.apiUrl}/api/v1/order`;

  private readonly stripePromise: Promise<Stripe | null> = loadStripe(
    environment.stripePublicKey
  );

  public getStripe(): Promise<Stripe | null> {
    return this.stripePromise;
  }

  /**
   * Obtiene la lista de órdenes/compras históricas del usuario autenticado.
   */
  public getUserOrders(): Observable<OrderDetail[]> {
    return this.http.get<OrderDetail[]>(this.orderApiUrl);
  }

  /**
   * Obtiene o regenera el StripePaymentResult (clientSecret o paymentUrl)
   * para una orden específica pendiente de pago.
   */
  public getOrRetryOrderPayment(orderId: string): Observable<StripePaymentResult> {
    return this.http.get<StripePaymentResult>(`${this.orderApiUrl}/${orderId}/payment`);
  }

  /**
   * POST /api/v1/order/direct-payment (sin body)
   * Bloquea el carrito a LOCKED y genera clientSecret para Stripe Elements.
   */
  public createDirectPaymentOrder(): Observable<StripePaymentResult> {
    return this.http.post<StripePaymentResult>(`${this.orderApiUrl}/direct-payment`, null);
  }

  /**
   * POST /api/v1/order/payment-link (sin body)
   * Bloquea el carrito a LOCKED y genera paymentUrl para Stripe Checkout.
   */
  public createPaymentLinkOrder(): Observable<StripePaymentResult> {
    return this.http.post<StripePaymentResult>(`${this.orderApiUrl}/payment-link`, null);
  }

  /**
   * POST /api/v1/order/{orderId}/payment-link
   * Genera un nuevo enlace de Stripe Checkout para una orden pendiente existente.
   */
  public createOrGetOrderPaymentLink(orderId: string): Observable<StripePaymentResult> {
    return this.http.post<StripePaymentResult>(`${this.orderApiUrl}/${orderId}/payment-link`, null);
  }

  /**
   * POST /api/v1/order/spei-payment
   * Bloquea el carrito a LOCKED, envía instrucciones al correo indicado y genera ficha SPEI.
   */
  public createSpeiPaymentOrder(email?: string): Observable<StripePaymentResult> {
    const body = email && email.trim().length > 0 ? { email: email.trim() } : null;
    return this.http.post<StripePaymentResult>(`${this.orderApiUrl}/spei-payment`, body);
  }

  /**
   * POST /api/v1/order/{orderId}/spei-payment
   * Genera o recupera instrucciones SPEI para una orden pendiente existente.
   */
  public createOrGetOrderSpeiPayment(orderId: string, email?: string): Observable<StripePaymentResult> {
    const body = email && email.trim().length > 0 ? { email: email.trim() } : null;
    return this.http.post<StripePaymentResult>(`${this.orderApiUrl}/${orderId}/spei-payment`, body);
  }

  /**
   * GET /api/v1/order/{orderId}/spei-pdf
   * Descarga el PDF de la ficha de pago SPEI de una orden pendiente.
   */
  public downloadOrderSpeiPdf(orderId: string): Observable<Blob> {
    return this.http.get(`${this.orderApiUrl}/${orderId}/spei-pdf`, {
      responseType: 'blob',
    });
  }

  /**
   * POST /api/v1/order/{orderId}/cancel
   * Cancela manualmente una orden pendiente, expira/cancela su cobro en Stripe y marca el carrito como CANCELED.
   */
  public cancelOrder(orderId: string): Observable<OrderDetail> {
    return this.http.post<OrderDetail>(`${this.orderApiUrl}/${orderId}/cancel`, null);
  }

  /**
   * Dispara la descarga local del Blob PDF en el navegador.
   */
  public saveBlobAsFile(blob: Blob, filename: string): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}

