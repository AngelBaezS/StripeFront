import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CreateProductRequest } from '@shared/models/product.model';
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
  lucidePlusCircle,
  lucideImageOff,
  lucidePackagePlus,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';

@Component({
  selector: 'app-product-create',
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
      lucidePlusCircle,
      lucideImageOff,
      lucidePackagePlus,
    }),
  ],
  templateUrl: './product-create.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCreate {
  private readonly fb = inject(FormBuilder);
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);

  public readonly isLoading = signal(false);
  public readonly errorMessage = signal<string | null>(null);
  public readonly previewImageError = signal(false);

  public readonly productForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: ['', [Validators.required, Validators.minLength(5)]],
    stock: [null, [Validators.required, Validators.min(0)]],
    unitAmountCents: [null, [Validators.required, Validators.min(1)]],
    imageUrl: ['', [Validators.required]],
  });

  public isFieldInvalid(fieldName: string): boolean {
    const field = this.productForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  public onImageUrlInput(): void {
    this.previewImageError.set(false);
  }

  public onPreviewImageError(): void {
    this.previewImageError.set(true);
  }

  public onSubmit(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const raw = this.productForm.getRawValue();
    const payload: CreateProductRequest = {
      name: String(raw.name).trim(),
      description: String(raw.description).trim(),
      stock: Number(raw.stock),
      unitAmountCents: Number(raw.unitAmountCents),
      imageUrl: String(raw.imageUrl).trim(),
    };

    this.productService.createProduct(payload).subscribe({
      next: () => {
        this.isLoading.set(false);
        toast.success('Producto agregado exitosamente al catálogo');
        this.router.navigate(['/admin/products']);
      },
      error: (err) => {
        this.isLoading.set(false);
        const backendMsg = err?.error?.message || err?.error;
        const msg =
          typeof backendMsg === 'string' && backendMsg.length > 0
            ? backendMsg
            : 'No se pudo guardar el producto. Verifica los datos o tu sesión.';
        this.errorMessage.set(msg);
        toast.error(msg);
      },
    });
  }
}

