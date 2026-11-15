import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Product } from '@shared/models/product.model';
import { ProductService } from '@features/products/services/product.service';
import { CartService } from '@features/cart/services/cart.service';
import { ProductCard } from '@features/products/components/product-card/product-card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideRefreshCw, lucidePackageOpen } from '@ng-icons/lucide';

@Component({
  selector: 'app-product-list',
  imports: [
    FormsModule,
    ProductCard,
    HlmInputImports,
    HlmButtonImports,
    HlmSkeletonImports,
    HlmCardImports,
    HlmAlertImports,
    HlmEmptyImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideSearch,
      lucideRefreshCw,
      lucidePackageOpen,
    }),
  ],
  templateUrl: './product-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductList implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);

  public readonly products = signal<Product[]>([]);
  public readonly isLoading = signal<boolean>(true);
  public readonly errorMessage = signal<string | null>(null);
  public readonly searchQuery = signal<string>('');
  public readonly addingProductId = signal<string | null>(null);

  public readonly skeletonItems = [1, 2, 3, 4, 5, 6, 7, 8];

  public readonly filteredProducts = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.products();
    if (!query) return list;

    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
    );
  });

  public ngOnInit(): void {
    this.loadProducts();
  }

  public loadProducts(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.productService.getProducts().subscribe({
      next: (data) => {
        this.products.set(data ?? []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg =
          err?.error?.message ||
          'No se pudieron cargar los productos. Verifica tu sesión o la conexión con el servidor.';
        this.errorMessage.set(msg);
      },
    });
  }

  public onSearchChange(value: string): void {
    this.searchQuery.set(value);
  }

  public onAddToCart(product: Product): void {
    this.addingProductId.set(product.id);
    this.cartService.addItem(product.id, 1, product.name).subscribe({
      next: () => this.addingProductId.set(null),
      error: () => this.addingProductId.set(null),
    });
  }
}
