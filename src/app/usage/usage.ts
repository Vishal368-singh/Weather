import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { WeatherService } from '../services/weather';
import { DataService } from '../data-service/data-service';
import { catchError, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
declare var bootstrap: any; // needed for modal JS

// ===== Interfaces =====
interface WhatsAppRecord {
  mobileNo: string;
  name: string;
  company: string;
  delivered: number;
  read: number;
  total: number;
  date: Date | null;
}

interface LoginRecord {
  date: string | null;
  username: string;
  loginCount: number;
  totalDurationFormatted: string;
  sessions: any[];
  [key: string]: any;
}

interface UsageData {
  date: string;
  login_count: number;
  total_duration_minutes: number;
  userid: string;
  username: string;
}

interface DashboardUsage {
  [userid: string]: UsageData[];
}

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
  startDate: string = '';
  endDate: string = '';
  minDate: Date | null = null;
  maxDate: Date | null = null;

  LminDate: Date | null = null;
  LmaxDate: Date | null = null;
  LstartDate: string = '';
  LendDate: string = '';

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

  // WhatsApp data
  private originalWhatsAppData: WhatsAppRecord[] = [];
  filteredWhatsAppData: WhatsAppRecord[] = [];

  // Login data
  originalLoginData: LoginRecord[] = [];
  filteredLoginData: LoginRecord[] = [];
  userColumns: string[] = [];
  filteredUserColumns: string[] = [];
  searchUser: string = '';
  userNotFound: boolean = false;

  // Dashboard Usages Data
  dashboardUsageData: any = [];
  storedDashboardUsageData: any = [];

  uploadedFileType: 'whatsapp' | null = null;

  //For Faster Update
  safeDetectChanges() {
    this.cdr.markForCheck();
  }

  // Hardcoded WhatsApp user mapping
  fixedUsers: { mobileNo: string; name: string; company: string }[] = [
    { mobileNo: '918083289760', name: 'Ravi Dev', company: 'ML Infomap' },
    { mobileNo: '918535006973', name: 'Ashish Gupta', company: 'Indus Tower' },
    { mobileNo: '919315132167', name: 'Rizwan', company: 'ML Infomap' },
    { mobileNo: '919560604422', name: 'Subodh', company: 'ML Infomap' },
    {
      mobileNo: '919630090570',
      name: 'Abhishek Shrivastava',
      company: 'Indus Tower',
    },
    { mobileNo: '919910995024', name: 'Jatin Gautam', company: 'Indus Tower' },
    { mobileNo: '919962001764', name: 'M Siva Kumar', company: 'Indus Tower' },
    { mobileNo: '919654785670', name: 'Yogendra', company: 'ML Infomap' },
    {
      mobileNo: '919794652453',
      name: 'Shailesh Singh',
      company: 'Indus Tower',
    },
    { mobileNo: '919810294592', name: 'Atul Sir', company: 'ML Infomap' },
    { mobileNo: '919818338464', name: 'Aditya', company: 'ML Infomap' },
    { mobileNo: '919871320275', name: 'Arun Sharma', company: 'Indus Tower' },
  ];

  targetUsers: { [key: string]: string } = {
    abhishek: 'Abhishek Alekh Saini',
    arun: 'Arun Sharma',
    ashish: 'Ashish Gupta',
    dharmendra: 'Dharmendra Kumar',
    jatin: 'Jatin Gautam',
    siva: 'M Siva Kumar',
    mukesh: 'Mukesh Kuma Choubey',
    prakhar: 'Prakhar Verma',
  };

  constructor(
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
    private WeatherService: WeatherService,
    private DataService: DataService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.filteredUserColumns = [...this.userColumns];
    // this.fetchLoginData();
    this.bindUserListToOptions();
    this.fetch_dashboard_usages();
  }

  // ================= Login Data from Backend =================
  fetchLoginData() {
    this.http.get<any[]>('http://localhost:3000/api/usage-report').subscribe({
      next: (data) => {
        const filteredUsers = data.filter((u) =>
          Object.keys(this.targetUsers).includes(u.username?.toLowerCase())
        );

        const transformed: LoginRecord[] = filteredUsers.map((u) => {
          let totalDuration = 0;

          u.sessions.forEach((s: any) => {
            const start = new Date(s.login_time).getTime();
            const end = s.logout_time
              ? new Date(s.logout_time).getTime()
              : start;
            totalDuration += Math.max(0, (end - start) / (1000 * 60));

            const actions: string[] = [];
            if (s.dashboard_clicked) actions.push('Dashboard');
            if (s.circlelevel_clicked) actions.push('Circle');
            if (s.search_term) actions.push('Search');
            if (s.view_on_map_clicked === 'yes') actions.push('Map View');
            if (s.today_btn_clicked === 'yes') actions.push('Today');
            if (s.tomorrow_btn_clicked === 'yes') actions.push('Tomorrow');
            if (s.today_temp_clicked === 'yes') actions.push('Temp');
            if (s.today_rain_clicked === 'yes') actions.push('Rain');
            if (s.today_wind_clicked === 'yes') actions.push('Wind');
            if (s.today_humidity_clicked === 'yes') actions.push('Humidity');
            if (s.today_visibility_clicked === 'yes')
              actions.push('Visibility');
            if (s.tomorrow_temp_clicked === 'yes') actions.push('Tmr Temp');
            if (s.tomorrow_rain_clicked === 'yes') actions.push('Tmr Rain');
            if (s.tomorrow_wind_clicked === 'yes') actions.push('Tmr Wind');
            if (s.tomorrow_humidity_clicked === 'yes')
              actions.push('Tmr Humidity');
            if (s.tomorrow_visibility_clicked === 'yes')
              actions.push('Tmr Visibility');
            if (s.tower_clicked === 'yes') actions.push('Tower');
            if (s.lasso_tool_clicked === 'yes') actions.push('Lasso');
            if (s.usage_clicked === 'yes') actions.push('Usage');
            if (s.thvscore_clicked) actions.push(`THV:${s.thvscore_clicked}`);
            s.actions = actions.length > 0 ? actions : ['-'];
          });

          const hrs = Math.floor(totalDuration / 60);
          const mins = Math.round(totalDuration % 60);

          return {
            username: this.targetUsers[u.username.toLowerCase()] || u.username,
            loginCount: u.sessions.length,
            totalDurationFormatted: `${hrs > 0 ? hrs + 'h ' : ''}${mins}m`,
            sessions: u.sessions,
            date: u.sessions[0]?.login_time
              ? new Date(u.sessions[0].login_time).toLocaleDateString('en-GB')
              : null,
          };
        });

        this.originalLoginData = transformed;
        this.userColumns = transformed.map((u) => u.username);
        this.filteredUserColumns = [...this.userColumns];

        this.applyLoginFilter();

        if (transformed.length > 0) {
          const allDates = transformed.flatMap((u) =>
            u.sessions.map((s: any) => new Date(s.login_time).getTime())
          );
          this.LminDate = new Date(Math.min(...allDates));
          this.LmaxDate = new Date(Math.max(...allDates));
          if (!this.LstartDate && !this.LendDate) {
            this.LstartDate = this.LminDate.toISOString().split('T')[0];
            this.LendDate = this.LmaxDate.toISOString().split('T')[0];
          }
        }

        this.safeDetectChanges();
      },
      error: (err) => {
        console.error('Failed to fetch login data:', err);
      },
    });
  }

  // ================= Filters =================
  applyFilter() {
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
    if (this.uploadedFileType === 'whatsapp') this.applyWhatsAppFilter();
    if (this.originalLoginData.length > 0) this.applyLoginFilter();
    this.filterDashboardData(this.startDate, this.endDate);
  }

  applyLoginFilter() {
    const start = this.startDate ? new Date(this.startDate) : null;
    const end = this.endDate ? new Date(this.endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    let filtered = this.originalLoginData.filter((r) => {
      const recDate = r.date ? new Date(r.date) : null;
      return (
        (!start || (recDate && recDate >= start)) &&
        (!end || (recDate && recDate <= end))
      );
    });

    if (this.searchUser?.trim()) {
      const term = this.searchUser.toLowerCase();
      const matches = this.userColumns.filter((u) =>
        u.toLowerCase().includes(term)
      );
      if (matches.length > 0) {
        this.filteredUserColumns = matches;
        filtered = filtered.filter((r) => matches.includes(r.username));
        this.userNotFound = false;
      } else {
        this.filteredUserColumns = [...this.userColumns];
        this.userNotFound = true;
        setTimeout(() => {
          this.userNotFound = false;
          this.safeDetectChanges();
        }, 3000);
      }
    } else {
      this.filteredUserColumns = [...this.userColumns];
    }

    this.filteredLoginData = filtered;

    if (filtered.length) {
      const dates = filtered
        .map((r) => r.date)
        .filter((d): d is string => !!d)
        .map((d) => new Date(d));
      this.LminDate = new Date(Math.min(...dates.map((d) => d.getTime())));
      this.LmaxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    } else {
      this.LminDate = this.LmaxDate = null;
    }
  }

  clearFilter() {
    this.startDate = '';
    this.endDate = '';
    this.filteredWhatsAppData = [];
    this.originalWhatsAppData = [];
    this.uploadedFileType = null;
    this.fileName = '';
    this.dashboardUsageData = this.storedDashboardUsageData;
    const userids = this.dashboardUsageData.map((u: any) => u.userid);
    const filteredUserList = this.userList.filter((u) =>
      userids.includes(u.id)
    );
    this.sendUserList = filteredUserList.map((u) => ({ ...u, checked: false }));
    this.exportUserList = filteredUserList.map((u) => ({
      ...u,
      checked: false,
    }));
  }

  // ================= WhatsApp CSV Upload =================
  onFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    this.fileName = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const headers = text
        .split(/\r?\n/)[0]
        .split(',')
        .map((h) =>
          h
            .replace(/^\ufeff/, '')
            .replace(/^"|"$/g, '')
            .trim()
            .toLowerCase()
        );
      const whatsappHeaders = ['requestedat', 'customernumber'];
      if (whatsappHeaders.every((h) => headers.includes(h))) {
        this.uploadedFileType = 'whatsapp';
        this.processWhatsAppCSV(text);
      } else {
        alert('Unsupported file. Please upload a WhatsApp CSV.');
      }
    };
    reader.readAsText(file);
  }

  private processWhatsAppCSV(data: string) {
    const lines = data.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const customerIdx = headers.indexOf('customernumber');
    const statusIdx = headers.indexOf('status');
    const readIdx = headers.indexOf('readtime');
    const sentIdx = headers.indexOf('senttime');

    if (customerIdx === -1 || statusIdx === -1 || readIdx === -1) return;

    const rawRows: WhatsAppRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]
        .split(',')
        .map((c) => c.trim().replace(/["']/g, ''));
      if (cols.length <= Math.max(customerIdx, statusIdx, readIdx)) continue;

      let raw = cols[customerIdx];
      if (raw.includes('E')) raw = Number(raw).toFixed(0);

      const status = cols[statusIdx].toLowerCase();
      const readTime = cols[readIdx];
      const sentTime = sentIdx !== -1 ? cols[sentIdx] : '';

      let parsedDate: Date | null = null;
      if (sentTime) {
        const d = new Date(sentTime.replace(/-/g, '/'));
        if (!isNaN(d.getTime())) parsedDate = d;
      }

      let userInfo = this.fixedUsers.find((u) => u.mobileNo === raw);
      if (!userInfo)
        userInfo = this.fixedUsers.find(
          (u) => u.mobileNo.slice(0, 7) === raw.slice(0, 7)
        );

      rawRows.push({
        mobileNo: userInfo?.mobileNo || raw,
        name: userInfo?.name || 'Unknown',
        company: userInfo?.company || 'Unknown',
        delivered: status === 'delivered' ? 1 : 0,
        read: readTime ? 1 : 0,
        total: 1,
        date: parsedDate,
      });
    }

    this.originalWhatsAppData = rawRows;
    this.applyWhatsAppFilter();

    const allDates = rawRows
      .map((r) => r.date as Date)
      .filter((d) => d && !isNaN(d.getTime()));
    if (allDates.length > 0) {
      this.minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
      this.maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
      if (!this.startDate && !this.endDate) {
        this.startDate = this.minDate.toISOString().split('T')[0];
        this.endDate = this.maxDate.toISOString().split('T')[0];
      }
    }
  }

  applyWhatsAppFilter() {
    const start = this.startDate ? new Date(this.startDate) : null;
    const end = this.endDate ? new Date(this.endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    this.filteredWhatsAppData = this.groupWhatsAppData(
      this.originalWhatsAppData.filter(
        (rec) =>
          rec.date && (!start || rec.date >= start) && (!end || rec.date <= end)
      )
    );
  }

  private groupWhatsAppData(rows: WhatsAppRecord[]): WhatsAppRecord[] {
    const grouped: { [mobile: string]: WhatsAppRecord } = {};
    rows.forEach((row) => {
      if (!grouped[row.mobileNo]) grouped[row.mobileNo] = { ...row };
      else {
        grouped[row.mobileNo].delivered += row.delivered;
        grouped[row.mobileNo].read += row.read;
        grouped[row.mobileNo].total += row.total;
      }
    });
    return Object.values(grouped).sort((a, b) => {
      const cmp = a.company.localeCompare(b.company);
      return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
    });
  }

  // ================= CSV Download =================
  private escapeCsvField(field: any): string {
    const s = String(field ?? '');
    return /,|"|\n/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  downloadCSV() {
    const headers = 'Mobile No,Name,Company,Delivered,Read,Total\n';
    const rows = this.filteredWhatsAppData
      .map((r) =>
        [r.mobileNo, r.name, r.company, r.delivered, r.read, r.total]
          .map(this.escapeCsvField)
          .join(',')
      )
      .join('\n');

    const fileName = `whatsapp-report-${
      this.minDate?.toISOString().split('T')[0]
    }_${this.maxDate?.toISOString().split('T')[0]}.csv`;
    this.downloadFile(fileName, headers + rows);
  }

  downloadAllCSV() {
    const headers = ['Date', ...this.userColumns].join(',') + '\n';
    const rows = this.filteredLoginData
      .map((r) =>
        [
          r.date,
          ...this.userColumns.map((u) => this.escapeCsvField(r[u])),
        ].join(',')
      )
      .join('\n');

    const fileName = `dashboard-usage-report-${
      this.LminDate?.toISOString().split('T')[0]
    }_${this.LmaxDate?.toISOString().split('T')[0]}.csv`;
    this.downloadFile(fileName, headers + rows);
  }

  private downloadFile(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ------------------------- Dashboard Usage -------------------------------

  fetch_dashboard_usages = () => {
    const payload = {
      usage_type: 'dashboard',
    };

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
          const responseData = response.data;
          const userids = Object.keys(response.data).map((id) => id);
          const filteredUserList = this.userList.filter((u) =>
            userids.includes(u.id)
          );
          this.sendUserList = filteredUserList.map((u) => ({
            ...u,
            checked: false,
          }));
          this.exportUserList = filteredUserList.map((u) => ({
            ...u,
            checked: false,
          }));
          for (const userId in responseData) {
            if (responseData.hasOwnProperty(userId)) {
              const userRows = responseData[userId];
              userRows.forEach((row: any) => {
                this.dashboardUsageData.push({
                  ...row,
                  total_duration_minutes: this.formatDuration(
                    row.total_duration_minutes
                  ),
                });
              });
            }
          }
          this.storedDashboardUsageData = this.dashboardUsageData;
          this.safeDetectChanges();
        }
      });
  };
  // Helper function to format minutes to HH:mm
  formatDuration(minutes: number): string {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hrs > 0 ? hrs + 'h ' : ''}${mins}m`;
  }

  filterDashboardData(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Filter the dashboardUsageData
    const filtered = this.dashboardUsageData.filter((item: any) => {
      // Parse item.date (format: 25-Sep-2025)
      const itemDate = new Date(item.date.replace(/-/g, ' '));

      return itemDate >= start && itemDate <= end;
    });
    const userids = filtered.map((u: any) => u.userid);
    const filteredUserList = this.userList.filter((u) =>
      userids.includes(u.id)
    );
    // Update or return filtered data
    this.dashboardUsageData = filtered;
    this.sendUserList = filteredUserList.map((u) => ({
      ...u,
      checked: false,
    }));
    this.exportUserList = filteredUserList.map((u) => ({
      ...u,
      checked: false,
    }));
  }

  /* handle Usages Report */

  bindUserListToOptions() {
    this.DataService.postData('get-user-list')
      .pipe(
        catchError((error) => {
          const message = error?.error?.message || 'Internal Server Error';
          this.snackBar.open(message, 'X', {
            duration: 2000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-success-snackbar'],
          });
          return throwError(() => error);
        })
      )
      .subscribe((response) => {
        if (response.status === 'success') {
          const data = response.data;
          data?.forEach((d: any) => {
            let user = { id: d.userid, name: d.name, checked: false };
            this.userList.push({ ...user });
          });
        }
      });
  }

  toggleSelectAll() {
    this.sendUserList.forEach((u) => (u.checked = this.selectAll));
  }

  updateSelectAll() {
    this.selectAll = this.sendUserList.every((u) => u.checked);
  }

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

  toggleSelectExportUser() {
    this.exportUserList.forEach((u) => (u.checked = this.selectExportAll));
  }

  updateSelectExportUser() {
    this.selectExportAll = this.exportUserList.every((u) => u.checked);
  }

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

  calculateDuration(login: string, logout: string): string {
    const start = new Date(login);
    const end = new Date(logout);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '0m';
    let diff = Math.floor((end.getTime() - start.getTime()) / 1000); // seconds
    const hours = Math.floor(diff / 3600);
    diff %= 3600;
    const minutes = Math.floor(diff / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  getFlattenedUsageData(dashboardData: any[], selectedUserIds: string[]) {
    const allUsersFlattened: any[] = [];

    selectedUserIds.forEach((userId) => {
      const userRows: any[] = [];
      const userRecords = dashboardData.filter((d) => d.userid === userId);

      userRecords.forEach((day) => {
        day.sessions.forEach((session: any) => {
          if (!session.logout_time) return;

          const user = this.userList.find((u) => u.id === day.userid);
          const name = user ? user.name : '';

          const duration = this.calculateDuration(
            session.login_time,
            session.logout_time
          );
          const durationMinutes = this.convertDurationToMinutes(duration);
          if (durationMinutes < 1 || durationMinutes >= 60) {
            return;
          }

          userRows.push({
            User_Id: day.userid,
            Name: name,
            Login_Date_Time: session.login_time,
            Logout_Date_Time: session.logout_time,
            Total_Duration: duration,
            User_Actions: session.fields ?? [],
          });
        });
      });

      allUsersFlattened.push(userRows);
    });

    return allUsersFlattened;
  }

  convertDurationToMinutes(duration: string): number {
    let hours = 0;
    let minutes = 0;

    if (duration.includes('h')) {
      const h = duration.split('h')[0].trim();
      hours = Number(h);
    }

    if (duration.includes('m')) {
      const parts = duration.split('h');
      const minPart = parts.length > 1 ? parts[1] : parts[0];
      minutes = Number(minPart.replace('m', '').trim());
    }

    return hours * 60 + minutes;
  }

  SendUsageReport() {
    this.sendingMail = true;
    const selectedUsers = this.sendUserList
      .filter((u) => u.checked)
      .map((u) => u.id);
    const dataToSend = this.getFlattenedUsageData(
      this.dashboardUsageData,
      selectedUsers
    );
    const emails = this.sendEmails.split(',');
    const payload = {
      emails: emails,
      data: dataToSend,
    };

    this.DataService.postData('send_usage_report', payload)
      .pipe(
        catchError((error) => {
          const message = error?.error?.message || 'Internal Server Error';
          return throwError(() => error);
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

  ExportUsageReport() {
    const selectedUsers = this.exportUserList
      .filter((u) => u.checked)
      .map((u) => u.id);

    const dataToSend = this.getFlattenedUsageData(
      this.dashboardUsageData,
      selectedUsers
    );

    if (!dataToSend?.length) {
      alert('No data to export');
      return;
    }

    const workbook = XLSX.utils.book_new();

    dataToSend.forEach((userRows, index) => {
      if (!userRows.length) return;

      const name = userRows[0].Name || `User_${index + 1}`;

      const formatHeader = (header: string) => {
        if (header === 'Login_Date_Time') return 'Login Date & Time';
        if (header === 'Logout_Date_Time') return 'Logout Date & Time';
        return header.replace(/_/g, ' ');
      };

      const cleanRows = userRows.map((row: any) => {
        const formattedRow: any = {};
        Object.keys(row).forEach((key) => {
          const newHeader = formatHeader(key);

          let value = row[key];
          if (Array.isArray(value)) value = value.join(', ');

          formattedRow[newHeader] = value;
        });
        return formattedRow;
      });

      const sheet = XLSX.utils.json_to_sheet(cleanRows);

      const headers = Object.keys(cleanRows[0]);
      headers.forEach((header, colIndex) => {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: colIndex });

        if (!sheet[cellAddress]) return;

        sheet[cellAddress].s = {
          font: { bold: true },
        };
      });

      const columnWidths: any[] = [];
      headers.forEach((header, colIndex) => {
        let maxLen = header.length;
        cleanRows.forEach((row: any) => {
          const cellVal = row[header] ? String(row[header]) : '';
          maxLen = Math.max(maxLen, cellVal.length);
        });
        columnWidths[colIndex] = { wch: maxLen + 3 };
      });

      sheet['!cols'] = columnWidths;

      XLSX.utils.book_append_sheet(workbook, sheet, name.substring(0, 31));
    });

    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    saveAs(blob, 'usage_report.xlsx');
    const modalEl = document.getElementById('usageReportModal');
    const modal = bootstrap.Modal.getInstance(modalEl!);
    modal.hide();
    this.cancelSendingMail();
  }

  formattedHeaders(header: string) {
    if (header === 'Login_Date_Time') return 'Login Date & Time';
    if (header === 'Logout_Date_Time') return 'Logout Date & Time';
    return header.split('_').join(' ');
  }

  cancelSendingMail() {
    this.reportType = 'send';
    this.sendEmails = '';
    this.sendingMail = false;
    this.selectAll = false;
    this.selectExportAll = false;
    const userids = this.dashboardUsageData.map((u: any) => u.userid);
    const filteredUserList = this.userList.filter((u) =>
      userids.includes(u.id)
    );
    this.sendUserList = filteredUserList.map((u) => ({ ...u, checked: false }));
    this.exportUserList = filteredUserList.map((u) => ({
      ...u,
      checked: false,
    }));
  }

  handleUsagesReport() {
    const modalEl = document.getElementById('usageReportModal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }
}
