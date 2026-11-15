import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProductService } from './product.service';
import { environment } from '@env/environment';
import { Product } from '@shared/models/product.model';

describe('ProductService (Admin Catalog & Price Updates)', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ProductService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch admin products with full info from GET /api/v1/admin/products', () => {
    const mockProducts: Product[] = [
      {
        id: 'prd_1',
        name: 'Laptop Gamer',
        description: 'Laptop RTX 4080',
        stock: 5,
        active: true,
        stripeProductId: 'prod_123',
        stripePriceId: 'price_123',
        unitAmountCents: 2500000,
        currency: 'mxn',
        imageUrl: 'https://example.com/laptop.jpg',
      },
    ];

    service.getAdminProducts().subscribe((products) => {
      expect(products.length).toBe(1);
      expect(products[0].id).toBe('prd_1');
      expect(products[0].stripeProductId).toBe('prod_123');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/admin/products`);
    expect(req.request.method).toBe('GET');
    req.flush(mockProducts);
  });

  it('should update product price via PUT /api/v1/admin/products/{id}/price with newUnitAmountCents body', () => {
    const productId = 'prd_1';
    const newPrice = 2800000;
    const mockUpdated: Product = {
      id: productId,
      name: 'Laptop Gamer',
      description: 'Laptop RTX 4080',
      stock: 5,
      active: true,
      stripeProductId: 'prod_123',
      stripePriceId: 'price_456',
      unitAmountCents: newPrice,
      currency: 'mxn',
      imageUrl: 'https://example.com/laptop.jpg',
    };

    service.updateProductPrice(productId, newPrice).subscribe((res) => {
      expect(res.unitAmountCents).toBe(newPrice);
      expect(res.stripePriceId).toBe('price_456');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/v1/admin/products/${productId}/price`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ newUnitAmountCents: newPrice });
    req.flush(mockUpdated);
  });
});

