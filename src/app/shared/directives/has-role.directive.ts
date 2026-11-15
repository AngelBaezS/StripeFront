import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { UserRole } from '@core/models/auth.model';
import { AuthService } from '@core/services/auth.service';

@Directive({
  selector: '[appHasRole]',
})
export class HasRoleDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly authService = inject(AuthService);

  public readonly appHasRole = input.required<UserRole | UserRole[]>();

  private hasView = false;

  constructor() {
    effect(() => {
      const required = this.appHasRole();
      const allowedRoles = Array.isArray(required) ? required : [required];
      const currentRole = this.authService.currentRole();
      const shouldShow = !!currentRole && allowedRoles.includes(currentRole);

      if (shouldShow && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!shouldShow && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }
}

