import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Header } from './header';
import { AuthService } from '@core/services/auth.service';
import { CartService } from '@features/cart/services/cart.service';
import { UserRole } from '@core/models/auth.model';

describe('Header role navigation', () => {
  const createAuthMock = (role: UserRole) => {
    const roleSignal = signal<UserRole | null>(role);
    return {
      isAuthenticated: signal(true),
      currentRole: roleSignal,
      currentUsername: signal(role === 'ADMIN' ? 'adminUser' : 'clientUser'),
      currentProfile: signal(null),
      hasRole: (required: UserRole | UserRole[]) => {
        const current = roleSignal();
        if (!current) return false;
        const allowed = Array.isArray(required) ? required : [required];
        return allowed.includes(current);
      },
      getDefaultRoute: () => (roleSignal() === 'ADMIN' ? '/admin/products' : '/products'),
      getProfile: () =>
        of({
          id: 'usr_1',
          username: role === 'ADMIN' ? 'adminUser' : 'clientUser',
          email: 'user@test.com',
          phone: '5512345678',
          role,
        }),
      logout: () => {},
    };
  };

  const cartMock = {
    totalItems: signal(0),
    getCart: () => of(null),
    resetLocalState: () => {},
  };

  it('should hide "Inicio" (/products) link and point brand logo to /admin/products for ADMIN', async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: createAuthMock('ADMIN') },
        { provide: CartService, useValue: cartMock },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();

    const navEl = fixture.nativeElement as HTMLElement;
    const links = Array.from(navEl.querySelectorAll('a')).map((a) => ({
      text: a.textContent?.trim() ?? '',
      href: a.getAttribute('href') ?? a.getAttribute('ng-reflect-router-link') ?? '',
    }));

    expect(links.some((l) => l.text === 'Inicio')).toBe(false);
    expect(links.some((l) => l.text.includes('Catálogo Admin'))).toBe(true);
    expect(fixture.componentInstance.homeRoute()).toBe('/admin/products');
  });

  it('should show "Inicio" (/products) link for CLIENT', async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: createAuthMock('CLIENT') },
        { provide: CartService, useValue: cartMock },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();

    const navEl = fixture.nativeElement as HTMLElement;
    const links = Array.from(navEl.querySelectorAll('a')).map((a) => a.textContent?.trim() ?? '');

    expect(links.some((t) => t === 'Inicio')).toBe(true);
    expect(links.some((t) => t.includes('Catálogo Admin'))).toBe(false);
    expect(fixture.componentInstance.homeRoute()).toBe('/products');
  });
});

