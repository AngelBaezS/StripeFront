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
  selector: 'app-login',
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
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  public readonly isLoading = signal(false);
  public readonly errorMessage = signal<string | null>(null);

  public readonly loginForm: FormGroup = this.fb.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  public isFieldInvalid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  public onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        this.isLoading.set(false);
        toast.success('¡Bienvenido! Sesión iniciada correctamente.');
        this.router.navigate([this.authService.getDefaultRoute()]);
      },
      error: (err) => {
        this.isLoading.set(false);
        const backendMsg = err?.error?.message || err?.error;
        const msg = typeof backendMsg === 'string' && backendMsg.length > 0
          ? backendMsg
          : 'Credenciales inválidas. Por favor verifica tu usuario y contraseña.';
        this.errorMessage.set(msg);
        toast.error(msg);
      },
    });
  }
}

