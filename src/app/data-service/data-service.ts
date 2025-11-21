import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, forkJoin } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  flaskAPIURL = 'http://192.168.1.26:6633'; // Local
  // flaskAPIURL = 'https://mlinfomap.org/weatherapi'; // Server

  // apiUrl1 = 'http://localhost:6900/api';
  // loginApiUrl = 'https://mlinfomap.org/api-drawing-tool';
  telecomService =
    'https://mlinfomap.org/geoserver/Telecom/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Telecom%3AINDIAN_TELECOM_MAP&outputFormat=application%2Fjson&maxFeatures=1000';

  constructor(private http: HttpClient) {}

  getProtectLoginTokenAuth(token: any): Observable<any> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    return this.http.get(`${this.flaskAPIURL}/protected`, { headers });
  }

  getRequest(): Observable<any> {
    const token = localStorage.getItem('token'); // or localStorage
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
    return this.http.get(this.flaskAPIURL, { headers });
  }

  postRequest(method: string, payload: Object): Observable<any> {
    const token = localStorage.getItem('token'); // or localStorage
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
    return this.http.post(`${this.flaskAPIURL}/${method}`, payload, {
      headers,
    });
  }

  // getTowerData(method: string): Observable<any> {
  //   const token = localStorage.getItem('token'); // or localStorage
  //   const headers = new HttpHeaders({
  //     'Content-Type': 'application/json',
  //     Authorization: `Bearer ${token}`,
  //   });
  //   return this.http.get(`${this.apiUrl1}/${method}`);
  // }

  // postData(method: string, payload: Object): Observable<any> {
  //   return this.http.post(`${this.flaskAPIURL}/${method}`, payload);
  // }

  postData(method: string, payload?: Object): Observable<any> {
    const token = localStorage.getItem('token'); // or localStorage
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });

    const body = payload || {};

    return this.http.post(`${this.flaskAPIURL}/${method}`, body, { headers });
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

  // fetch the user list
  // getWeatherUserList(method: string): Observable<any> {
  //   const token = localStorage.getItem('token'); // or localStorage
  //   const headers = new HttpHeaders({
  //     'Content-Type': 'application/json',
  //     Authorization: `Bearer ${token}`,
  //   });
  //   return this.http.get(`${this.flaskAPIURL}/${method}`, { headers });
  //   // return this.http.get(`http://127.0.0.1:6633/${method}`)
  // }
  sendSelectedTowerReport(formData: FormData): Observable<any> {
    return this.http.post(this.flaskAPIURL, formData);
    // return this.http.post(`http://127.0.0.1:6633/api-send-report`, formData);
  }

  sendWeatherUserLog(method: string, payload: object): Observable<any> {
    const token = localStorage.getItem('token'); // or localStorage
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
    return this.http.post(`${this.flaskAPIURL}/${method}`, payload, {
      headers,
    });
    // return this.http.post(`http://127.0.0.1:6633/${method}`, payload)
  }

  get_circle_list(method: string, payload: object): Observable<any> {
    const token = localStorage.getItem('token'); // or localStorage
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
