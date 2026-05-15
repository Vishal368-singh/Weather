import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  BehaviorSubject,
  tap,
  finalize,
  catchError,
  throwError,
  filter,
  take,
  switchMap,
  of,
  forkJoin,
  map,
  Subscription,
  fromEvent,
  debounceTime,
  merge,
  timer,
} from 'rxjs';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LoaderService } from '../pages/loader/loader.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  private isLoggingOut = false;

  private idleTimerSub: Subscription | null = null;
  private activitySub: Subscription | null = null;
  private visibilityHandler: ((ev?: any) => void) | null = null;
  private beforeUnloadHandler: ((ev?: any) => void) | null = null;

  // === change this duration if you want ===
  private IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes

  // guard to avoid too-frequent resets caused by background events
  private lastActivityTime = Date.now();

  apiUrl = environment.apiUrl;

  telecomService =
    'https://mlinfomap.org/geoserver/Telecom/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Telecom%3AINDIAN_TELECOM_MAP&outputFormat=application%2Fjson&maxFeatures=1000';

  private isLoggedInSubject = new BehaviorSubject<boolean>(this.hasToken());
  private userSubject = new BehaviorSubject<any>(this.getUser());

  currentUser$ = this.userSubject.asObservable();
  isLoggedIn$ = this.isLoggedInSubject.asObservable();

  private refreshInProgress = false;
  private refreshSubject = new BehaviorSubject<string | null>(null);

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private loader: LoaderService,
    private router: Router,
    private zone: NgZone
  ) {
    this.startIdleWatch();
  }

  // --------------------------
  // LOGIN
  // --------------------------

  login(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/userLogin`, credentials).pipe(
      tap((res: any) => {
        if (res.status === 'already_logged_in')
          throw new Error('ALREADY_LOGGED_IN');
        this.saveTokens(res.data || res);
        this.isLoggedInSubject.next(true);
        this.userSubject.next(res.resultUser);
      })
    );
  }

  // --------------------------
  // LOGOUT
  // --------------------------

  logout() {
    // this.loader.hide();
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;

    const logId = localStorage.getItem('logId') || '';

    this.http
      .post(`${this.apiUrl}/user_logout`, { logId })
      .pipe(
        finalize(() => {
          this.clearStorage();
          // this.loader.hide();
          this.isLoggedInSubject.next(false);
          this.userSubject.next(null);
          this.router.navigate(['/login'], {
            queryParams: { timeout: true },
          });
          this.isLoggingOut = false;
        })
      )
      .subscribe({
        next: () => {
          // this.loader.hide();
          this.clearStorage();
          this.isLoggedInSubject.next(false);
          this.userSubject.next(null);
          this.router.navigate(['/login'], {
            queryParams: { timeout: true },
          });
          this.isLoggingOut = false;
        },
        error: (err) => {
          this.clearStorage();
          this.isLoggedInSubject.next(false);
          this.userSubject.next(null);
          this.router.navigate(['/login'], {
            queryParams: { timeout: true },
          });
          this.isLoggingOut = false;
        },
      });
  }

  logoutUser() {
    // this.loader.hide();
    const storedUser: any = localStorage.getItem('user');
    const user = JSON.parse(storedUser);
    const logId = localStorage.getItem('logId');
    this.clearStorage();
    this.router.navigate(['/login']);
    if (user && logId) {
      this.LogoutUserAfter30Second(user, logId);
      return;
    }
    return;
  }

  LogoutUserAfter30Second(user: any, logId: any) {
    const payload = {
      user,
      logId,
    };
    this.postRequest('logout_after_time_interval', payload)
      .pipe(
        catchError((error: any) => {
          const message = error?.error?.message;
          return throwError(() => `${error}  ${message}`);
        })
      )
      .subscribe((response: any) => {
        if (response.status === 'success') {
          console.log(response);
        }
      });
  }

  // --------------------------
  // REFRESH TOKEN
  // --------------------------
  refreshToken(): Observable<any> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      this.logout();
    }

    if (this.refreshInProgress) {
      return this.refreshSubject.pipe(
        filter((token) => token !== null),
        take(1),
        switchMap(() => of(localStorage.getItem('token')))
      );
    }

    this.refreshInProgress = true;
    this.refreshSubject.next(null);

    return this.http
      .post(`${this.apiUrl}/refresh`, { refresh_token: refreshToken })
      .pipe(
        tap((res: any) => {
          if (res.data?.token) {
            localStorage.setItem('token', res.data.token);
            this.isLoggedInSubject.next(true);
            this.refreshSubject.next(res.data.token);
          } else {
            throw new Error('No access token returned');
          }
        }),
        finalize(() => (this.refreshInProgress = false)),
        catchError((error) => {
          this.logout();
          return throwError(() => error);
        })
      );
  }

  // --------------------------
  // TOKEN & USER MANAGEMENT
  // --------------------------
  saveTokens(data: any) {
    localStorage.setItem('user', JSON.stringify(data.resultUser));
    localStorage.setItem('token', data.token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('logId', data.logId);
  }

  clearStorage() {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('logId');
  }

  getUser(): any {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return null;
    }
  }

  getAccessToken(): string | null {
    return localStorage.getItem('token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  hasToken(): boolean {
    const token = this.getAccessToken();
    return token ? !this.isTokenExpired() : false;
  }

  isTokenExpired(): boolean {
    const token = this.getAccessToken();
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now;
    } catch {
      return true;
    }
  }

  isAuthenticated(): boolean {
    return this.hasToken();
  }

  getCurrentUser() {
    return this.userSubject.value;
  }

  // --------------------------
  // PROTECTED API CALL
  // --------------------------
  callProtected(): Observable<any> {
    const token = this.getAccessToken();
    return this.http.get(`${this.apiUrl}/protected`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

 
  checkUserStatus(username: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/check-user-session`, { username });
  }

  forceLogoutRemote(username: string, logId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/force-logout-remote`, {
      username,
      logId,
    });
  }

  getProtectLoginTokenAuth(token: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/protected`);
  }

  getRequest(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  postRequest(method: string, payload: Object): Observable<any> {
    return this.http.post(`${this.apiUrl}/${method}`, payload);
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
    return this.http.post(this.apiUrl, formData);
  }

  checkUser() {
    const token = this.getAccessToken();
    if (token) {
      this.callProtected().subscribe({
        next: () => {
          console.log('Token valid, user is logged in');
        },
        error: () => {
          console.log('Token invalid, redirecting to login');
          this.logout();
          this.router.navigate(['/login']);
        },
      });
    }
  }

  sendWeatherUserLog(method: string, payload: object): Observable<any> {
    this.checkUser();
    return this.http.post(`${this.apiUrl}/${method}`, payload);
  }

  get_circle_list(method: string, payload: object): Observable<any> {
    return this.http.post(`${this.apiUrl}/${method}`, payload);
  }

  // --------------------------
  // IDLE WATCH (robust)
  // --------------------------

  private startIdleWatch() {
    this.zone.runOutsideAngular(() => {
      const events = [
        'mousemove',
        'keydown',
        'mousedown',
        'scroll',
        'touchstart',
        'click',
      ];

      const activityStreams = events.map((evt) => fromEvent(document, evt));
      const activity$ = merge(...activityStreams).pipe(debounceTime(200));

      this.activitySub = activity$.subscribe(() => {
        this.lastActivityTime = Date.now();
        this.resetIdleTimer();
      });

      // visibility change
      this.visibilityHandler = () => {
        if (!document.hidden) {
          // user returned, reset timers
          this.lastActivityTime = Date.now();
          this.resetIdleTimer();
        }
        // IMPORTANT: do NOT start timer when hidden
        // let the original idle timer continue normally
      };

      document.addEventListener('visibilitychange', this.visibilityHandler);
      this.beforeUnloadHandler = () => {
        // clear tokens on page unload (optional — keep according to your app needs)
        // NOTE: don't attempt async HTTP here.
        //  this.clearStorage();
      };

      window.addEventListener('beforeunload', this.beforeUnloadHandler);

      // start timer
      this.resetIdleTimer();
    });
  }

  private startIdleTimer() {
    ;
    this.clearIdleTimer();

    this.zone.runOutsideAngular(() => {
      this.idleTimerSub = timer(this.IDLE_TIMEOUT).subscribe(() => {
        const now = Date.now();
       
        // Only logout if REAL inactivity
        if (now - this.lastActivityTime >= this.IDLE_TIMEOUT) {
          this.zone.run(() => {
            console.warn('Auto logout after 30 seconds of inactivity');
            if (!this.isLoggingOut) {
              this.isLoggingOut = true;
              this.logoutUser();
            }
          });
        } else {
          // User became active — restart timer
          this.resetIdleTimer();
        }
      });
    });
  }

  private resetIdleTimer() {
   
    this.clearIdleTimer();
    this.startIdleTimer();
  }

  private clearIdleTimer() {
    if (this.idleTimerSub) {
      this.idleTimerSub.unsubscribe();
      this.idleTimerSub = null;
    }
  }

  // --------------------------
  // CLEANUP
  // --------------------------
  ngOnDestroy(): void {
    if (this.activitySub) {
      this.activitySub.unsubscribe();
      this.activitySub = null;
    }
    this.clearIdleTimer();

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
  }
}
