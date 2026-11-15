import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { Product } from '@shared/models/product.model';
import { CentsToCurrencyPipe } from '@shared/pipes/cents-to-currency.pipe';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShoppingCart, lucideImageOff, lucidePencil } from '@ng-icons/lucide';

@Component({
  selector: 'app-product-card',
  imports: [
    RouterLink,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmSpinnerImports,
    CentsToCurrencyPipe,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideShoppingCart,
      lucideImageOff,
      lucidePencil,
    }),
  ],
  templateUrl: './product-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCard {
  public readonly authService = inject(AuthService);
  public readonly product = input.required<Product>();
  public readonly isAdding = input<boolean>(false);
  public readonly addToCart = output<Product>();

  public readonly imageError = signal(false);

  public onImageError(): void {
    this.imageError.set(true);
  }

  public onAdd(): void {
    this.addToCart.emit(this.product());
  }
}
