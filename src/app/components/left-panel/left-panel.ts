import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { WeatherService } from '../../services/weather';
import { DateTimeService } from '../../services/date-time';
import { DataService } from '../../data-service/data-service';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';

@Component({
  selector: 'app-left-panel',
  imports: [CommonModule, RouterModule, FormsModule, ClickOutsideDirective],
  standalone: true,
  templateUrl: './left-panel.html',
  styleUrl: './left-panel.css',
})
export class LeftPanel implements OnInit {
  @Input() isDashboard: boolean = false;
  showDropdown: boolean = false;
  showReports: boolean = false;
  isTHVSDisabled = true;
  user: any;
  logId: string = '';
  isPanIndiaEnabled: boolean = false;
  isCircleLevelActive: boolean = false;
  constructor(
    private snackBar: MatSnackBar,
    private router: Router,
    private WeatherService: WeatherService,
    private cdr: ChangeDetectorRef,
    private dateTimeService: DateTimeService,
    private dataService: DataService
  ) {}

  userRole: string = '';
  userName: string = '';
  userId: string = '';
  indus_circle: string = '';

  safeDetectChanges() {
    this.cdr.markForCheck();
  }

  ngOnInit() {
    const sessionUser: any = localStorage.getItem('user');
    this.user = JSON.parse(sessionUser);
    const username = this.user.name;
    this.userId = this.user.userid;
    this.userName = username.split(' ')[0];
    this.userRole = this.user.userrole;
    // this.indus_circle = this.user.indus_circle;
    this.WeatherService.weatherLogId$.subscribe((id) => {
      this.logId = id;
      this.safeDetectChanges();
    });
    this.WeatherService.circleChangedIs$.subscribe((CircleLebel) => {
      if (CircleLebel) {
        this.indus_circle = CircleLebel;
      }
    });
  }

  toggleReports(event: Event) {
    event.preventDefault();
    this.showReports = !this.showReports;
  }
  toggleDropdown() {
    this.showDropdown = !this.showDropdown;
  }
  onDashboardClick(): void {
    const payload = {
      type: 'update',
      id: this.logId,
      data: {
        dashboard_clicked: 'true',
      },
    };
    this.weatherUpdateLog(payload);
    this.isCircleLevelActive = false;
    this.WeatherService.setCircleLabelClicked(false);
    localStorage.removeItem('circleClicked');
    localStorage.setItem(
      'circleClicked',
      JSON.stringify(this.isCircleLevelActive)
    );
  }
  onCircleLevelClick(): void {
    const payload = {
      type: 'update',
      id: this.logId,
      data: {
        circleLevel_clicked: 'true',
      },
    };
    this.weatherUpdateLog(payload);
    this.isCircleLevelActive = true;
    localStorage.setItem(
      'circleClicked',
      JSON.stringify(this.isCircleLevelActive)
    );
    this.WeatherService.setCircleLabelClicked(true);
  }
  onPanIndiaClick(): void {
    const payload = {
      type: 'update',
      id: this.logId,
      data: {
        pandindia_clicked: 'true',
      },
    };
    if (this.isPanIndiaEnabled === false) {
      this.isPanIndiaEnabled = true;
      this.WeatherService.setPanIndiaLocation('India');
    } else {
      this.isPanIndiaEnabled = false;
      this.WeatherService.setPanIndiaLocation('');
    }
    this.weatherUpdateLog(payload);
  }
  onUsageClick(): void {
    const payload = {
      type: 'update',
      id: this.logId,
      data: {
        usage_clicked: 'true',
      },
    };
    this.weatherUpdateLog(payload);
  }
  onTHVScoreClick(): void {
    const payload = {
      type: 'update',
      id: this.logId,
      data: {
        thvscore_clicked: 'true',
      },
    };
    this.weatherUpdateLog(payload);
  }

  logout(): void {
    const payload = {
      logId: JSON.parse(localStorage.getItem('logId') || '{}'),
    };

    this.dataService
      .postData('/user_logout', payload)
      .pipe(
        catchError((error) => {
          const errorMessage =
            error?.error?.message || 'User log insertion failed';
          return throwError(() => `${error} \n ${errorMessage}`);
        })
      )
      .subscribe((res: any) => {
        if (res?.status === 'success') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          this.router.navigate(['/']);
          return;
        }
      });
  }

  weatherUpdateLog(payload: object): void {
    this.dataService
      .sendWeatherUserLog(`weather_user_activity`, payload)
      .pipe(
        catchError((error) => {
          const errorMessage =
            error?.error?.message || 'User log insertion failed';
          return throwError(() => `${error} \n ${errorMessage}`);
        })
      )
      .subscribe((res: any) => {
        if (res?.status === 'success') {
          return;
        }
      });
  }

  /* Change User Password  */
  changePassword = () => {
    const modal = document.getElementById('changePasswordModal');
    if (modal) {
      (modal as any).style.display = 'block';
    }
  };
  closeChangePasswordModal = () => {
    const modal = document.getElementById('changePasswordModal');
    if (modal) {
      (modal as any).style.display = 'none';
    }
  };
  submitChangePassword = (form: any) => {
    if (form.valid) {
      if (
        !form.value.oldPassword ||
        !form.value.newPassword ||
        !form.value.confirmPassword
      ) {
        this.snackBar.open('Enter the required details', 'X', {
          duration: 2000, // auto close after 3s
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: ['custom-error-snackbar'],
        });
        return;
      }
      if (form.value.newPassword !== form.value.confirmPassword) {
        this.snackBar.open("Confirm password doesn't matched!", 'X', {
          duration: 2000, // auto close after 3s
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: ['custom-error-snackbar'],
        });
        return;
      }
      ///* This is highlighted comment
      //// This is overrated highlighted comment

      // TODO: Add API call here
      const payload = {
        userId: this.userId,
        oldPassword: form.value.oldPassword,
        newPassword: form.value.newPassword,
      };
      this.dataService
        .postRequest('/change-password', payload)
        .pipe(
          catchError((error: any) => {
            const errorMessage =
              error?.error?.message || 'Internal Server Error';
            console.log(errorMessage);
            return throwError(() => error);
          })
        )
        .subscribe((response: any) => {
          if (response.status === 'success') {
            this.snackBar.open(response.message, 'X', {
              duration: 2000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
              panelClass: ['custom-success-snackbar'],
            });
            this.closeChangePasswordModal();
          }
        });
    }
  };
}
