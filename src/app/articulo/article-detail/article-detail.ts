import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { ArticuloService } from '../article-service';
import { Article } from '../../model/article';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { Payment } from '../../payment/payment';

@Component({
  imports: [HlmCardImports, CurrencyPipe, Payment],
  selector: 'app-detalle-articulo',
  template: `
    <div class="p-6 max-w-xl mx-auto mt-10">
      @if (error()) {
        <div class="flex justify-center items-center h-64">
          <p class="text-muted-foreground text-lg animate-pulse">Article not found</p>
        </div>
      } @else if (article() != null) {
        <div hlmCard>
          <img [src]="article()!.imageUrl" [alt]="article()!.name" class="w-full h-auto object-cover" />
          <div hlmCardHeader>
            <h3 hlmCardTitle class="text-3xl font-bold">{{ article()!.name }}</h3>
            <p hlmCardDescription class="text-2xl font-semibold text-primary mt-1">
              {{ article()!.price / 100 | currency }}
            </p>
          </div>
          <div hlmCardContent>
            <p class="text-muted-foreground leading-relaxed text-base">{{ article()!.description }}</p>
          </div>
          <app-payment [id]="article()!.id ?? 0" [name]="article()!.name" [description]="article()!.description" [price]="article()!.price / 100"/>
        </div>
      } @else {
        <div class="flex justify-center items-center h-64">
          <p class="text-muted-foreground text-lg animate-pulse">Loading article...</p>
        </div>
      }
    </div>
  `
})
export class DetalleArticulo implements OnInit {
  private route = inject(ActivatedRoute);
  private articuloService = inject(ArticuloService);

  article = signal<Article | null>(null);
  error = signal<boolean>(false);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.articuloService.detail(+id).subscribe({
        next: (data) => this.article.set(data),
        error: (err) => this.error.set(true)
      });
    }
  }
}
