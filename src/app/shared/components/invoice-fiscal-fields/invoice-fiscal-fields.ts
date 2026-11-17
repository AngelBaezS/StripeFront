import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  InvoiceRequestPayload,
  REGIMEN_FISCAL_OPTIONS,
  RFC_PATTERN,
  USO_CFDI_OPTIONS,
  ZIP_CODE_PATTERN,
} from '@shared/models/invoice.model';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmFieldImports } from '@spartan-ng/helm/field';

export type InvoiceFiscalFormGroup = FormGroup<{
  rfc: FormControl<string>;
  legalName: FormControl<string>;
  zipCode: FormControl<string>;
  taxRegime: FormControl<string>;
  cfdiUse: FormControl<string>;
  email: FormControl<string>;
}>;

export function createInvoiceFiscalForm(
  fb: FormBuilder,
  initial?: Partial<InvoiceRequestPayload>
): InvoiceFiscalFormGroup {
  return fb.nonNullable.group({
    rfc: [
      initial?.rfc ?? '',
      [Validators.required, Validators.pattern(RFC_PATTERN)],
    ],
    legalName: [
      initial?.legalName ?? '',
      [Validators.required, Validators.maxLength(255)],
    ],
    zipCode: [
      initial?.zipCode ?? '',
      [Validators.required, Validators.pattern(ZIP_CODE_PATTERN)],
    ],
    taxRegime: [initial?.taxRegime ?? '612', [Validators.required]],
    cfdiUse: [initial?.cfdiUse ?? 'G03', [Validators.required]],
    email: [
      initial?.email ?? '',
      [Validators.required, Validators.email],
    ],
  });
}

@Component({
  selector: 'app-invoice-fiscal-fields',
  imports: [
    ReactiveFormsModule,
    HlmInputImports,
    HlmNativeSelectImports,
    HlmFieldImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [formGroup]="form()" class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
      <div hlmField class="space-y-1">
        <label hlmFieldLabel [for]="idPrefix() + '-rfc'">RFC</label>
        <input
          hlmInput
          [id]="idPrefix() + '-rfc'"
          type="text"
          formControlName="rfc"
          maxlength="13"
          autocomplete="off"
          placeholder="RFC del receptor"
          class="uppercase font-mono"
        />
        @if (hasError('rfc')) {
          <hlm-field-error>Ingresa un RFC válido de 12 o 13 caracteres.</hlm-field-error>
        }
      </div>

      <div hlmField class="space-y-1">
        <label hlmFieldLabel [for]="idPrefix() + '-zip'">Código Postal Fiscal</label>
        <input
          hlmInput
          [id]="idPrefix() + '-zip'"
          type="text"
          formControlName="zipCode"
          maxlength="5"
          inputmode="numeric"
          autocomplete="off"
          placeholder="5 dígitos"
          class="font-mono"
        />
        @if (hasError('zipCode')) {
          <hlm-field-error>El código postal debe tener 5 dígitos.</hlm-field-error>
        }
      </div>

      <div hlmField class="space-y-1 sm:col-span-2">
        <label hlmFieldLabel [for]="idPrefix() + '-legal-name'">Nombre o Razón Social (como aparece en Constancia SAT)</label>
        <input
          hlmInput
          [id]="idPrefix() + '-legal-name'"
          type="text"
          formControlName="legalName"
          maxlength="255"
          autocomplete="off"
          placeholder="Nombre o razón social"
          class="uppercase"
        />
        @if (hasError('legalName')) {
          <hlm-field-error>La razón social es obligatoria.</hlm-field-error>
        }
      </div>

      <div hlmField class="space-y-1 sm:col-span-2">
        <label hlmFieldLabel [for]="idPrefix() + '-regime'">Régimen Fiscal</label>
        <hlm-native-select [selectId]="idPrefix() + '-regime'" formControlName="taxRegime" class="w-full">
          @for (opt of taxRegimes; track opt.code) {
            <option hlmNativeSelectOption [value]="opt.code">{{ opt.label }}</option>
          }
        </hlm-native-select>
      </div>

      <div hlmField class="space-y-1">
        <label hlmFieldLabel [for]="idPrefix() + '-cfdi-use'">Uso de CFDI</label>
        <hlm-native-select [selectId]="idPrefix() + '-cfdi-use'" formControlName="cfdiUse" class="w-full">
          @for (opt of cfdiUses; track opt.code) {
            <option hlmNativeSelectOption [value]="opt.code">{{ opt.label }}</option>
          }
        </hlm-native-select>
      </div>

      <div hlmField class="space-y-1">
        <label hlmFieldLabel [for]="idPrefix() + '-email'">Correo para Factura (PDF y XML)</label>
        <input
          hlmInput
          [id]="idPrefix() + '-email'"
          type="email"
          formControlName="email"
          autocomplete="off"
          placeholder="correo@dominio.com"
        />
        @if (hasError('email')) {
          <hlm-field-error>Ingresa un correo electrónico válido.</hlm-field-error>
        }
      </div>
    </div>
  `,
})
export class InvoiceFiscalFields {
  public readonly form = input.required<InvoiceFiscalFormGroup>();
  public readonly idPrefix = input<string>('cfdi');

  protected readonly taxRegimes = REGIMEN_FISCAL_OPTIONS;
  protected readonly cfdiUses = USO_CFDI_OPTIONS;

  protected hasError(controlName: keyof InvoiceRequestPayload): boolean {
    const ctrl = this.form().get(controlName);
    return !!ctrl && ctrl.invalid && (ctrl.touched || ctrl.dirty);
  }
}
