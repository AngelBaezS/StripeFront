import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideKeyRound,
  lucideMail,
  lucidePhone,
  lucideSave,
  lucideShield,
  lucideUser,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  if (newPassword && confirmPassword && newPassword !== confirmPassword) {
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-profile-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmAlertImports,
    HlmSpinnerImports,
    HlmAvatarImports,
    HlmSeparatorImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideKeyRound,
      lucideMail,
      lucidePhone,
      lucideSave,
      lucideShield,
      lucideUser,
    }),
  ],
  templateUrl: './profile-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage implements OnInit {
  private readonly fb = inject(FormBuilder);
  public readonly authService = inject(AuthService);

  public readonly isLoadingProfile = signal(false);
  public readonly isSavingUsername = signal(false);
  public readonly isSavingPassword = signal(false);
  public readonly usernameError = signal<string | null>(null);
  public readonly passwordError = signal<string | null>(null);

  public readonly backRoute = computed(() => this.authService.getDefaultRoute());

  public readonly userInitials = computed(() => {
    const name = this.authService.currentUsername();
    return name ? name.slice(0, 2).toUpperCase() : 'US';
  });

  public readonly usernameForm: FormGroup = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
  });

  public readonly passwordForm: FormGroup = this.fb.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(100)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator }
  );

  public ngOnInit(): void {
    const existing = this.authService.currentProfile();
    if (existing?.username) {
      this.usernameForm.patchValue({ username: existing.username });
    } else {
      this.usernameForm.patchValue({ username: this.authService.currentUsername() });
    }

    this.isLoadingProfile.set(true);
    this.authService.getProfile().subscribe({
      next: (profile) => {
        this.isLoadingProfile.set(false);
        this.usernameForm.patchValue({ username: profile.username });
      },
      error: () => {
        this.isLoadingProfile.set(false);
      },
    });
  }

  public isFieldInvalid(form: FormGroup, fieldName: string): boolean {
    const field = form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  public hasPasswordMismatch(): boolean {
    const confirm = this.passwordForm.get('confirmPassword');
    return !!(
      this.passwordForm.hasError('passwordMismatch') &&
      confirm &&
      (confirm.dirty || confirm.touched)
    );
  }

  public onUpdateUsername(): void {
    if (this.usernameForm.invalid) {
      this.usernameForm.markAllAsTouched();
      return;
    }

    const nextUsername = String(this.usernameForm.value.username ?? '').trim();
    this.isSavingUsername.set(true);
    this.usernameError.set(null);

    this.authService.updateUsername(nextUsername).subscribe({
      next: (response) => {
        this.isSavingUsername.set(false);
        this.usernameForm.patchValue({ username: response.profile.username });
        this.usernameForm.markAsPristine();
        toast.success('Nombre de usuario actualizado correctamente.');
      },
      error: (err) => {
        this.isSavingUsername.set(false);
        const msg =
          err?.error?.message ||
          (typeof err?.error === 'string' && err.error.length > 0
            ? err.error
            : 'No se pudo actualizar el nombre de usuario.');
        this.usernameError.set(msg);
        toast.error(msg);
      },
    });
  }

  public onUpdatePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.isSavingPassword.set(true);
    this.passwordError.set(null);

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.authService
      .updatePassword({
        currentPassword: String(currentPassword),
        newPassword: String(newPassword),
      })
      .subscribe({
        next: (response) => {
          this.isSavingPassword.set(false);
          this.passwordForm.reset();
          toast.success(response?.message || 'Contraseña actualizada correctamente.');
        },
        error: (err) => {
          this.isSavingPassword.set(false);
          const msg =
            err?.error?.message ||
            (typeof err?.error === 'string' && err.error.length > 0
              ? err.error
              : 'No se pudo actualizar la contraseña.');
          this.passwordError.set(msg);
          toast.error(msg);
        },
      });
  }
}

