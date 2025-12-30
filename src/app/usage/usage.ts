import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
// import { WeatherService } from '../services/weather';
import { DataService } from '../data-service/data-service';
import { catchError, finalize, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
declare var bootstrap: any; // needed for modal JS

// ===============================================================
@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usage.html',
  styleUrls: ['./usage.css'],
})
export class Usage implements OnInit {
  fileName: string = '';

  // Date filters
  startDateCard: string = '';
  endDateCard: string = '';

  startDate: string = '';
  endDate: string = '';

  minDate: string | Date | null = null;
  maxDate: string | Date | null = null;

  reportType: string = 'send'; // default

  sendEmails: string = '';
  selectedUser: string = '';
  selectedExportUser: string = '';

  sendingMail: boolean = false;
  selectAll: boolean = false;
  selectExportAll: boolean = false;

  userList: { id: string; name: string; checked: boolean }[] = [];
  sendUserList: { id: string; name: string; checked: boolean }[] = [];
  exportUserList: { id: string; name: string; checked: boolean }[] = [];

  userLoggedSummary: any = [];
  userLoggedRecords: any = [];

  //For Faster Update
  safeDetectChanges() {
    this.cdr.markForCheck();
  }

  constructor(
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
    // private WeatherService: WeatherService,// not used
    private DataService: DataService,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    await this.getLogMinMaxDate(); // must complete first
    await this.fetchUserLoggedSummary(); // depends on minDate/maxDate
    await this.bindUserListToOptions(); // depends on minDate/maxDate
  }

  //............... get_log_min_max_date .......................
  getLogMinMaxDate = async () => {
    try {
      const response: any = await new Promise((resolve, reject) => {
        this.DataService.postRequest('/get_log_min_max_date').subscribe({
          next: (res) => resolve(res),
          error: (error) => {
            const errorMessage =
              error?.error?.message || 'Internal Server Error';
            console.error(errorMessage);
            reject(error);
          },
        });
      });

      if (response?.status === 'success') {
        this.maxDate = response.data.max_date;
        this.minDate = response.data.min_date;

        this.startDate = this.formatForDateInput(response.data.min_date);
        this.endDate = this.formatForDateInput(response.data.max_date);

        this.startDateCard = this.startDate;
        this.endDateCard = this.endDate;
      }
    } catch (error) {
      // already logged above
    } finally {
      this.safeDetectChanges();
    }
  };

