import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-leave-confirmation-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <div class="modal-container">
      <h2 mat-dialog-title class="modal-title">Confirm Navigation</h2>
      
      <mat-dialog-content class="modal-content">
        <div class="warning-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#f59e0b">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
        </div>
        
        <p class="warning-text">
          Are you sure you want to leave this page?
        </p>
        
        <p class="instruction-text">
          Any unsaved changes may be lost.
        </p>
      </mat-dialog-content>
      
      <mat-dialog-actions align="end" class="modal-actions">
        <button mat-button (click)="onStay()" class="stay-btn">
          Stay on Page
        </button>
        <button mat-raised-button color="warn" (click)="onLeave()" class="leave-btn">
          Leave Page
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
    
    .instruction-text {
      color: #718096;
      font-size: 14px;
      line-height: 1.6;
      margin: 0;
    }
    
    .modal-actions {
      padding: 16px 24px;
      border-top: 1px solid #e9ecef;
      gap: 12px;
    }
    
    .stay-btn {
      color: #718096;
    }
    
    .leave-btn {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      font-weight: 500;
      padding: 8px 24px;
    }
    
    .leave-btn:hover {
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    }
  `]
})
export class LeaveConfirmationModal {
  constructor(
    public dialogRef: MatDialogRef<LeaveConfirmationModal>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  onStay(): void {
    this.dialogRef.close(false);
  }

  onLeave(): void {
    this.dialogRef.close(true);
  }
}