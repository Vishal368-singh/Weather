import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { catchError, switchMap, throwError, Observable } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getAccessToken();

  if (req.url.includes('/userLogin') || req.url.includes('/refresh')) {
    return next(req);
  }

  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        return handle401Error(authReq, next, auth, router);
      }

      if (error.status === 409) {
        console.warn('Session conflict: logged in from another device');

        auth.logoutUser(); // clear + activity log
        router.navigate(['/login'], {
          queryParams: {
            session: 'conflict',
            message: error.error?.message,
          },
        });

        return throwError(() => error);
      }

      return throwError(() => error);
    })
  );
};

function handle401Error(
  req: HttpRequest<any>,
  next: HttpHandlerFn,
  auth: AuthService,
  router: Router
): Observable<HttpEvent<any>> {
  return auth.refreshToken().pipe(
    switchMap(() => {
      const newToken = auth.getAccessToken();

      const retryReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${newToken}`,
          'Content-Type': 'application/json',
        },
      });

      return next(retryReq);
    }),
    catchError((refreshError) => {
      console.warn('Refresh token expired — logging out');

      auth.logoutUser();
      router.navigate(['/login'], {
        queryParams: { expired: 'true' },
      });

      return throwError(() => refreshError);
    })
  );
}
