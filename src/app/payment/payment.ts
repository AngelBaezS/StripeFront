import { Component, input, signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { StripeCardElementOptions, StripeElementsOptions } from '@stripe/stripe-js';
import { injectStripe, StripeService, StripeElementsDirective, StripeCardComponent } from 'ngx-stripe';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Modal } from '../modal/modal';
import { Router, RouterLink } from '@angular/router';
import { HlmField, HlmFieldLabel } from '@spartan-ng/helm/field';
import { PaymentService } from './payment-service';
import { PaymentIntentDto } from '../model/payment-intent-dto';
import { toast } from '@spartan-ng/brain/sonner';

@Component({
  imports: [
    ReactiveFormsModule,
    HlmInput,
    HlmButton,
    Modal,
    RouterLink,
    StripeElementsDirective,
    StripeCardComponent,
    HlmField,
    HlmFieldLabel,
  ],
  selector: 'app-payment',
  template: `
    <div [formGroup]="stripeForm" class="px-6">
      <hlm-field>
        <label hlmFieldLabel for="name">Nombre del titular</label>
        <input hlmInput id="name" placeholder="Ej. Juan Pérez" formControlName="name" />
      </hlm-field>

      <div class="my-4 p-3 border border-border/50 rounded-xl bg-input/50 min-h-[42px]">
        <ngx-stripe-elements
          [stripe]="stripe"
          [elementsOptions]="elementsOptions"
        >
          <ngx-stripe-card [options]="cardOptions" />
        </ngx-stripe-elements>
      </div>

      @if (error) {
        <p class="text-sm font-medium text-destructive mb-2">{{ error }}</p>
      }

      <div class="flex justify-between items-center mt-4">
        <button hlmBtn variant="outline" routerLink="/" class="w-36">Cancel</button>
        <button hlmBtn (click)="buy()" [disabled]="isGeneratingOrder()" class="w-36">
          @if (isGeneratingOrder()) {
            Generando...
          } @else {
            Buy
          }
        </button>
      </div>

      <app-modal
        #modal
        [state]="modalState()"
        [paymentIntentId]="currentPaymentIntentId()"
        [name]="name()"
        [description]="description()"
        [price]="price()"
        (confirm)="confirmOrder($event)"
        (cancel)="cancelOrder($event)"
        (modalClosed)="onModalClosed()"
      />
    </div>
  `,
})
export class Payment {
  @ViewChild(StripeCardComponent)
  card!: StripeCardComponent;

  @ViewChild('modal')
  modal!: Modal;

  id = input<number>(0);
  name = input<string>();
  description = input<string>();
  price = input<number>();

  error: string | null = null;
  currentPaymentIntentId = signal<string>('');
  modalState = signal<'open' | 'closed'>('closed');
  isGeneratingOrder = signal<boolean>(false);

  stripe = injectStripe();

  elementsOptions: StripeElementsOptions = {
    locale: 'es',
  };

