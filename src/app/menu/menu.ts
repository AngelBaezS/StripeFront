import { Component } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { RouterLink } from '@angular/router';

@Component({
  imports: [HlmButton, RouterLink],
  selector: 'app-menu',
  template: `
    <div class="w-[calc(100%-3rem)] max-w-5xl mx-auto mt-6 mb-6">
      <nav class="flex items-center justify-between px-6 py-3 rounded-2xl border border-border/50 bg-background/70 backdrop-blur-md shadow-sm">
        <div class="flex items-center gap-4">
          <span class="text-lg font-bold tracking-tight text-foreground">Angular con Stripe</span>
          <button hlmBtn variant="ghost" routerLink="/list">Home</button>
        </div>
        <button hlmBtn variant="default" routerLink="/blog">Blog</button>
      </nav>
    </div>
  `,
})
export class Menu { }
