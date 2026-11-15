import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Product } from '@shared/models/product.model';
import { ProductService } from '@features/products/services/product.service';
import { CentsToCurrencyPipe } from '@shared/pipes/cents-to-currency.pipe';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucidePlus,
  lucidePencil,
  lucideRefreshCw,
  lucidePackage,
  lucideImageOff,
} from '@ng-icons/lucide';

@Component({
  selector: 'app-admin-product-list',
  imports: [
    FormsModule,
    RouterLink,
    CentsToCurrencyPipe,
    HlmTableImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    HlmSkeletonImports,
    HlmEmptyImports,
    HlmAlertImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideSearch,
      lucidePlus,
      lucidePencil,
      lucideRefreshCw,
      lucidePackage,
      lucideImageOff,
    }),
  ],
  templateUrl: './admin-product-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProductList implements OnInit {
  private readonly productService = inject(ProductService);

  public readonly products = signal<Product[]>([]);
  public readonly isLoading = signal<boolean>(true);
  public readonly errorMessage = signal<string | null>(null);
  public readonly searchQuery = signal<string>('');
  public readonly skeletonRows = [1, 2, 3, 4, 5];

  public readonly filteredProducts = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.products();
    if (!query) return list;

    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.id?.toLowerCase().includes(query) ||
        p.stripeProductId?.toLowerCase().includes(query) ||
        p.stripePriceId?.toLowerCase().includes(query)
    );
  });

  public ngOnInit(): void {
    this.loadProducts();
  }

  public loadProducts(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.productService.getAdminProducts().subscribe({
      next: (data) => {
        this.products.set(data ?? []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg =
          err?.error?.message ||
          'No se pudieron cargar los productos de administración. Verifica tu sesión.';
        this.errorMessage.set(msg);
      },
    });
  }

  public onSearchChange(val: string): void {
    this.searchQuery.set(val);
  }
}

