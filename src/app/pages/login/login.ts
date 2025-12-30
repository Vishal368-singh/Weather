import {
  Component,
  AfterViewInit,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
  HostListener,
  Inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../data-service/data-service';
import { catchError } from 'rxjs/operators';
import { EMPTY, throwError } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DeviceDetectorService } from 'ngx-device-detector';
import { WeatherService } from '../../services/weather';
import { DateTimeService } from '../../services/date-time';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-login',
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
})
export class Login implements AfterViewInit {
  @ViewChild('networkCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  email: string = '';
  password: string = '';
  errorMessage: string = '';
  deviceInfo: any = '';
  isMobile: any = '';
  isTablet: any = '';
  isDesktop: any = '';
  isLoading: boolean = false;
  typeSelected = 'ball-spin-clockwise';
  private ctx!: CanvasRenderingContext2D;
  private width!: number;
  private height!: number;
  private dots: any[] = [];
  private config = { dotCount: 70, maxDistance: 150 };
  openPopupModal: boolean = false;
  alreadyLoggedUser: string = '';
  alreadyLoggedDevice: string = '';
  alreadyLogID: any;
  alreadyLoggedUserID: string = '';
  lastLoggedTime: string = '';

  constructor(
    private dataService: DataService,
    private router: Router,
    private deviceService: DeviceDetectorService,
    private WeatherService: WeatherService,
    private dateTimeService: DateTimeService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {
    let storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      if (user.userrole === 'H_MGMT') {
        this.router.navigate(['/hazards-feed'], {
          queryParams: { from: 'login' },
        });
      } else {
        this.router.navigate(['/dashboard'], {
          queryParams: { from: 'login' },
        });
      }

      return;
    }
  }
  ngOnInit(): void {}

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resizeCanvas();
    this.createDots();
    this.draw();
  }

  @HostListener('window:resize')
  onResize() {
    this.resizeCanvas();
    this.createDots();
  }

  onCancel(): void {
    this.openPopupModal = false; // user cancelled
  }

  /** Confirm force logout */
  onForceLogout(): void {
    const payload = {
      userId: this.alreadyLoggedUserID,
      logId: this.alreadyLogID,
    };
    this.dataService
      .forceLogout('force-logout', payload)
      .subscribe((res: any) => {
        if (res.status === 'success') {
          this.openPopupModal = false;
          this.snackBar.open(res.msg, 'X', {
            duration: 2000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-success-snackbar'],
          });
        }
        this.cdr.detectChanges();
      });
  }

  private resizeCanvas() {
    const canvas = this.canvasRef.nativeElement;
    this.width = canvas.width = window.innerWidth;
    this.height = canvas.height = window.innerHeight;
  }

  private createDots() {
    this.dots = [];
    for (let i = 0; i < this.config.dotCount; i++) {
      this.dots.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 1,
        vy: (Math.random() - 0.5) * 1,
        radius: Math.random() * 3 + 3,
        color: `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(
          Math.random() * 255
        )}, 255, 1)`,
      });
    }
  }

  private draw = () => {
    //  Restored appealing bluish background gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#0a2540');
    gradient.addColorStop(1, '#063632ff');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);

    for (let i = 0; i < this.dots.length; i++) {
      const d = this.dots[i];
      d.x += d.vx;
      d.y += d.vy;

      if (d.x < 0 || d.x > this.width) d.vx *= -1;
      if (d.y < 0 || d.y > this.height) d.vy *= -1;

      // 💡 Bulb-like glow using radial gradient
      const glowRadius = d.radius * 8;
      const radial = this.ctx.createRadialGradient(
        d.x,
        d.y,
        0,
        d.x,
        d.y,
        glowRadius
      );
      radial.addColorStop(0, d.color);
      radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.beginPath();
      this.ctx.fillStyle = radial;
      this.ctx.arc(d.x, d.y, glowRadius, 0, Math.PI * 2);
      this.ctx.fill();

      // Core dot
      this.ctx.beginPath();
      this.ctx.fillStyle = d.color;
      this.ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Lines between close dots
      for (let j = i + 1; j < this.dots.length; j++) {
        const d2 = this.dots[j];
        const dist = Math.hypot(d.x - d2.x, d.y - d2.y);
        if (dist < this.config.maxDistance) {
          this.ctx.beginPath();
          this.ctx.moveTo(d.x, d.y);
          this.ctx.lineTo(d2.x, d2.y);
          this.ctx.strokeStyle =
            'rgba(255, 255, 255, ' + (1 - dist / this.config.maxDistance) + ')';
          this.ctx.lineWidth = 2;
          this.ctx.stroke();
        }
      }
    }
    requestAnimationFrame(this.draw);
  };

  // login handlining logic
  handleLogin() {
    this.isLoading = true;
    const params = {
      username: this.email,
      userpassword: this.password,
    };

    this.dataService
      .login(params)
      .pipe(
        catchError((error) => {
          // Handle already logged-in case
          if (error?.error?.status === 'already_logged_in') {
            this.isLoading = false;
            const data = error?.error?.data;
            this.alreadyLoggedUser = data.name;
            this.alreadyLoggedDevice = data.loggedin_device;
            this.lastLoggedTime = data.login_time;
            this.alreadyLogID = data.log_id;
            this.alreadyLoggedUserID = data.userid;
            this.openPopupModal = true;
            this.cdr.detectChanges();
            return EMPTY;
          }
          const errorMessage =
            error?.error?.msg || 'Login failed. Please try again.';
          this.snackBar.open(errorMessage, 'X', {
            duration: 2000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-error-snackbar'],
          });
          this.isLoading = false;
          this.cdr.detectChanges();
          return throwError(() => error);
        })
      )
      .subscribe((res: any) => {
        const data = res.data;
        if (data?.token) {
          localStorage.setItem('user', JSON.stringify(data.resultUser));
          localStorage.setItem('token', data.token);
          localStorage.setItem('logId', data.logId);
          this.isLoading = false;
          // Immediately navigate user
          if (data.resultUser.userrole === 'H_MGMT') {
            this.router.navigate(['/hazards-feed'], {
              queryParams: { from: 'login' },
            });
          } else {
            this.WeatherService.setCircleLabelClicked(false);
            this.router.navigate(['/dashboard'], {
              queryParams: { from: 'login' },
            });
          }
        }
      });
  }
}
