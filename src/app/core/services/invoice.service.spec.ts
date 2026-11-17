import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { InvoiceService } from './invoice.service';
import { environment } from '@env/environment';
import { InvoiceSummary } from '@shared/models/invoice.model';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), InvoiceService],
    });
    service = TestBed.inject(InvoiceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should normalize fiscal payload and save checkout invoice request', () => {
    const mockSummary: InvoiceSummary = {
      id: 'invo_1',
      orderId: 'ord_10',
      status: 'PENDING_PAYMENT',
      rfc: 'XIA190128J61',
      legalName: 'XENON INDUSTRIAL',
      zipCode: '01160',
      taxRegime: '601',
      cfdiUse: 'G03',
      email: 'facturas@empresa.mx',
      hasPdf: false,
      hasXml: false,
    };

    service
      .saveCheckoutInvoiceRequest('ord_10', {
        rfc: ' xia190128j61 ',
        legalName: ' Xenon Industrial ',
        zipCode: ' 01160 ',
        taxRegime: '601',
        cfdiUse: 'g03',
        email: 'Facturas@Empresa.MX ',
      })
      .subscribe((res) => {
        expect(res).toEqual(mockSummary);
      });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/invoices/order/ord_10`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      rfc: 'XIA190128J61',
      legalName: 'XENON INDUSTRIAL',
      zipCode: '01160',
      taxRegime: '601',
      cfdiUse: 'G03',
      email: 'facturas@empresa.mx',
    });
    req.flush(mockSummary);
  });

  it('should issue invoice post-purchase and download PDF/XML blobs', () => {
    const mockSummary: InvoiceSummary = {
      id: 'invo_2',
      orderId: 'ord_20',
      status: 'STAMPED',
      cfdiExpressId: 'inv_123',
      uuid: 'UUID-CFDI-123',
      rfc: 'EKU9003173C9',
      legalName: 'ESCUELA KEMPER',
      zipCode: '76000',
      taxRegime: '601',
      cfdiUse: 'G03',
      email: 'cfdi@kemper.mx',
      hasPdf: true,
      hasXml: true,
    };

    service
      .issueInvoiceForOrder('ord_20', {
        rfc: 'EKU9003173C9',
        legalName: 'ESCUELA KEMPER',
        zipCode: '76000',
        taxRegime: '601',
        cfdiUse: 'G03',
        email: 'cfdi@kemper.mx',
      })
      .subscribe((res) => {
        expect(res.status).toBe('STAMPED');
        expect(res.uuid).toBe('UUID-CFDI-123');
      });

    const issueReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/invoices/order/ord_20/issue`);
    expect(issueReq.request.method).toBe('POST');
    issueReq.flush(mockSummary);

    const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    service.downloadInvoicePdf('ord_20').subscribe((blob) => {
      expect(blob.size).toBe(pdfBlob.size);
    });
    const pdfReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/invoices/order/ord_20/pdf`);
    expect(pdfReq.request.responseType).toBe('blob');
    pdfReq.flush(pdfBlob);

    const xmlBlob = new Blob(['<cfdi/>'], { type: 'application/xml' });
    service.downloadInvoiceXml('ord_20').subscribe((blob) => {
      expect(blob.size).toBe(xmlBlob.size);
    });
    const xmlReq = httpMock.expectOne(`${environment.apiUrl}/api/v1/invoices/order/ord_20/xml`);
    expect(xmlReq.request.responseType).toBe('blob');
    xmlReq.flush(xmlBlob);
  });

  it('should call resend-email endpoint with normalized email when resending stamped invoice', () => {
    const mockSummary: InvoiceSummary = {
      id: 'invo_2',
      orderId: 'ord_20',
      status: 'STAMPED',
      uuid: 'UUID-CFDI-123',
      rfc: 'EKU9003173C9',
      legalName: 'ESCUELA KEMPER',
      zipCode: '76000',
      taxRegime: '601',
      cfdiUse: 'G03',
      email: 'angelbaezs1512@gmail.com',
      hasPdf: true,
      hasXml: true,
      emailSent: true,
    };

    service.resendInvoiceEmail('ord_20', 'AngelBaezS1512@gmail.com ').subscribe((res) => {
      expect(res.emailSent).toBe(true);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/invoices/order/ord_20/resend-email`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'angelbaezs1512@gmail.com' });
    req.flush(mockSummary);
  });
});
