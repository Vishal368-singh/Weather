import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ForceLogoutModalData {
  username: string;
  device: string;
}

@Component({
  selector: 'app-force-logout-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <div class="modal-container">
      <h2 mat-dialog-title class="modal-title">Already Logged In</h2>
      
      <mat-dialog-content class="modal-content">
        <div class="warning-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#f59e0b">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
        </div>
        
        <p class="warning-text">
          <strong>{{ data.username }}</strong> is already logged in from:
        </p>
        
        <div class="device-info">
          <span class="device-icon">📱</span>
          <span class="device-name">{{ data.device }}</span>
        </div>
        
        <p class="instruction-text">
          Do you want to logout from the other device and continue here?
        </p>
      </mat-dialog-content>
      
      <mat-dialog-actions align="end" class="modal-actions">
        <button mat-button (click)="onCancel()" class="cancel-btn">
          Cancel
        </button>
        <button mat-raised-button color="warn" (click)="onForceLogout()" class="logout-btn">
          Logout Other Device
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .modal-container {
      padding: 0;
      min-width: 400px;
      max-width: 500px;
    }
    
    .modal-title {
      background: #f8f9fa;
      padding: 20px 24px;
      margin: 0;
      border-bottom: 1px solid #e9ecef;
      font-weight: 600;
      color: #2d3748;
    }
    
    .modal-content {
      padding: 24px;
      text-align: center;
    }
    
    .warning-icon {
      margin-bottom: 20px;
    }
    
    .warning-text {
      font-size: 16px;
      color: #4a5568;
      margin-bottom: 16px;
      line-height: 1.5;
    }
    
    .device-info {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      margin: 20px 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .device-icon {
      font-size: 20px;
    }
    
    .device-name {
      font-family: 'Courier New', monospace;
      color: #2d3748;
      font-weight: 500;
    }
    
    .instruction-text {
      color: #718096;
      font-size: 14px;
      line-height: 1.6;
      margin: 20px 0 0;
    }
    
    .modal-actions {
      padding: 16px 24px;
      border-top: 1px solid #e9ecef;
      gap: 12px;
    }
    
    .cancel-btn {
      color: #718096;
    }
    
    .logout-btn {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white;
      font-weight: 500;
      padding: 8px 24px;
    }
    
    .logout-btn:hover {
      background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
    }
  `]
})
export class ForceLogoutModalComponent {
  constructor(
    public dialogRef: MatDialogRef<ForceLogoutModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ForceLogoutModalData
  ) {}

  onCancel(): void {
    this.dialogRef.close({ action: 'cancel' });
  }

  onForceLogout(): void {
    this.dialogRef.close({ action: 'force_logout' });
  }
}