import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { toast } from '@spartan-ng/brain/sonner';

@Component({
  selector: 'app-register',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmButtonImports,
    HlmSpinnerImports,
    HlmAlertImports,
  ],
  templateUrl: './register.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  public readonly isLoading = signal(false);
  public readonly errorMessage = signal<string | null>(null);

  public readonly registerForm: FormGroup = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s()]{7,15}$/)]],
  });

  public isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  public onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.register(this.registerForm.value).subscribe({
      next: () => {
        this.isLoading.set(false);
        toast.success('¡Registro exitoso! Por favor inicia sesión.');
        this.router.navigate(['/auth/login']);
      },
      error: (err) => {
        this.isLoading.set(false);
        const backendMsg = err?.error?.message || err?.error;
        const msg = typeof backendMsg === 'string' && backendMsg.length > 0
          ? backendMsg
          : 'Ocurrió un error al registrar el usuario. Por favor intenta de nuevo.';
        this.errorMessage.set(msg);
        toast.error(msg);
      },
    });
  }
}

