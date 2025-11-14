import {
  Component,
  OnInit,
  AfterViewInit,
  ChangeDetectorRef,
} from '@angular/core';
import { DataService } from '../../data-service/data-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { throwError, catchError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
declare var bootstrap: any; // needed for modal JS
@Component({
  selector: 'app-profile',
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit, AfterViewInit {
  constructor(
    private snackBar: MatSnackBar,
    private dataService: DataService,
    private cdr: ChangeDetectorRef
  ) {}

  user: any = null;
  userRole: string = '';
  roles: string[] = [];
  userList: any = [];
  selectedUser: any;
  previousStatus: string = '';
  isEditModalOpen = false;
  isCheckboxChecked: boolean = false;
  editableUser: any = {};
  newUser: any = {
    name: '',
    username: '',
    userid: '',
    password: '',
    status: '',
    role: '',
    mail: '',
    mobile: '',
    indus_circle: '',
  };

  userLicense: string = '';
  editedLicense: string = '';

  ngOnInit(): void {
    let storedUser = localStorage.getItem('user');
    if (storedUser) {
      this.user = JSON.parse(storedUser);
      this.userRole = this.user.userrole;
    }
    if (this.user.userrole === 'Admin' || this.user.userrole === 'MLAdmin') {
      this.fetchUserList();
      this.fetchUserLicense();
    }
  }

  ngAfterViewInit(): void {}

  /* Fetch User License */
  fetchUserLicense = async () => {
    try {
      this.dataService
        .postData('/get-user-license')
        .pipe(
          catchError((error: any) => {
            const errorMessage =
              error?.error?.message || 'Internal Server Error';
            console.log(errorMessage);
            return throwError(() => error);
          })
        )
        .subscribe((res: any) => {
          
          if (res.status === 'success') {
            this.userLicense = res.data[0].allowed_users;
            this.cdr.detectChanges();
          }
        });
    } catch (error: any) {
      console.log(error);
    }
  };

  /* Fetch Users List  */
  fetchUserList = async () => {
    try {
      this.dataService.postData('get-user-list').subscribe(async (res: any) => {
        
        let data = res.data;
        let usersArray: {
          userid: any;
          name: any;
          username: any;
          password: any;
          role: any;
          indus_circle: any;
          mail: any;
          status: any;
        }[] = [];
    
        data.forEach((user: any) => {
          let userObj = {
            userid: user.userid,
            name: user.name,
            username: user.username,
            password: user.password,
            role: user.role,
            indus_circle: user.indus_circle,
            mail: user.mail,
            status: user.status,
            mobile: user.mobile,
          };
          usersArray.push(userObj);
      
        });
        let newUserData = data.filter(
          (u: any) => u.userid === this.user.userid
        );
        this.user = {
          userid: newUserData[0].userid,
          name: newUserData[0].name,
          username: newUserData[0].username,
          password: newUserData[0].password,
          role: newUserData[0].role,
          indus_circle: newUserData[0].indus_circle,
          mail: newUserData[0].mail,
          status: newUserData[0].status,
          mobile: newUserData[0].mobile,
        };

        this.roles = [
          ...new Set(usersArray.map((user) => user.role).filter(Boolean)),
        ];
     

        usersArray = usersArray.filter(
          (user) => user.userid !== this.user.userid
        );
      
        this.userList = [];
        this.userList.push(...usersArray);

        this.cdr.detectChanges();
      });
    } catch (error) {
      console.log(`Error while fetching user list : ${error}`);
    }
  };

  /* Open Confirmation Modal for Status Update */
  openConfirmDialog(event: Event, user: any) {
    const checked = (event.target as HTMLInputElement).checked;
    this.isCheckboxChecked = checked;
   
    event.preventDefault();
    event.stopPropagation();
    this.selectedUser = user;
    const modalElement = document.getElementById('confirmModal');
    const modal = new bootstrap.Modal(modalElement!);
    modal.show();
  }

  confirmStatusChange() {
    const payload = {
      id: this.selectedUser.userid,
      status: this.isCheckboxChecked === true ? 'active' : 'inactive',
    };
    this.dataService
      .postRequest('/update_user_status', payload)
      .pipe(
        catchError((error: any) => {
          const errorMessage = error?.error?.message;
          
          this.snackBar.open(errorMessage, 'X', {
            duration: 2000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-error-snackbar'],
          });

          return throwError(() => error);
        })
      )
      .subscribe(async (res: any) => {
        if (res.status === 'success') {
          this.snackBar.open(res.message, 'X', {
            duration: 2000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-success-snackbar'],
          });
          await this.fetchUserList();
          this.cdr.detectChanges();
        }
      });

    const modalElement = document.getElementById('confirmModal');
    const modal = bootstrap.Modal.getInstance(modalElement!);
    modal.hide();
  }

  cancelStatusChange() {
    const modalElement = document.getElementById('confirmModal');
    const modal = bootstrap.Modal.getInstance(modalElement!);
    modal.hide();
  }

  /* Edit User Detials and Save it to Database */
  onEdit(user: any) {
    this.selectedUser = { ...user };
    this.isEditModalOpen = true;
  }

  saveEdit() {
    const index = this.userList.findIndex(
      (u: any) => u.userid === this.selectedUser.userid
    );
    if (index !== -1) {
      this.userList[index] = { ...this.selectedUser };
    }
    const payload = {
      id: this.selectedUser.userid,
      data: {
        name: this.selectedUser.name,
        role: this.selectedUser.role,
        indus_circle: this.selectedUser.indus_circle,
        mobile: this.selectedUser.mobile,
        mail: this.selectedUser.mail,
      },
    };
    this.dataService
      .postData('/update_user', payload)
      .pipe(
        catchError((error: any) => {
          const errorMessage = error?.error?.message || 'User updation failed!';
          this.snackBar.open(errorMessage, 'X', {
            duration: 2000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-success-snackbar'],
          });
          return throwError(() => error);
        })
      )
      .subscribe((res: any) => {
        if (res.status === 'success') {
          this.snackBar.open(res.message, 'X', {
            duration: 2000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-success-snackbar'],
          });
        }
        
      });
    this.closeEditModal();
  }

  closeEditModal() {
    this.isEditModalOpen = false;
    this.selectedUser = null;
  }

  /* Add new User with the required details */
  addNewUser() {
    const modalEl = document.getElementById('addNewUserModal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  submitNewUser() {
   

    const payload = {
      data: this.newUser,
    };
    this.dataService
      .postData('/add_new_user', payload)
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
      .subscribe(async (res: any) => {
        if (res.status === 'success') {
         
          await this.fetchUserList();
          this.snackBar.open(res.message, 'X', {
            duration: 2000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-success-snackbar'],
          });
        }
      });

    const modalEl = document.getElementById('addNewUserModal');
    const modal = bootstrap.Modal.getInstance(modalEl!);
    modal.hide();

    this.newUser = {
      name: '',
      username: '',
      userid: '',
      password: '',
      status: '',
      role: '',
      mail: '',
      mobile: '',
      indus_circle: '',
    };
  }

  /* Edit User License */
  editUserLicense = () => {
    this.editedLicense = this.userLicense;
    const modal = document.getElementById('editLicenseModal');
    if (modal) {
      (modal as any).style.display = 'block';
    }
  };

  closeUserLicenseModal = () => {
    const modal = document.getElementById('editLicenseModal');
    if (modal) {
      (modal as any).style.display = 'none';
    }
  };

  submitLicense = () => {
    this.userLicense = this.editedLicense;
    this.closeUserLicenseModal();
    const payload = {
      allowed_users: this.editedLicense,
    };
    
    this.dataService
      .postRequest('/update-user-license', payload)
      .pipe(
        catchError((error: any) => {
          const errorMessage = error?.error?.message || 'Internal Server Error';
       
          return throwError(() => error);
        })
      )
      .subscribe((res: any) => {
        if (res.status === 'success') {
          this.snackBar.open(res.message, 'X', {
            duration: 2000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-success-snackbar'],
          });
        }
      });
  };

  /* Password Change Modal */
  changePassword() {
    const modal = document.getElementById('changePasswordModal');
    if (modal) {
      (modal as any).style.display = 'block';
    }
  }

  closePasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    if (modal) {
      (modal as any).style.display = 'none';
    }
  }

  submitPasswordChange(form: any) {
    if (form.valid) {
      if (form.value.password !== form.value.confirmPassword) {
        this.snackBar.open('Both Password Should be same', 'X', {
          duration: 2000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: ['custom-error-snackbar'],
        });
        return;
      }
      const payload = {
        mail: form.value.email,
        password: form.value.password,
      };
      this.dataService
        .postRequest('/change-user-password', payload)
        .pipe(
          catchError((error: any) => {
            const errorMessage =
              error?.error?.message || 'Internal Server error';
          
            return throwError(() => error);
          })
        )
        .subscribe((res: any) => {
          if (res.status === 'success') {
            this.snackBar.open(res.message, 'X', {
              duration: 2000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
              panelClass: ['custom-success-snackbar'],
            });
          }
        });
     

      this.closePasswordModal();
    }
  }
}
