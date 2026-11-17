import { InvoiceSummary } from '@shared/models/invoice.model';

export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED';

export interface SpeiPaymentDetails {
  clabe: string | null;
  bankName: string | null;
  bankCode: string | null;
  reference: string | null;
  hostedInstructionsUrl: string | null;
  amountCents: number | null;
  currency: string | null;
  orderId?: string | null;
  recipientEmail?: string | null;
  expiresAt?: string | null;
}

export interface StripePaymentResult {
  stripeId: string;            // pi_... o cs_test_...
  clientSecret: string | null; // Presente en POST /api/v1/order/direct-payment
  paymentUrl: string | null;   // Presente en POST /api/v1/order/payment-link o hostedInstructionsUrl SPEI
  status: OrderStatus;
  speiDetails?: SpeiPaymentDetails | null;
  orderId?: string | null;
}

export interface OrderItemDetail {
  productId: string;
  productName: string;
  unitAmountCents: number;
  quantity: number;
  subtotalCents: number;
  imageUrl?: string;
}

export interface OrderDetail {
  id: string;
  userId: string;
  cartId?: string;
  stripePaymentIntentId?: string;
  paymentUrl?: string;
  totalAmountCents: number;
  currency: string;
  status: OrderStatus;
  createdAt?: string;
  expiresAt?: string;
  canceledAt?: string;
  items: OrderItemDetail[];
  invoice?: InvoiceSummary | null;
}

export interface OrderPageResponse {
  content: OrderDetail[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  totalAll: number;
  totalPaid: number;
  totalPending: number;
  totalCanceled: number;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  status: number;
  timestamp: string;
  fieldErrors?: Record<string, string>;
}


