import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'centsToCurrency',
})
export class CentsToCurrencyPipe implements PipeTransform {
  public transform(unitAmountCents: number | null | undefined, currencyCode = 'MXN'): string {
    if (unitAmountCents === null || unitAmountCents === undefined || isNaN(unitAmountCents)) {
      return '$0.00';
    }
    const amount = unitAmountCents / 100;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(amount);
  }
}

