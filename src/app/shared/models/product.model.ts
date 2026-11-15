export interface Product {
  id: string;
  name: string;
  description: string;
  stock?: number;
  active?: boolean;
  stripeProductId?: string;
  stripePriceId?: string;
  unitAmountCents: number;
  currency?: string;
  imageUrl: string;
}

export interface CreateProductRequest {
  name: string;
  description: string;
  stock: number;
  unitAmountCents: number;
  imageUrl: string;
}

export interface UpdatePriceRequest {
  newUnitAmountCents: number;
}
