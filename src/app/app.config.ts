import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideNgxStripe } from 'ngx-stripe';
import { provideSpartanHlm } from '@spartan-ng/helm/utils';
import { environment } from '../environments/environment.development';

export const appConfig: ApplicationConfig = {
  providers: [
    provideSpartanHlm(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideNgxStripe(environment.stripePublicKey),
  ]
};
