import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { IssueInvoiceDialog } from './issue-invoice-dialog';
import { InvoiceService } from '@core/services/invoice.service';
import { AuthService } from '@core/services/auth.service';
import { InvoiceSummary } from '@shared/models/invoice.model';

describe('IssueInvoiceDialog', () => {
  it('should open dialog, capture manual fiscal fields without presets and submit via ngSubmit', async () => {
    const stampedResponse: InvoiceSummary = {
      id: 'invo_modal_1',
      orderId: 'ord_modal_1',
      status: 'STAMPED',
      cfdiExpressId: 'cfdi_modal_1',
      uuid: 'UUID-MODAL-123',
      rfc: 'XAXX010101000',
      legalName: 'PUBLICO EN GENERAL',
      zipCode: '42501',
      taxRegime: '616',
      cfdiUse: 'S01',
      email: 'angelbaezs1512@gmail.com',
      hasPdf: true,
      hasXml: true,
      emailSent: true,
    };

    const invoiceServiceMock = {
      issueInvoiceForOrder: vi.fn().mockReturnValue(of(stampedResponse)),
    };

    await TestBed.configureTestingModule({
      imports: [IssueInvoiceDialog],
      providers: [
        { provide: InvoiceService, useValue: invoiceServiceMock },
        {
          provide: AuthService,
          useValue: {
            currentProfile: vi.fn().mockReturnValue({ email: 'angelbaezs1512@gmail.com' }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(IssueInvoiceDialog);
    fixture.componentRef.setInput('orderId', 'ord_modal_1');
    const emitted: InvoiceSummary[] = [];
    fixture.componentInstance.issued.subscribe((val) => emitted.push(val));
    fixture.detectChanges();

    const triggerBtn = fixture.nativeElement.querySelector('button[hlmDialogTrigger]') as HTMLButtonElement;
    expect(triggerBtn).toBeTruthy();
    triggerBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.invoiceForm.controls.email.value).toBe('');

    const presetBtns = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
    expect(presetBtns.some((b) => b.textContent?.includes('Público en General'))).toBe(false);
    expect(presetBtns.some((b) => b.textContent?.includes('Receptor Prueba SAT'))).toBe(false);

    fixture.componentInstance.invoiceForm.setValue({
      rfc: 'XAXX010101000',
      legalName: 'PUBLICO EN GENERAL',
      zipCode: '42501',
      taxRegime: '616',
      cfdiUse: 'S01',
      email: 'angelbaezs1512@gmail.com',
    });
    fixture.detectChanges();

    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitBtn).toBeTruthy();
    submitBtn.click();
    fixture.detectChanges();

    expect(invoiceServiceMock.issueInvoiceForOrder).toHaveBeenCalledWith('ord_modal_1', {
      rfc: 'XAXX010101000',
      legalName: 'PUBLICO EN GENERAL',
      zipCode: '42501',
      taxRegime: '616',
      cfdiUse: 'S01',
      email: 'angelbaezs1512@gmail.com',
    });
    expect(emitted).toEqual([stampedResponse]);
  });
});
