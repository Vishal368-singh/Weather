import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { DataService } from '../data-service/data-service';
import { map, catchError, of, throwError } from 'rxjs';
import { WeatherService } from '../services/weather';
import { DateTimeService } from '../services/date-time';


export const authGuard: CanActivateFn = (route, state) => {
  const dataService = inject(DataService);
  const weatherService = inject(WeatherService);
  const dateTimeService = inject(DateTimeService);
  const router = inject(Router);
  const token = sessionStorage.getItem('token');
  const logId = sessionStorage.getItem('logId');

  if (logId) {
    weatherService.setWeatherLogId(logId);
  }


  if (token && token !== 'null' && token !== 'undefined') {
    return dataService.getProtectLoginTokenAuth(token).pipe(
      map((res: any) => {
        if (res.message === 'Validate token') {
          return true; // allow navigation
        } else {
          router.navigate(['/']);
          return false;
        }
      }),
      catchError(err => {
        console.error('Token validation error', err);
        const { formattedDate, formattedTime } = dateTimeService.getCurrentDateTime()
            const payload = {
              type: "update",
              id: logId,
              data: {
                logout_time: `${formattedDate} ${formattedTime}`
              }
            }
            dataService
              .sendWeatherUserLog(`weather_user_activity`, payload)
              .pipe(
                catchError((error) => {
                  const errorMessage = error?.error?.message || 'User log insertion failed';
                  return throwError(() => `${error} \n ${errorMessage}`);
                }))
              .subscribe((res: any) => {
                if (res?.status === 'success') {
                  console.log('Log insertion successful');
                  return;
                }
                console.log('Log insertion failed');
              })
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');
        router.navigate(['/']);
        return of(false); // deny navigation on error
      })
    );
  } else {
    router.navigate(['/']);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    return of(false);
  }
};