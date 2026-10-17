import { Injectable, Service } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Article } from '../model/article';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const header = { headers: new HttpHeaders().set('Content-Type', 'application/json') }

@Injectable({ providedIn: 'root' })
export class ArticuloService {

    constructor(private http: HttpClient) { }

    public findAll(): Observable<Article[]> {
        return this.http.get<Article[]>(environment.apiUrl + '/article/list', header);
    }

    public detail(id: number): Observable<Article> {
        return this.http.get<Article>(environment.apiUrl + `/article/detail/${id}`, header);
    }
}
