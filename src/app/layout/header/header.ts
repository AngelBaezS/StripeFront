import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { CartService } from '@features/cart/services/cart.service';
import { HasRoleDirective } from '@shared/directives/has-role.directive';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideShoppingBag,
  lucideShoppingCart,
  lucideUser,
  lucideLogOut,
  lucideHome,
  lucidePlusCircle,
  lucidePackage,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';

@Component({
  selector: 'app-header',
  imports: [
    RouterLink,
    RouterLinkActive,
    HasRoleDirective,
    HlmButtonImports,
    HlmBadgeImports,
    HlmAvatarImports,
    HlmDropdownMenuImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideShoppingBag,
      lucideShoppingCart,
      lucideUser,
      lucideLogOut,
      lucideHome,
      lucidePlusCircle,
      lucidePackage,
    }),
  ],
  templateUrl: './header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header implements OnInit {
  public readonly authService = inject(AuthService);
  public readonly cartService = inject(CartService);
  private readonly router = inject(Router);

  public readonly homeRoute = computed(() => this.authService.getDefaultRoute());

  public readonly userInitials = computed(() => {
    const name = this.authService.currentUsername();
    return name ? name.slice(0, 2).toUpperCase() : 'US';
  });

  constructor() {
    effect(() => {
      if (!this.authService.isAuthenticated()) {
        this.cartService.resetLocalState();
      }
    });
  }

  public ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.authService.getProfile().subscribe({
        next: (profile) => {
          if (profile?.role === 'CLIENT') {
            this.cartService.getCart().subscribe({ error: () => {} });
          }
        },
        error: () => {},
      });
    }
  }

  public onViewProfile(): void {
    this.router.navigate(['/profile']);
  }

  public onLogout(): void {
    this.cartService.resetLocalState();
    this.authService.logout();
    toast.info('Has cerrado sesión correctamente.');
  }

  public onGoToCart(): void {
    this.router.navigate(['/cart']);
  }
}
