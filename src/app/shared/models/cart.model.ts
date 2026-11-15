export type CartStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED';

export interface AddCartItemRequest {
  productId: string;
  quantity: number;
}

export interface CartItemDetail {
  id: string;
  productId: string;
  productName: string;
  description: string;
  imageUrl: string;
  unitAmountCents: number;
  quantity: number;
  subtotalCents: number;
  availableStock: number;
}

export interface CartDetail {
  cartId: string;
  userId: string;
  status: CartStatus;
  updatedAt: string;
  items: CartItemDetail[];
  totalAmountCents: number;
}
