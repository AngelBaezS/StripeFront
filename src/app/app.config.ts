import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideNgxStripe } from 'ngx-stripe';
import { provideSpartanHlm } from '@spartan-ng/helm/utils';
import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { authInterceptor } from '@core/interceptors/auth.interceptor';
import { AuthService } from '@core/services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideSpartanHlm(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideNgxStripe(environment.stripePublicKey),
    provideAppInitializer(() => {
      inject(AuthService).startTokenMonitor();
    }),
  ],
};
