import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PaymentIntentDto } from '../model/payment-intent-dto';
import { environment } from '../../environments/environment';

const header = { headers: new HttpHeaders().set('Content-Type', 'application/json') }

@Injectable({ providedIn: 'root' })
export class PaymentService {

    constructor(private http: HttpClient) { }

    public buy(paymentIntentDto: PaymentIntentDto): Observable<string> {
        return this.http.post<string>(environment.apiUrl + `/stripe/paymentintent`, paymentIntentDto, header);
    }

    public confirmPayment(paymentIntentId: string): Observable<string> {
        return this.http.post<string>(environment.apiUrl + `/stripe/confirm/${paymentIntentId}`, {}, header);
    }

    public cancelPayment(paymentIntentId: string): Observable<string> {
        return this.http.post<string>(environment.apiUrl + `/stripe/cancel/${paymentIntentId}`, {}, header);
    }
}