  cardOptions: StripeCardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#32325d',
        fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#fa755a',
        iconColor: '#fa755a',
      },
    },
  };

  constructor(
    private stripeService: StripeService,
    private paymentService: PaymentService,
    private router: Router
  ) { }

  public stripeForm = new FormGroup({
    name: new FormControl('', Validators.required),
  });

  // Paso 1: Al dar clic en Buy, se genera la orden en Stripe y se abre el modal
  buy(): void {
    if (this.stripeForm.invalid) {
      this.error = 'Por favor, ingresa el nombre del titular.';
      toast.error(this.error);
      return;
    }

    const name = this.stripeForm.get('name')?.value || '';
    this.isGeneratingOrder.set(true);
    this.error = null;

    toast.loading('Generando orden en Stripe...', { id: 'order-toast' });

    this.stripeService
      .createToken(this.card.element, { name })
      .subscribe({
        next: (result) => {
          if (result.token) {
            const paymentIntentDto: PaymentIntentDto = {
              token: result.token.id,
              description: this.description() || '',
              amount: (this.price()! * 100 || 0),
              currency: 'usd',
            };

            // Crear el PaymentIntent en el backend (POST /stripe/paymentintent)
            this.paymentService.buy(paymentIntentDto).subscribe({
              next: (response: any) => {
                this.isGeneratingOrder.set(false);
                console.log('Payment Intent creado en el backend:', response);

                // Extraer el ID real de Stripe (pi_...)
                let stripePaymentIntentId = '';
                if (response && typeof response === 'object' && 'id' in response) {
                  stripePaymentIntentId = response.id;
                } else if (typeof response === 'string') {
                  try {
                    const parsed = JSON.parse(response);
                    stripePaymentIntentId = parsed.id || (typeof parsed === 'string' ? parsed : response);
                  } catch {
                    stripePaymentIntentId = response;
                  }
                } else if (response) {
                  stripePaymentIntentId = String(response);
                }

                stripePaymentIntentId = stripePaymentIntentId ? stripePaymentIntentId.trim() : '';

                if (!stripePaymentIntentId || stripePaymentIntentId === 'undefined' || stripePaymentIntentId === 'null') {
                  this.error = 'No se recibió un ID válido de PaymentIntent desde el backend.';
                  toast.error(this.error, { id: 'order-toast' });
                  console.error('Respuesta recibida del backend:', response);
                  return;
                }

                console.log('Orden creada con Stripe ID:', stripePaymentIntentId);
                toast.success('Orden generada. Confirma o cancela en el modal.', { id: 'order-toast' });

                // Almacenamos el ID y abrimos el modal
                this.currentPaymentIntentId.set(stripePaymentIntentId);
                this.modalState.set('open');
                this.modal.open();
              },
              error: (err) => {
                this.isGeneratingOrder.set(false);
                this.error = err.error?.message || err.message || 'Error al generar la orden';
                toast.error(this.error!, { id: 'order-toast' });
              },
            });
          } else if (result.error) {
            this.isGeneratingOrder.set(false);
            this.error = result.error.message || 'Error al procesar la tarjeta';
            toast.error(this.error!, { id: 'order-toast' });
          }
        },
        error: (err) => {
          this.isGeneratingOrder.set(false);
          this.error = err.message || 'Error con el servicio de Stripe';
          toast.error(this.error!, { id: 'order-toast' });
        },
      });
  }

  // Paso 2A: Confirmar compra desde el modal (POST /stripe/confirm/{id})
  confirmOrder(paymentIntentId: string): void {
    toast.loading('Confirmando compra en Stripe...', { id: 'confirm-toast' });

    this.paymentService.confirmPayment(paymentIntentId).subscribe({
      next: (confirmRes) => {
        console.log('Pago confirmado exitosamente en Stripe:', confirmRes);
        toast.success('Pago confirmado con éxito', { id: 'confirm-toast' });
        this.modalState.set('closed');
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.error = err.error?.message || err.message || 'Error al confirmar el pago';
        toast.error(this.error!, { id: 'confirm-toast' });
      },
    });
  }

  // Paso 2B: Cancelar compra desde el modal (POST /stripe/cancel/{id})
  cancelOrder(paymentIntentId: string): void {
    toast.loading('Cancelando orden en Stripe...', { id: 'cancel-toast' });

    this.paymentService.cancelPayment(paymentIntentId).subscribe({
      next: (cancelRes) => {
        console.log('Orden cancelada exitosamente en Stripe:', cancelRes);
        toast.info('Compra cancelada con éxito', { id: 'cancel-toast' });
        this.modalState.set('closed');
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.error = err.error?.message || err.message || 'Error al cancelar la orden';
        toast.error(this.error!, { id: 'cancel-toast' });
      },
    });
  }

  onModalClosed(): void {
    this.modalState.set('closed');
  }
}
