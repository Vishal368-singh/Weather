import { inject } from '@angular/core';
import { CanActivateFn, UrlTree } from '@angular/router';
import { Router } from '@angular/router';
import { DataService } from '../data-service/data-service';
import { map, catchError, of, throwError, Observable } from 'rxjs';
import { WeatherService } from '../services/weather';
import { DateTimeService } from '../services/date-time';

export const authGuard: CanActivateFn = (
  route,
  state
): Observable<boolean | UrlTree> => {
  const dataService = inject(DataService);
  const weatherService = inject(WeatherService);
  const dateTimeService = inject(DateTimeService);
  const router = inject(Router);

  const token = localStorage.getItem('token');
  const logId = localStorage.getItem('logId');

  if (logId) {
    weatherService.setWeatherLogId(logId);
  }

  //No token: go back to login
  if (!token || token === 'null' || token === 'undefined') {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    return of(router.createUrlTree(['/']));
  }

  //Validate token via API
  return dataService.getProtectLoginTokenAuth(token).pipe(
    map((res: any) => {
      if (res?.message === 'Validate token') {
        return true;
      } else {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        return router.createUrlTree(['/']);
      }
    }),
    catchError((err) => {
      const { formattedDate, formattedTime } =
        dateTimeService.getCurrentDateTime();
      const payload = {
        type: 'update',
        id: logId,
        data: { logout_time: `${formattedDate} ${formattedTime}` },
      };

      dataService
        .sendWeatherUserLog('weather_user_activity', payload)
        .pipe(catchError(() => of(null)))
        .subscribe();
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      return of(router.createUrlTree(['/']));
    })
  );
};
