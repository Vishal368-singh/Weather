import { AfterViewInit, Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { MapExportService } from '../../shared/map-export.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { WeatherService } from '../../services/weather';
import { DataService } from '../../data-service/data-service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';

@Component({
  selector: 'app-header',
  imports: [CommonModule, FormsModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
  standalone: true,
})
export class Header implements OnInit, AfterViewInit {
  @Input() isDashboard: boolean = false;
  showDropdown: boolean = false;
  today: Date = new Date();
  constructor(
    private snackBar: MatSnackBar,
    private router: Router,
    private WeatherService: WeatherService,
    private dataService: DataService,
  ) { }
  toggleDropdown() {
    this.showDropdown = !this.showDropdown;
  }
  userData: any;
  userRole: string = '';
  userName: string = '';
  userId: string = '';
  ngOnInit() {
    const sessionUser: any = sessionStorage.getItem('user')
    this.userData = JSON.parse(sessionUser)
    const username = this.userData.name;
    this.userId = this.userData.userid;
    this.userName = username.split(' ')[0];
    this.userRole = this.userData.userrole;

  }
  ngAfterViewInit(): void {

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
      if (!form.value.oldPassword || !form.value.newPassword || !form.value.confirmPassword) {
        this.snackBar.open('Enter the required details', 'X', {
          duration: 2000, // auto close after 3s
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: ['custom-error-snackbar']
        });
        return;
      }
      if (form.value.newPassword !== form.value.confirmPassword) {
        this.snackBar.open("Confirm password doesn't matched!", 'X', {
          duration: 2000, // auto close after 3s
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: ['custom-error-snackbar']
        });
        return;
      }

      // TODO: Add API call here
      const payload = {
        userId: this.userId,
        oldPassword: form.value.oldPassword,
        newPassword: form.value.newPassword,
      }
      this.dataService.postRequest("/change-password", payload)
        .pipe(
          catchError((error: any) => {
            const errorMessage = error?.error?.message || 'Internal Server Error';
            console.log(errorMessage);
            return throwError(() => error)
          })
        ).subscribe((response: any) => {
          if (response.status === 'success') {
            this.snackBar.open(response.message, 'X', {
              duration: 2000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
              panelClass: ['custom-success-snackbar']
            })
            this.closeChangePasswordModal();
          }
        })


    }
  };

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.router.navigate(['/']);
  }
}
