import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideAlertTriangle, lucideXCircle } from '@ng-icons/lucide';

@Component({
  selector: 'app-cancel-order-dialog',
  imports: [HlmAlertDialogImports, HlmButtonImports, HlmSpinnerImports, NgIcon],
  providers: [
    provideIcons({
      lucideXCircle,
      lucideAlertTriangle,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-alert-dialog>
      <button
        hlmAlertDialogTrigger
        hlmBtn
        [variant]="triggerVariant()"
        [size]="triggerSize()"
        type="button"
        [disabled]="disabled() || isCanceling()"
        [class]="triggerClass()"
      >
        <ng-icon name="lucideXCircle" />
        <span>{{ triggerLabel() }}</span>
      </button>

      <hlm-alert-dialog-content *hlmAlertDialogPortal="let ctx">
        <hlm-alert-dialog-header>
          <hlm-alert-dialog-media class="bg-destructive/10 text-destructive">
            <ng-icon name="lucideAlertTriangle" />
          </hlm-alert-dialog-media>
          <h2 hlmAlertDialogTitle>¿Cancelar la orden?</h2>
          <p hlmAlertDialogDescription>
            Estás a punto de cancelar la orden
            <strong class="font-mono text-foreground">{{ orderId() }}</strong>.
            Se anulará el intento de pago en Stripe y no podrás retomarla después. Esta acción no se puede deshacer.
          </p>
        </hlm-alert-dialog-header>

        <hlm-alert-dialog-footer>
          <button
            hlmAlertDialogCancel
            type="button"
            [disabled]="isCanceling()"
            (click)="ctx.close()"
          >
            Volver
          </button>
          <button
            hlmAlertDialogAction
            variant="destructive"
            type="button"
            [disabled]="isCanceling()"
            (click)="onConfirm(ctx)"
            class="gap-2"
          >
            @if (isCanceling()) {
              <hlm-spinner />
              <span>Cancelando...</span>
            } @else {
              <ng-icon name="lucideXCircle" />
              <span>Sí, cancelar orden</span>
            }
          </button>
        </hlm-alert-dialog-footer>
      </hlm-alert-dialog-content>
    </hlm-alert-dialog>
  `,
})
export class CancelOrderDialog {
  public readonly orderId = input.required<string>();
  public readonly isCanceling = input<boolean>(false);
  public readonly disabled = input<boolean>(false);
  public readonly triggerLabel = input<string>('Cancelar Orden');
  public readonly triggerVariant = input<'destructive' | 'outline'>('destructive');
  public readonly triggerSize = input<'sm' | 'default'>('sm');
  public readonly triggerClass = input<string>('gap-1.5 w-full sm:w-auto text-xs');

  public readonly confirmed = output<() => void>();

  protected onConfirm(ctx: { close: () => void }): void {
    this.confirmed.emit(() => ctx.close());
  }
}