  //.........format date to yyyy-MM-dd ..........
  formatForDateInput(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0]; // yyyy-MM-dd
  }

  //.........format date to dd-MM-yyyy ..........
  formatToDDMMYYYY(date: string | Date | null): string {
    if (!date) return '';

    const d = date instanceof Date ? date : new Date(date);

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `${day}-${month}-${year}`;
  }

  // ------------------------- Dashboard Usage Summary-------------------------------
  fetchUserLoggedSummary = async () => {
    const payload = {
      startDate: this.minDate,
      endDate: this.maxDate,
    };

    try {
      const response: any = await new Promise((resolve, reject) => {
        this.DataService.postRequest(
          'get_log_summary_date_wise',
          payload
        ).subscribe({
          next: (res) => resolve(res),
          error: (error) => {
            const errorMessage =
              error?.error?.message || 'Internal Server Error';
            console.error(errorMessage);
            reject(error);
          },
        });
      });

      if (response?.status === 'success') {
        this.userLoggedSummary = [];

        const data = response.data || [];
        data.forEach((d: any) => {
          this.userLoggedSummary.push({
            login_date: this.formatForDateInput(d.login_date),
            name: d.name,
            login_count: d.login_count,
            duration: d.duration,
            userid: d.userid,
          });
        });
      }
    } catch (error) {
      // Error already logged above
      this.userLoggedSummary = [];
    } finally {
      this.safeDetectChanges();
    }
  };

  //...........On Click Summary Row ..........
  onSummaryRowClick(row: any) {
    const payload = {
      logDate: this.formatForDateInput(row.login_date),
      userid: row.userid,
    };

    this.fetchUserLoggedDateWise(payload);
  }

  //.........User Logged Date Wise ..........
  fetchUserLoggedDateWise = (payload: any) => {
    this.DataService.postRequest('/fetch_dashboad_usage', payload)
      .pipe(
        catchError((error) => {
          const errorMessage = error?.error?.message || 'Internal Server Error';
          console.log(errorMessage);
          return throwError(() => `${error} \n ${errorMessage}`);
        })
      )
      .subscribe((response) => {
        if (response.status === 'success') {
          this.userLoggedRecords = response.data;
          this.safeDetectChanges();
        }
      });
  };

  // ================= Filters =================
  applyFilter(startInput: HTMLInputElement, endInput: HTMLInputElement) {
    this.startDate = startInput.value;
    this.endDate = endInput.value;

    if (!this.startDate) {
      this.snackBar.open('Select start and end date', 'X', {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['custom-success-snackbar'],
      });

      return;
    }

    if (!this.endDate) {
      this.snackBar.open('Select end date', 'X', {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['custom-success-snackbar'],
      });
      return;
    }

    this.minDate = this.startDate;
    this.maxDate = this.endDate;
    this.fetchUserLoggedSummary();

    this.bindUserListToOptions(); // refresh user list based on new date range
  }

  /* handle Usages Report */
  async bindUserListToOptions() {
    const payload = {
      startDate: this.startDate,
      endDate: this.endDate,
    };

    try {
      const response: any = await this.DataService.postRequest(
        'get_log_user_list',
        payload
      ).toPromise();

      if (response?.status === 'success') {
        this.userList = [];
        this.sendUserList = [];
        this.exportUserList = [];

        response.data?.forEach((d: any) => {
          const user = {
            id: d.userid,
            name: d.name,
            checked: false,
          };
          this.userList.push(user);
        });

        // clone lists
        this.sendUserList = [...this.userList];
        this.exportUserList = [...this.userList];
      }
    } catch (error: any) {
      const message = error?.error?.message || 'Internal Server Error';

      this.snackBar.open(message, 'X', {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['custom-error-snackbar'],
      });
    }
  }

  //......... On "Select All" Toggle of  User list checked all user ..........
  toggleSelectAll() {
    this.sendUserList.forEach((u) => (u.checked = this.selectAll));
  }

  //......... On individual User checkbox change update "Select All" ..........
  updateSelectAll() {
    this.selectAll = this.sendUserList.every((u) => u.checked);
  }

  //......... Get selected User names for sending ..........
  getSelectedUserNames() {
    const selected = this.sendUserList
      .filter((u) => u.checked)
      .map((u) => u.name);
    return selected.length
      ? selected.length === this.sendUserList.length
        ? 'All'
        : selected.join(', ')
      : '';
  }

  //......... On "Select All" Toggle of Export User list checked all user ..........
  toggleSelectExportUser() {
    this.exportUserList.forEach((u) => (u.checked = this.selectExportAll));
  }

  //......... On individual Export User checkbox change update "Select All" ..........
  updateSelectExportUser() {
    this.selectExportAll = this.exportUserList.every((u) => u.checked);
  }

  //......... Get selected Export User names for exporting ..........
  getSelectedExportUserNames() {
    const selected = this.exportUserList
      .filter((u) => u.checked)
      .map((u) => u.name);
    return selected.length
      ? selected.length === this.exportUserList.length
        ? 'All'
        : selected.join(', ')
      : '';
  }

  //........... Send Usage Report via Email ..........
  SendUsageReport() {
    this.sendingMail = true;
    const selectedUsers = this.sendUserList
      .filter((u) => u.checked)
      .map((u) => u.id);

    if (selectedUsers.length === 0) {
      this.snackBar.open('Please select at least one user.', 'X', {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['custom-error-snackbar'],
      });
      this.sendingMail = false;
      return;
    }

    const emails = this.sendEmails.split(',');
    if (emails.length === 0 || emails[0].trim() === '') {
      this.snackBar.open('Please enter at least one email address.', 'X', {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['custom-error-snackbar'],
      });
      this.sendingMail = false;
      return;
    }

    const payload = {
      userid: selectedUsers,
      endDate: this.endDate,
      startDate: this.startDate,
      emails: emails,
      sendExport: 'send',
    };

    this.DataService.postRequesteExportData(
      'export_send_dashboard_usage',
      payload
    )
      .pipe(
        catchError((error) => {
          const message = 'Something went wrong';
          this.snackBar.open(message, 'X', {
            duration: 2000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-success-snackbar'],
          });

          return throwError(() => error);
        }),
        finalize(() => {
          this.sendingMail = false;
          this.cancelSendingMail();
          this.safeDetectChanges();
        })
      )
      .subscribe((response) => {
        if (response.status === 'success') {
          this.sendUserList = this.sendUserList.map((u) => ({
            ...u,
            checked: false,
          }));
          const modalEl = document.getElementById('usageReportModal');
          const modal = bootstrap.Modal.getInstance(modalEl!);
          modal.hide();
          this.sendingMail = false;
          this.snackBar.open(response.message, 'X', {
            duration: 2000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-success-snackbar'],
          });
          this.cancelSendingMail();
        }
      });
  }

  //........... Export Usage Report to Excel ..........
  ExportUsageReport() {
    const selectedUsers = this.exportUserList
      .filter((u) => u.checked)
      .map((u) => u.id);

    if (selectedUsers.length === 0) {
      this.snackBar.open('Please select at least one user.', 'X', {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['custom-error-snackbar'],
      });
      this.sendingMail = false;
      return;
    }

    const payload = {
      userid: selectedUsers,
      endDate: this.endDate,
      startDate: this.startDate,
      sendExport: 'export',
    };

    this.DataService.postRequesteExportData(
      'export_send_dashboard_usage',
      payload
    )
      .pipe(
        catchError((error) => {
          const message = 'Something went wrong';
          this.snackBar.open(message, 'X', {
            duration: 2000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-success-snackbar'],
          });
          return throwError(() => error);
        }),
        finalize(() => {
          this.sendingMail = false;
          this.cancelSendingMail();
          this.safeDetectChanges();
        })
      )
      .subscribe((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'weather_user_activity.xlsx';
        a.click();
      });

    const modalEl = document.getElementById('usageReportModal');
    const modal = bootstrap.Modal.getInstance(modalEl!);
    modal.hide();
    this.cancelSendingMail();
  }

  //........... Cancel Sending Mail / Exporting ..........
  cancelSendingMail() {
    this.reportType = 'send';
    this.sendEmails = '';
    this.sendingMail = false;
    this.selectAll = false;
    this.selectExportAll = false;
    const userids = this.userLoggedSummary.map((u: any) => u.userid);
    const filteredUserList = this.userList.filter((u) =>
      userids.includes(u.id)
    );
    this.sendUserList = filteredUserList.map((u) => ({ ...u, checked: false }));
    this.exportUserList = filteredUserList.map((u) => ({
      ...u,
      checked: false,
    }));
  }

  //........... Open Usage Report Modal ..........
  handleUsagesReport() {
    const modalEl = document.getElementById('usageReportModal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }
}
