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
  reportUserList: any = [];
  selectedUser: any;
  selectedReportUser: any;
  previousStatus: string = '';
  isEditModalOpen = false;
  isReportUserEditModalOpen = false;
  isCheckboxChecked: boolean = false;
  isReportStatusCheckboxChecked: boolean = false;
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
  newReportUser: any = {
    userid: '',
    name: '',
    username: '',
    password: '',
    status: '',
    team: '',
    mail: '',
    mobile: '',
    indus_circle: '',
    to_cc: '',
  };
  activeTab: string = 'activeUserList';
  userLicense: string = '';
  editedLicense: string = '';
  validatedFields: string[] = [];

  ngOnInit(): void {
    let storedUser = localStorage.getItem('user');
    if (storedUser) {
      this.user = JSON.parse(storedUser);
      this.userRole = this.user.userrole;
    }
    if (this.user.userrole === 'Admin' || this.user.userrole === 'MLAdmin') {
      this.fetchUserList();
      this.fetchReportUserList();
      this.fetchUserLicense();
    }
  }

  ngAfterViewInit(): void {}

  /* handle active tab for user list */
  handleActiveTab(tab: string) {
    this.activeTab = tab;
  }

  /* Fetch User License */
  fetchUserLicense = async () => {
    try {
      this.dataService
        .postRequest('/get-user-license')
        .pipe(
          catchError((error: any) => {
            const errorMessage =
              error?.error?.message || 'Internal Server Error';
       
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
      this.dataService.postRequest('get-user-list').subscribe(async (res: any) => {
        let data = res.data;
        let usersArray: {
          userid: any;
          name: any;
          username: any;
          role: any;
          indus_circle: any;
          mail: any;
          status: any;
          activationDate: any;
          deactivationDate: any;
        }[] = [];
        data.forEach((user: any) => {
          let userObj = {
            userid: user.userid,
            name: user.name,
            username: user.username,
            role: user.role,
            indus_circle: user.indus_circle,
            mail: user.mail,
            status: user.status,
            mobile: user.mobile,
            activationDate: user.status_activation_date
              ? user.status_activation_date
              : 'null',
            deactivationDate: user.status_deactivation_date
              ? user.status_deactivation_date
              : 'null',
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

  /* Added function handling for adding licensed or Report user  */
  handleAdd() {
    if (this.activeTab === 'activeUserList') {
      this.addNewUser();
    } else {
      this.addNewReportUser();
    }
  }

  // Open Confirmation Modal for Status Update for licensed Users
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
      .postRequest('update_user_status', payload)
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

  // Edit Licensed User Detials and Save it to Database
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
      .postRequest('/update_user', payload)
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

  // Add new Licensed User with the required details
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
      .postRequest('/add_new_user', payload)
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
          this.snackBar.open(res.message, 'X', {
            duration: 2000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-success-snackbar'],
          });
        }
      });
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

  /* Fetching the reportUsers list */
  fetchReportUserList = async () => {
    try {
      this.dataService
        .postRequest('get_report_user_list')
        .subscribe(async (res: any) => {
          let data = res.data;
          let usersArray: {
            userid: any;
            name: any;
            indus_circle: any;
            mail: any;
            mobile: any;
            status: any;
            activationDate: any;
            deactivationDate: any;
          }[] = [];
          data.forEach((user: any) => {
            let userObj = {
              userid: user.userid,
              name: user.name,
              indus_circle: user.indus_circle,
              mail: user.mail,
              status: user.status,
              mobile: user.mobile,
              activationDate: user.status_activation_date
                ? user.status_activation_date
                : 'null',
              deactivationDate: user.status_deactivation_date
                ? user.status_deactivation_date
                : 'null',
            };
            usersArray.push(userObj);
          });

          this.reportUserList = [];
          this.reportUserList.push(...usersArray);
          this.cdr.detectChanges();
        });
    } catch (error) {
      console.log(`Error while fetching user list : ${error}`);
    }
  };

  // Open Confirmation Modal for Status Update for Report Users
  openReportUserConfirmDialog(event: Event, user: any) {
    const checked = (event.target as HTMLInputElement).checked;
    this.isReportStatusCheckboxChecked = checked;

    event.preventDefault();
    event.stopPropagation();
    this.selectedReportUser = user;
    const modalElement = document.getElementById('reportUserConfirmModal');
    const modal = new bootstrap.Modal(modalElement!);
    modal.show();
  }

  confirmReportUserStatusChange() {
    const payload = {
      id: this.selectedReportUser.userid,
      status:
        this.isReportStatusCheckboxChecked === true ? 'active' : 'inactive',
    };
    this.dataService
      .postRequest('update_report_user_status', payload)
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
          await this.fetchReportUserList();
          this.cdr.detectChanges();
        }
      });

    const modalElement = document.getElementById('reportUserConfirmModal');
    const modal = bootstrap.Modal.getInstance(modalElement!);
    modal.hide();
  }

  cancelReportUserStatusChange() {
    const modalElement = document.getElementById('reportUserConfirmModal');
    const modal = bootstrap.Modal.getInstance(modalElement!);
    modal.hide();
  }

  // Report User Edit Modal
  onReportUserEdit(user: any) {
    this.selectedReportUser = { ...user };
    this.isReportUserEditModalOpen = true;
  }

  saveReportUserEdit() {
    const index = this.userList.findIndex(
      (u: any) => u.userid === this.selectedReportUser.userid
    );
    if (index !== -1) {
      this.userList[index] = { ...this.selectedReportUser };
    }
    const payload = {
      id: this.selectedReportUser.userid,
      data: {
        name: this.selectedReportUser.name,
        role: this.selectedReportUser.role,
        indus_circle: this.selectedReportUser.indus_circle,
        mobile: this.selectedReportUser.mobile,
        mail: this.selectedReportUser.mail,
      },
    };
    this.dataService
      .postRequest('/update_report_user', payload)
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

  closeReportUserEditModal() {
    this.isReportUserEditModalOpen = false;
    this.selectedReportUser = null;
  }

  // Add new report User with the required details
  addNewReportUser() {
    const modalEl = document.getElementById('addNewReportUserModal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  submitNewReportUser() {
    const validLength = this.validateNewUser();
    if (validLength > 0) {
      return;
    }
    const payload = {
      data: this.newReportUser,
    };
    this.dataService
      .postRequest('/add_new_report_user', payload)
      .pipe(
        catchError((error) => {
          const message = error?.error?.message || 'Internal Server Error';
          this.snackBar.open(message, 'X', {
            duration: 4000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-error-snackbar'],
          });
          return throwError(() => error);
        })
      )
      .subscribe(async (res: any) => {
        if (res.status === 'success') {
          await this.fetchReportUserList();
          const modalEl = document.getElementById('addNewReportUserModal');
          const modal = bootstrap.Modal.getInstance(modalEl!);
          modal.hide();
          this.newReportUser = {
            userid: '',
            name: '',
            username: '',
            password: '',
            status: '',
            team: '',
            mail: '',
            mobile: '',
            indus_circle: '',
            to_cc: '',
          };
          this.snackBar.open(res.message, 'X', {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-success-snackbar'],
          });
        }
      });
  }

  validateNewUser() {
    this.validatedFields = []; // reset every validation
    const requiredFields = [
      'userid',
      'name',
      'username',
      'password',
      'status',
      'team',
      'to_cc',
      'mail',
      'mobile',
      'indus_circle',
    ];

    for (const field of requiredFields) {
      if (
        !this.newReportUser[field] ||
        this.newReportUser[field].trim() === ''
      ) {
        if (!this.validatedFields.includes(field)) {
          this.validatedFields.push(field);
        }
      }
    }

    return this.validatedFields.length;
  }
  clearValidation(field: string) {
    this.validatedFields = this.validatedFields.filter((f) => f !== field);
  }
}
