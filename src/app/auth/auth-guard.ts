import { inject } from '@angular/core';
import { CanActivateFn, UrlTree, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { DataService } from '../data-service/data-service';
import { WeatherService } from '../services/weather';

// export const authGuard: CanActivateFn = (
//   route,
//   state
// ): Observable<boolean | UrlTree> => {
//   const dataService = inject(DataService);
//   const weatherService = inject(WeatherService);
//   const router = inject(Router);

//   const token = localStorage.getItem('token');
//   const logId = localStorage.getItem('logId');

//   // Set weather log id if available
//   if (logId) {
//     weatherService.setWeatherLogId(logId);
//   }

//   // No token → redirect to login
//   if (!token) {
//     clearStorage();
//     return of(router.createUrlTree(['/']));
//   }

//   // Validate token with backend
//   return dataService.getProtectLoginTokenAuth(token).pipe(
//     map((res: any) => {
//       if (res?.status === 'success') {
//         return true;
//       }
//       // Invalid token
//       clearStorage();
//       return router.createUrlTree(['/']);
//     }),
//     catchError(() => {
//       // API error / token expired / network issue
//       clearStorage();
//       return of(router.createUrlTree(['/']));
//     })
//   );

//   // Helper function
//   function clearStorage(): void {
//     localStorage.removeItem('user');
//     localStorage.removeItem('token');
//     localStorage.removeItem('logId');
//   }
// };

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  const token = localStorage.getItem('token');

  if (!token) {
    clearStorage();
    return router.createUrlTree(['/']);
  }

  return true;

  function clearStorage() {
    localStorage.clear();
  }
};
