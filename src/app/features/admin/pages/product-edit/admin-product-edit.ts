import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Product } from '@shared/models/product.model';
import { ProductService } from '@features/products/services/product.service';
import { CentsToCurrencyPipe } from '@shared/pipes/cents-to-currency.pipe';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideCheck,
  lucideImageOff,
  lucideDollarSign,
  lucideTag,
  lucideLock,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';

@Component({
  selector: 'app-admin-product-edit',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    CentsToCurrencyPipe,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmTextareaImports,
    HlmButtonImports,
    HlmSpinnerImports,
    HlmAlertImports,
    HlmBadgeImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideCheck,
      lucideImageOff,
      lucideDollarSign,
      lucideTag,
      lucideLock,
    }),
  ],
  templateUrl: './admin-product-edit.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProductEdit implements OnInit {
  public readonly id = input.required<string>();

  private readonly fb = inject(FormBuilder);
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);

  public readonly product = signal<Product | null>(null);
  public readonly isLoadingProduct = signal<boolean>(true);
  public readonly isSubmitting = signal<boolean>(false);
  public readonly errorMessage = signal<string | null>(null);
  public readonly imageError = signal<boolean>(false);

  public readonly priceForm: FormGroup = this.fb.group({
    id: [{ value: '', disabled: true }],
    name: [{ value: '', disabled: true }],
    description: [{ value: '', disabled: true }],
    stock: [{ value: 0, disabled: true }],
    imageUrl: [{ value: '', disabled: true }],
    unitAmountCents: [null, [Validators.required, Validators.min(1)]],
  });

  public readonly previewPriceCents = computed(() => {
    const entered = this.priceForm.get('unitAmountCents')?.value;
    if (entered !== null && entered !== undefined && !isNaN(entered) && entered > 0) {
      return Number(entered);
    }
    return this.product()?.unitAmountCents ?? 0;
  });

  public ngOnInit(): void {
    this.loadProductData();
  }

  public loadProductData(): void {
    this.isLoadingProduct.set(true);
    this.errorMessage.set(null);

    this.productService.getAdminProducts().subscribe({
      next: (list) => {
        const found = list.find((p) => p.id === this.id());
        if (found) {
          this.product.set(found);
          this.priceForm.patchValue({
            id: found.id,
            name: found.name,
            description: found.description,
            stock: found.stock ?? 0,
            imageUrl: found.imageUrl,
            unitAmountCents: found.unitAmountCents,
          });
        } else {
          this.errorMessage.set(`No se encontró ningún producto con el ID "${this.id()}".`);
        }
        this.isLoadingProduct.set(false);
      },
      error: (err) => {
        this.isLoadingProduct.set(false);
        const msg =
          err?.error?.message ||
          'No se pudo obtener la información del producto.';
        this.errorMessage.set(msg);
      },
    });
  }

  public isFieldInvalid(fieldName: string): boolean {
    const field = this.priceForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  public onImageError(): void {
    this.imageError.set(true);
  }

  public onSubmit(): void {
    if (this.priceForm.invalid) {
      this.priceForm.markAllAsTouched();
      return;
    }

    const currentProd = this.product();
    if (!currentProd) return;

    const newUnitAmountCents = Number(this.priceForm.get('unitAmountCents')?.value);
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.productService.updateProductPrice(this.id(), newUnitAmountCents).subscribe({
      next: (updatedProduct) => {
        this.isSubmitting.set(false);
        const name = updatedProduct?.name || currentProd.name;
        toast.success(`Precio de "${name}" actualizado exitosamente.`);
        this.router.navigate(['/admin/products']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const backendMsg = err?.error?.message || err?.error;
        const msg =
          typeof backendMsg === 'string' && backendMsg.length > 0
            ? backendMsg
            : 'Error al actualizar el precio en el servidor o Stripe.';
        this.errorMessage.set(msg);
        toast.error(msg);
      },
    });
  }
}

