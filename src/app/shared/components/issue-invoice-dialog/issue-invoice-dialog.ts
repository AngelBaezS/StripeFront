import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '@core/services/auth.service';
import { InvoiceService } from '@core/services/invoice.service';
import { InvoiceSummary } from '@shared/models/invoice.model';
import { ApiErrorResponse } from '@shared/models/order.model';
import {
  InvoiceFiscalFields,
  InvoiceFiscalFormGroup,
  createInvoiceFiscalForm,
} from '@shared/components/invoice-fiscal-fields/invoice-fiscal-fields';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFileText, lucideSend } from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';

@Component({
  selector: 'app-issue-invoice-dialog',
  imports: [
    ReactiveFormsModule,
    InvoiceFiscalFields,
    HlmDialogImports,
    HlmButtonImports,
    HlmAlertImports,
    HlmSpinnerImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideFileText,
      lucideSend,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-dialog [disableClose]="isSubmitting()">
      <button
        hlmDialogTrigger
        hlmBtn
        [variant]="triggerVariant()"
        [size]="triggerSize()"
        type="button"
        class="gap-1.5"
        [class]="triggerClass()"
        (click)="prefillDefaults()"
      >
        <ng-icon name="lucideFileText" />
        <span>{{ triggerLabel() }}</span>
      </button>

      <hlm-dialog-content
        *hlmDialogPortal="let ctx"
        class="sm:max-w-xl"
      >
        <div class="max-h-[85vh] overflow-y-auto space-y-4">
          <hlm-dialog-header>
            <h2 hlmDialogTitle class="flex items-center gap-2 text-lg font-semibold">
              <ng-icon name="lucideFileText" class="text-primary" />
              <span>Solicitar Factura</span>
            </h2>
            <p hlmDialogDescription>
              Captura tus datos fiscales para timbrar la orden
              <strong class="font-mono text-foreground">{{ orderId() }}</strong>.
              La factura se emitirá una única vez y se enviará en PDF y XML a tu correo.
            </p>
          </hlm-dialog-header>

          @if (errorMessage()) {
            <div hlmAlert variant="destructive">
              <p hlmAlertDescription>{{ errorMessage() }}</p>
            </div>
          }

          <form [formGroup]="invoiceForm" (ngSubmit)="onSubmit(ctx.close)" class="space-y-4">
            <app-invoice-fiscal-fields
              [form]="invoiceForm"
              [idPrefix]="'modal-' + orderId()"
            />

            <hlm-dialog-footer class="mt-5">
              <button
                hlmBtn
                variant="outline"
                type="button"
                [disabled]="isSubmitting()"
                (click)="ctx.close()"
              >
                Cancelar
              </button>
              <button
                hlmBtn
                type="submit"
                class="gap-2"
                [disabled]="isSubmitting()"
              >
                @if (isSubmitting()) {
                  <hlm-spinner />
                  <span>Timbrando CFDI...</span>
                } @else {
                  <ng-icon name="lucideSend" />
                  <span>Emitir y Enviar Factura</span>
                }
              </button>
            </hlm-dialog-footer>
          </form>
        </div>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class IssueInvoiceDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly invoiceService = inject(InvoiceService);
  private readonly authService = inject(AuthService);

  public readonly orderId = input.required<string>();
  public readonly initialInvoice = input<InvoiceSummary | null>(null);
  public readonly triggerLabel = input<string>('Solicitar Factura CFDI');
  public readonly triggerVariant = input<'default' | 'outline' | 'secondary' | 'ghost'>('outline');
  public readonly triggerSize = input<'default' | 'sm' | 'lg'>('sm');
  public readonly triggerClass = input<string>('w-full sm:w-auto text-xs');

  public readonly issued = output<InvoiceSummary>();

  public readonly isSubmitting = signal<boolean>(false);
  public readonly errorMessage = signal<string | null>(null);

  public readonly invoiceForm: InvoiceFiscalFormGroup = createInvoiceFiscalForm(this.fb);

  public ngOnInit(): void {
    this.prefillDefaults();
  }

  public prefillDefaults(): void {
    this.errorMessage.set(null);
    const existing = this.initialInvoice();

    this.invoiceForm.patchValue({
      rfc: existing?.rfc ?? this.invoiceForm.controls.rfc.value ?? '',
      legalName: existing?.legalName ?? this.invoiceForm.controls.legalName.value ?? '',
      zipCode: existing?.zipCode ?? this.invoiceForm.controls.zipCode.value ?? '',
      taxRegime: existing?.taxRegime ?? this.invoiceForm.controls.taxRegime.value ?? '612',
      cfdiUse: existing?.cfdiUse ?? this.invoiceForm.controls.cfdiUse.value ?? 'G03',
      email: existing?.email || this.invoiceForm.controls.email.value || '',
    });
  }

  public onSubmit(closeDialog?: () => void): void {
    if (this.isSubmitting()) return;

    this.invoiceForm.markAllAsTouched();
    if (this.invoiceForm.invalid) {
      this.errorMessage.set('Verifica que todos los campos fiscales obligatorios sean válidos.');
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    const payload = this.invoiceForm.getRawValue();
    this.invoiceService.issueInvoiceForOrder(this.orderId(), payload).subscribe({
      next: (summary) => {
        this.isSubmitting.set(false);
        this.issued.emit(summary);
        if (summary.emailSent === false) {
          toast.warning(
            `Factura timbrada (UUID: ${summary.uuid || summary.cfdiExpressId}), pero no se pudo enviar por correo.`
          );
        } else {
          toast.success(
            `Factura emitida (UUID: ${summary.uuid || summary.cfdiExpressId}) y enviada por correo.`
          );
        }
        closeDialog?.();
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        const msg =
          err instanceof HttpErrorResponse && err.error
            ? (err.error as ApiErrorResponse).message || 'No se pudo emitir la factura.'
            : 'No se pudo emitir la factura.';
        this.errorMessage.set(msg);
        toast.error(msg);
      },
    });
  }
}
