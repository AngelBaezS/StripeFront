import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { computed, signal, Signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProfilePage } from './profile-page';
import { AuthService } from '@core/services/auth.service';
import { UserProfileResponse, UserRole } from '@core/models/auth.model';

describe('ProfilePage', () => {
  let fixture: ComponentFixture<ProfilePage>;
  let component: ProfilePage;

  const clientProfile: UserProfileResponse = {
    id: 'usr_123',
    username: 'angel_client',
    email: 'angel@correo.com',
    phone: '5512345678',
    role: 'CLIENT',
  };

  let mockProfileSignal: ReturnType<typeof signal<UserProfileResponse | null>>;
  let mockUsernameSignal: ReturnType<typeof signal<string>>;
  let authServiceMock: {
    currentProfile: ReturnType<typeof signal<UserProfileResponse | null>>;
    currentUsername: ReturnType<typeof signal<string>>;
    currentRole: Signal<UserRole | null>;
    getDefaultRoute: ReturnType<typeof vi.fn>;
    getProfile: ReturnType<typeof vi.fn>;
    updateUsername: ReturnType<typeof vi.fn>;
    updatePassword: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockProfileSignal = signal<UserProfileResponse | null>(clientProfile);
    mockUsernameSignal = signal<string>(clientProfile.username);

    authServiceMock = {
      currentProfile: mockProfileSignal,
      currentUsername: mockUsernameSignal,
      currentRole: computed(() => mockProfileSignal()?.role ?? null),
      getDefaultRoute: vi.fn(() =>
        mockProfileSignal()?.role === 'ADMIN' ? '/admin/products' : '/products'
      ),
      getProfile: vi.fn(() => of(mockProfileSignal() ?? clientProfile)),
      updateUsername: vi.fn((username: string) => {
        const updated: UserProfileResponse = {
          ...(mockProfileSignal() ?? clientProfile),
          username,
        };
        mockProfileSignal.set(updated);
        mockUsernameSignal.set(username);
        return of({
          token: 'new.jwt.token',
          profile: updated,
        });
      }),
      updatePassword: vi.fn(() =>
        of({ message: 'Contraseña actualizada correctamente.' })
      ),
    };

    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load profile details on init and resolve CLIENT backRoute', () => {
    expect(authServiceMock.getProfile).toHaveBeenCalled();
    expect(component.usernameForm.value.username).toBe('angel_client');
    expect(component.backRoute()).toBe('/products');

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('angel_client');
    expect(text).toContain('angel@correo.com');
    expect(text).toContain('5512345678');
    expect(text).toContain('CLIENT');
  });

  it('should resolve ADMIN backRoute to /admin/products', async () => {
    const adminProfile: UserProfileResponse = {
      id: 'usr_admin',
      username: 'admin_user',
      email: 'admin@correo.com',
      phone: '5500000000',
      role: 'ADMIN',
    };
    mockProfileSignal.set(adminProfile);
    mockUsernameSignal.set(adminProfile.username);

    const adminFixture = TestBed.createComponent(ProfilePage);
    adminFixture.detectChanges();

    expect(adminFixture.componentInstance.backRoute()).toBe('/admin/products');
    expect(adminFixture.nativeElement.textContent).toContain('ADMIN');
  });

  it('should update username when form is valid', () => {
    component.usernameForm.patchValue({ username: 'angel_nuevo' });
    component.onUpdateUsername();

    expect(authServiceMock.updateUsername).toHaveBeenCalledWith('angel_nuevo');
    expect(component.usernameForm.value.username).toBe('angel_nuevo');
    expect(component.usernameError()).toBeNull();
  });

  it('should validate password mismatch and skip API call', () => {
    component.passwordForm.patchValue({
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword123',
      confirmPassword: 'differentPassword',
    });
    component.passwordForm.get('confirmPassword')?.markAsTouched();

    expect(component.hasPasswordMismatch()).toBe(true);
    component.onUpdatePassword();
    expect(authServiceMock.updatePassword).not.toHaveBeenCalled();
  });

  it('should show error message when currentPassword is rejected', () => {
    authServiceMock.updatePassword.mockReturnValueOnce(
      throwError(() => ({
        error: { message: 'La contraseña actual es incorrecta.' },
      }))
    );

    component.passwordForm.patchValue({
      currentPassword: 'wrongPassword',
      newPassword: 'newPassword123',
      confirmPassword: 'newPassword123',
    });
    component.onUpdatePassword();
    fixture.detectChanges();

    expect(component.passwordError()).toBe('La contraseña actual es incorrecta.');
    expect(fixture.nativeElement.textContent).toContain(
      'La contraseña actual es incorrecta.'
    );
  });

  it('should reset password form when password update succeeds', () => {
    component.passwordForm.patchValue({
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword123',
      confirmPassword: 'newPassword123',
    });
    component.onUpdatePassword();

    expect(authServiceMock.updatePassword).toHaveBeenCalledWith({
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword123',
    });
    expect(component.passwordForm.value.currentPassword).toBeNull();
    expect(component.passwordForm.value.newPassword).toBeNull();
    expect(component.passwordForm.value.confirmPassword).toBeNull();
  });
});
