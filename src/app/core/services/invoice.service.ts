import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { InvoiceRequestPayload, InvoiceSummary } from '@shared/models/invoice.model';

const CHECKOUT_DRAFT_KEY = 'payment_cfdi_draft_order_';

@Injectable({
  providedIn: 'root',
})
export class InvoiceService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/api/v1/invoices`;

  public saveCheckoutInvoiceRequest(
    orderId: string,
    payload: InvoiceRequestPayload
  ): Observable<InvoiceSummary> {
    return this.http.post<InvoiceSummary>(
      `${this.apiUrl}/order/${encodeURIComponent(orderId)}`,
      this.normalizePayload(payload)
    );
  }

  public issueInvoiceForOrder(
    orderId: string,
    payload: InvoiceRequestPayload
  ): Observable<InvoiceSummary> {
    return this.http.post<InvoiceSummary>(
      `${this.apiUrl}/order/${encodeURIComponent(orderId)}/issue`,
      this.normalizePayload(payload)
    );
  }

  public resendInvoiceEmail(orderId: string, email?: string): Observable<InvoiceSummary> {
    const trimmed = email?.trim();
    const body = trimmed ? { email: trimmed.toLowerCase() } : null;
    return this.http.post<InvoiceSummary>(
      `${this.apiUrl}/order/${encodeURIComponent(orderId)}/resend-email`,
      body
    );
  }

  public getInvoiceForOrder(orderId: string): Observable<InvoiceSummary | null> {
    return this.http
      .get<InvoiceSummary | null>(`${this.apiUrl}/order/${encodeURIComponent(orderId)}`, {
        observe: 'response',
      })
      .pipe(map((resp) => (resp.status === 204 ? null : (resp.body ?? null))));
  }

  public downloadInvoicePdf(orderId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/order/${encodeURIComponent(orderId)}/pdf`, {
      responseType: 'blob',
    });
  }

  public downloadInvoiceXml(orderId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/order/${encodeURIComponent(orderId)}/xml`, {
      responseType: 'blob',
    });
  }

  public saveOrderDraft(orderId: string, payload: InvoiceRequestPayload): void {
    if (typeof sessionStorage === 'undefined' || !orderId) return;
    try {
      sessionStorage.setItem(
        `${CHECKOUT_DRAFT_KEY}${orderId}`,
        JSON.stringify(this.normalizePayload(payload))
      );
    } catch {
      // Ignorar si sessionStorage no está disponible
    }
  }

  public clearOrderDraft(orderId: string): void {
    if (typeof sessionStorage === 'undefined' || !orderId) return;
    try {
      sessionStorage.removeItem(`${CHECKOUT_DRAFT_KEY}${orderId}`);
    } catch {
      // Ignorar
    }
  }

  private normalizePayload(payload: InvoiceRequestPayload): InvoiceRequestPayload {
    return {
      rfc: payload.rfc.trim().toUpperCase(),
      legalName: payload.legalName.trim().toUpperCase(),
      zipCode: payload.zipCode.trim(),
      taxRegime: payload.taxRegime.trim(),
      cfdiUse: payload.cfdiUse.trim().toUpperCase(),
      email: payload.email.trim().toLowerCase(),
    };
  }
}
