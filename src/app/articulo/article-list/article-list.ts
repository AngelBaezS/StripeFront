import { Component, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ArticuloService } from '../article-service';
import { Article } from '../../model/article';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmButton } from '@spartan-ng/helm/button';
import { RouterLink } from '@angular/router';

@Component({
  imports: [HlmTableImports, HlmButton, CurrencyPipe, RouterLink],
  selector: 'app-lista-articulo',
  template: `
    <div class="p-6">
      <h2 class="text-2xl font-bold mb-4 tracking-tight">Articles</h2>
      <div hlmTableContainer class="border border-border/50 rounded-lg shadow-sm bg-background/50">
        <table hlmTable>
          <caption hlmCaption class="mb-4">List of articles available</caption>
          <thead hlmTHead>
            <tr hlmTr>
              <th hlmTh class="w-1/4">Name</th>
              <th hlmTh class="w-1/2">Description</th>
              <th hlmTh class="w-1/4">Price</th>
              <th hlmTh class="w-32">Action</th>
            </tr>
          </thead>
          <tbody hlmTBody>
            @for (article of articles(); track article.id) {
              <tr hlmTr>
                <td hlmTd class="font-medium">{{ article.name }}</td>
                <td hlmTd class="truncate max-w-[300px]">{{ article.description }}</td>
                <td hlmTd>{{ article.price / 100 | currency }}</td>
                <td hlmTd>
                  <button hlmBtn size="sm" variant="default" routerLink="/detail/{{article.id}}">Buy</button>
                </td>
              </tr>
            }
            @empty {
              <tr hlmTr>
                <td hlmTd colspan="4" class="text-center">No articles found</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class ListaArticulo {

  articles = signal<Article[]>([]);

  constructor(private articuloService: ArticuloService) { }

  ngOnInit(): void {
    this.cargarLista();
  }

  cargarLista() {
    this.articuloService.findAll().subscribe({
      next: (data) => {
        this.articles.set(data);
      },
      error: (error) => {
        console.error(error);
      }
    });
  }
}
