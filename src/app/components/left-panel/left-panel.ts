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
import { LoaderService } from '../../pages/loader/loader.service';

@Component({
  selector: 'app-left-panel',
  imports: [CommonModule, RouterModule, FormsModule, ClickOutsideDirective],
  standalone: true,
  templateUrl: './left-panel.html',
  styleUrl: './left-panel.css',
})
export class LeftPanel implements OnInit {
  @Input() isDashboard: boolean = false;
  @Input() isDistrictActive: boolean = false;
  showDropdown: boolean = false;
  showReports: boolean = false;
  isTHVSDisabled = true;
  user: any;
  get logId(): string | null {
    return localStorage.getItem('logId');
  }
  isPanIndiaEnabled: boolean = false;
  isCircleLevelActive: boolean = false;
  constructor(
    private loader: LoaderService,
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
    this.indus_circle = this.user.indus_circle;

    if (this.user.indus_circle === 'All Circle') {
      this.indus_circle = 'M&G';
    } else {
      this.indus_circle = this.user.indus_circle;
    }

    this.WeatherService.circleChangedIs$.subscribe((circleArray: any) => {
      if (circleArray.length > 0) {
        this.indus_circle =
          circleArray[0]?.label === 'All Circle'
            ? 'M&G'
            : circleArray[0]?.label;
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
    this.updateWeatherLogTable(payload);
    this.isCircleLevelActive = false;
    this.WeatherService.setCircleLabelClicked(false);
    localStorage.removeItem('circleClicked');
    localStorage.setItem(
      'circleClicked',
      JSON.stringify(this.isCircleLevelActive)
    );
  }

  onDistrictClick(): void {
    const payload = {
      type: 'update',
      id: this.logId,
      data: { District_clicked: 'true' },
    };

    this.updateWeatherLogTable(payload);

    this.isDistrictActive = true;
    localStorage.setItem(
      'District_clicked',
      JSON.stringify(this.isDistrictActive)
    );

    this.isCircleLevelActive = false;
    this.WeatherService.setCircleLabelClicked(false);

    //  ADD THIS LINE
    this.router.navigate(['/district']);
  }

  onCircleLevelClick(): void {
    const payload = {
      type: 'update',
      id: this.logId,
      data: {
        circleLevel_clicked: 'true',
      },
    };
    this.updateWeatherLogTable(payload);
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
    this.updateWeatherLogTable(payload);
  }
  onUsageClick(): void {
    const payload = {
      type: 'update',
      id: this.logId,
      data: {
        usage_clicked: 'true',
      },
    };
    this.updateWeatherLogTable(payload);
  }
  onTHVScoreClick(): void {
    const payload = {
      type: 'update',
      id: this.logId,
      data: {
        thvscore_clicked: 'true',
      },
    };
    this.updateWeatherLogTable(payload);
  }

  logout(): void {
    const payload = {
      logId: JSON.parse(localStorage.getItem('logId') || '{}'),
    };

    this.dataService
      .postRequest('/user_logout', payload)
      .pipe(
        catchError((error) => {
          const errorMessage =
            error?.error?.message || 'User log insertion failed';
          return throwError(() => `${error} \n ${errorMessage}`);
        })
      )
      .subscribe((res: any) => {
        if (res?.status === 'success') {
          this.loader.hide();
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('circleClicked');
          localStorage.removeItem('logId');
          this.router.navigate(['/']).then(() => {
            window.location.reload();
          });
          // window.location.href = '/login';
        }
      });
  }

  updateWeatherLogTable(payload: Object) {
    this.dataService.sendWeatherUserLog(payload).subscribe((res) => {
      if (res?.status === 'success') {
        console.log('Weather user activity logged.');
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
