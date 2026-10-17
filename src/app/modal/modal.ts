import { Component, input, output, ViewChild } from '@angular/core';
import { BrnDialogImports } from '@spartan-ng/brain/dialog';
import { HlmDialogImports, HlmDialog } from '@spartan-ng/helm/dialog';
import { HlmButton } from '@spartan-ng/helm/button';
import { CurrencyPipe } from '@angular/common';

@Component({
  imports: [BrnDialogImports, HlmDialogImports, HlmButton, CurrencyPipe],
  selector: 'app-modal',
  template: `
    <hlm-dialog #dialog [state]="state()" (closed)="modalClosed.emit()">
      <hlm-dialog-content *brnDialogContent="let ctx" class="sm:max-w-[425px]">
        <hlm-dialog-header>
          <h3 hlmDialogTitle class="text-2xl font-bold text-center">Confirmar Compra</h3>
          <p hlmDialogDescription class="mt-4 flex flex-col gap-2 text-base">
            <span class="truncate"><strong>ID de Orden:</strong> {{ paymentIntentId() }}</span>
            <span><strong>Producto:</strong> {{ name() }}</span>
            <span><strong>Descripción:</strong> {{ description() }}</span>
            <span><strong>Total:</strong> {{ price() | currency }}</span>
          </p>
        </hlm-dialog-header>
        <hlm-dialog-footer class="mt-6 flex justify-end gap-3">
          <button hlmBtn variant="outline" (click)="onCancel(); ctx.close()">Cancelar Compra</button>
          <button hlmBtn (click)="onConfirm(); ctx.close()">Confirmar Compra</button>
        </hlm-dialog-footer>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class Modal {
  @ViewChild('dialog') dialog!: HlmDialog;

  state = input<'open' | 'closed'>('closed');
  paymentIntentId = input<string>('');
  name = input<string>();
  description = input<string>();
  price = input<number>();

  confirm = output<string>();
  cancel = output<string>();
  modalClosed = output<void>();

  open(): void {
    this.dialog?.open();
  }

  close(): void {
    this.dialog?.close();
  }

  onConfirm(): void {
    this.confirm.emit(this.paymentIntentId());
  }

  onCancel(): void {
    this.cancel.emit(this.paymentIntentId());
  }
}
