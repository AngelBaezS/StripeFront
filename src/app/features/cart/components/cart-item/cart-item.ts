import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { CartItemDetail } from '@shared/models/cart.model';
import { CentsToCurrencyPipe } from '@shared/pipes/cents-to-currency.pipe';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmButtonGroupImports } from '@spartan-ng/helm/button-group';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideTrash2,
  lucidePlus,
  lucideMinus,
  lucideImageOff,
  lucidePackageCheck,
} from '@ng-icons/lucide';

@Component({
  selector: 'app-cart-item',
  imports: [
    CentsToCurrencyPipe,
    HlmCardImports,
    HlmButtonImports,
    HlmButtonGroupImports,
    HlmBadgeImports,
    HlmSpinnerImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideTrash2,
      lucidePlus,
      lucideMinus,
      lucideImageOff,
      lucidePackageCheck,
    }),
  ],
  templateUrl: './cart-item.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartItemComponent {
  public readonly item = input.required<CartItemDetail>();
  public readonly isProcessing = input<boolean>(false);

  public readonly increment = output<CartItemDetail>();
  public readonly decrement = output<CartItemDetail>();
  public readonly remove = output<CartItemDetail>();

  public readonly imageError = signal(false);

  public onImageError(): void {
    this.imageError.set(true);
  }

  public onIncrement(): void {
    this.increment.emit(this.item());
  }

  public onDecrement(): void {
    this.decrement.emit(this.item());
  }

  public onRemove(): void {
    this.remove.emit(this.item());
  }
}

