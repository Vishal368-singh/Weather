import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, forkJoin, of, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  flaskAPIURL = environment.apiUrl;

  telecomService =
    'https://mlinfomap.org/geoserver/Telecom/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Telecom%3AINDIAN_TELECOM_MAP&outputFormat=application%2Fjson&maxFeatures=1000';

  constructor(private http: HttpClient) {}

  getProtectLoginTokenAuth(token: any): Observable<any> {
    if (!token) {
      // No token → do nothing but keep observable consistent
      return of(null);
    }
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    return this.http.get(`${this.flaskAPIURL}/protected`, { headers });
  }

  login(payload: Object): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    return this.http.post(`${this.flaskAPIURL}/userLogin`, payload, {
      headers,
    });
  }

  forceLogout(method: string, payload: object = {}): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });
    return this.http.post(`${this.flaskAPIURL}/${method}`, payload, {
      headers,
    });
  }

  getRequest(): Observable<any> {
    const token = localStorage.getItem('token'); // or localStorage
    if (!token) {
      return of(null);
    }
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
    return this.http.get(this.flaskAPIURL, { headers });
  }

  postRequest(method: string, payload: Object = {}): Observable<any> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    });

    return this.http.post(`${this.flaskAPIURL}/${method}`, payload, {
      headers,
    });
  }

  postRequesteExportData(method: string, payload: any = {}): Observable<any> {
    const token = localStorage.getItem('token');
    const isJsonRequest = payload?.sendExport === 'send';

    const headers = new HttpHeaders({
      ...(isJsonRequest && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    });

    const options: any = {
      headers,
      responseType: isJsonRequest ? 'json' : 'blob',
    };

    return this.http.post(`${this.flaskAPIURL}/${method}`, payload, options);
  }

  postFormData(method: string, formData: FormData): Observable<any> {
    const token = localStorage.getItem('token');
    if (!token) {
      return of(null);
    }
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    return this.http.post(`${this.flaskAPIURL}/${method}`, formData, {
      headers,
    });
  }

  getFilteredFeatures() {
    return this.http.get<any>(this.telecomService).pipe(
      map((geojson) => {
        const filtered = geojson.features.filter(
          (feature: any) => feature.properties.LGD_STATE === 'UTTAR PRADESH'
        );
        return { ...geojson, features: filtered };
      })
    );
  }
  // https://api.weatherapi.com/v1/forecast.json?key=ce3f4317d6204d0f99571656250108&q=UP East&days=8&aqi=no&alerts=no
  getWeatherForecast(location: string): Observable<any> {
    const apiUrl = 'https://api.weatherapi.com/v1/forecast.json';
    const apiKey = 'ce3f4317d6204d0f99571656250108';
    return this.http.get(
      `${apiUrl}?key=${apiKey}&q=${location}&days=8&aqi=no&alerts=no`
    );
  }

  getCrossVisualForecast(location: string): Observable<any> {
    const lat = location.split(',')[0];
    const lon = location.split(',')[1];
    const weatherApiUrl = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${location}?unitGroup=metric&include=current,hours,days&key=U97UPL62GH9FWVHVX9Q8Y36QE`;
    const geoApiUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

    return forkJoin({
      weather: this.http.get(weatherApiUrl),
      location: this.http.get(geoApiUrl, {
        headers: { 'Accept-Language': 'en' },
      }),
    }).pipe(
      map((response: any) => {
        return {
          ...response.weather,
          resolvedLocation: `${response.location.display_name.split(',')[0]},${
            response.location.address.state
          }`,
        };
      })
    );
  }

  sendSelectedTowerReport(formData: FormData): Observable<any> {
    return this.http.post(this.flaskAPIURL, formData);
    // return this.http.post(`http://127.0.0.1:6633/api-send-report`, formData);
  }

  sendWeatherUserLog(payload: object): Observable<any> {
    const token = localStorage.getItem('token'); // or localStorage
    if (!token) {
      // No token → do nothing but keep observable consistent
      return of(null);
    }
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });

    return this.http
      .post(`${this.flaskAPIURL}/weather_user_activity`, payload, { headers })
      .pipe(
        catchError((error) => {
          const msg = error?.error?.message || 'User log insertion failed';
          return throwError(() => new Error(msg));
        })
      );
  }

  get_circle_list(method: string, payload: object): Observable<any> {
    const token = localStorage.getItem('token'); // or localStorage
    if (!token) {
      // No token → do nothing but keep observable consistent
      return of(null);
    }
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
    return this.http.post(`${this.flaskAPIURL}/${method}`, payload, {
      headers,
    });
    // return this.http.post(`http://127.0.0.1:6633/${method}`, payload)
  }
}
