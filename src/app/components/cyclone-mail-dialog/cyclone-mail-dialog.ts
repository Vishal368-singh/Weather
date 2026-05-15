import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cyclone-mail-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatSelectModule, MatFormFieldModule, FormsModule],
  templateUrl: './cyclone-mail-dialog.html',
  styleUrl: './cyclone-mail-dialog.css',
})
export class CycloneMailDialog {

  selectedCycloneCircles: string[] = [];
  selectedCycloneUsers: string[] = [];

  cycloneCircleOptions: any[] = [];
  allActiveUsers: any[] = [];

  cycloneMailUsers: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<CycloneMailDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    
    this.cycloneCircleOptions = data.circles;
    this.allActiveUsers = data.users;


    const uniqueUsers = Object.values(
      this.allActiveUsers.reduce((acc: any, user: any) => {
        acc[user.name] = user;
        return acc;
      }, {})
    );

    this.cycloneMailUsers = uniqueUsers.map((u: any, i: number) => ({
      id: i + 1,
      name: u.name,
      mail: u.mail
    }));

  }





  onCircleChange() {
    
    if (this.selectedCycloneCircles.length > 0) {
      const filteredUsers = this.allActiveUsers.filter(user =>
        this.selectedCycloneCircles.includes(user.indus_circle)
      );

      const uniqueUsers = Object.values(
        filteredUsers.reduce((acc: any, user: any) => {
          acc[user.name] = user;
          return acc;
        }, {})
      );

      this.cycloneMailUsers = uniqueUsers.map((u: any, i: number) => ({
        id: i + 1,
        name: u.name,
        mail: u.mail
      }));

    } else {
      const uniqueUsers = Object.values(
        this.allActiveUsers.reduce((acc: any, user: any) => {
          acc[user.name] = user;
          return acc;
        }, {})
      );

      this.cycloneMailUsers = uniqueUsers.map((u: any, i: number) => ({
        id: i + 1,
        name: u.name,
        mail: u.mail
      }));
    }
    this.getSelectedCirclesName();
    this.getSelectedUsersName();

  }

  getSelectedCirclesName(): string {
    
    return this.selectedCycloneCircles
      ?.map((val: string) => {
        const circle = this.cycloneCircleOptions
          .find(c => c.value === val);

        return circle?.name;
      })
      .join(', ');

  }
  getSelectedUsersName(): string {
    
    return this.selectedCycloneUsers
      ?.map((mail: string) => {
        const user = this.cycloneMailUsers.find(u => u.mail === mail);
        return user?.name;
      })
      .filter(Boolean)
      .join(', ');
  }

  sendMail() {
    const result = {
      users: this.selectedCycloneUsers
    };
    this.dialogRef.close(result);
  }


  closeDialog() {
    this.dialogRef.close();
  }

}
