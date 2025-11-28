import {
  Component,
  AfterViewInit,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../data-service/data-service';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DeviceDetectorService } from 'ngx-device-detector';
import { WeatherService } from '../../services/weather';
import { DateTimeService } from '../../services/date-time';
import { MatSnackBar } from '@angular/material/snack-bar';

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

  private ctx!: CanvasRenderingContext2D;
  private width!: number;
  private height!: number;
  private dots: any[] = [];
  private config = { dotCount: 70, maxDistance: 150 };

  constructor(
    private dataService: DataService,
    private router: Router,
    private deviceService: DeviceDetectorService,
    private weatherService: WeatherService,
    private dateTimeService: DateTimeService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

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
      .postData(`userLogin`, params)
      .pipe(
        catchError((error) => {
          const errorMessage =
            error?.error?.message || 'Login failed. Please try again.';
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
        if (res?.token) {
          localStorage.setItem('user', JSON.stringify(res.resultUser));
          localStorage.setItem('token', res.token);

          this.deviceInfo = this.deviceService.getDeviceInfo();
          const Dev_Type = this.deviceInfo.deviceType;
          const Dev_Os = this.deviceInfo.os;
          const Dev_Brow = this.deviceInfo.browser;
          const Dev_Os_ver = this.deviceInfo.os_version;

          const { formattedDate, formattedTime } =
            this.dateTimeService.getCurrentDateTime();

          let payload = {
            type: 'login',
            data: {
              userid: res.resultUser.userid,
              username: res.resultUser.username,
              loggedin_device: `${Dev_Type}-${Dev_Os}-${Dev_Brow}-${Dev_Os_ver}`,
              login_time: `${formattedDate} ${formattedTime}`,
            },
          };
          this.isLoading = false;
          //  IMMEDIATE NAVIGATION (NO WAITING)
          // Immediately navigate user
          if (res.resultUser.userrole === 'H_MGMT') {
            this.router.navigate(['/hazards-feed'], {
              queryParams: { from: 'login' },
            });
          } else {
            this.router.navigate(['/dashboard'], {
              queryParams: { from: 'login' },
            });
          }

          // Fire user activity log in background (non-blocking)
          setTimeout(() => {
            this.dataService
              .sendWeatherUserLog(`weather_user_activity`, payload)
              .subscribe({
                next: (res: any) => {
                  if (res?.status === 'success') {
                    localStorage.setItem('logId', res.id);
                    this.weatherService.setWeatherLogId(res.id);
                  }
                },
                error: () => {},
              });
          }, 0);
          
        } else {
          this.isLoading = false;
          this.snackBar.open('Invalid login response', 'X', {
            duration: 2000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-error-snackbar'],
          });
        }
      });
  }
}
