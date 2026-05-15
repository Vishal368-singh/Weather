import {
  Component,
  OnInit,
  AfterViewInit,
  ChangeDetectorRef,
  HostListener,
  DebugElement,
  viewChild,
} from '@angular/core';

import { forkJoin, of } from 'rxjs';

import { DataService } from '../../data-service/data-service';
import { CommonModule } from '@angular/common';
import { ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { throwError, catchError, map, firstValueFrom } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
declare var bootstrap: any; // needed for modal JS
import { environment } from '../../../environments/environment';

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
    private cdr: ChangeDetectorRef,
    private eRef: ElementRef,
  ) {}

  //#region Component State
  timeZone = environment.timeZone;
  user: any = null;
  userRole: string = '';
  roles: any;
  userList: any = [];
  reportUserList: any = [];
  selectedUser: any;
  prevSelectedUser: any;
  selectedReportUser: any;
  prevSelectedReportUser: any;
  previousStatus: string = '';
  isEditModalOpen = false;
  isReportUserEditModalOpen = false;
  isCheckboxChecked: boolean = false;
  isRestore: boolean = false;
  restoreRow: any;
  isReportStatusCheckboxChecked: boolean = false;
  editableUser: any = {};
  newUser: any = {
    name: '',
    username: '',
    userid: '',
    category: '',
    password: '',
    status: '',
    role: '',
    mail: '',
    mobile: '',
    indus_circle: '',
    location: '',
  };
  newReportUser: any = {
    userid: '',
    name: '',
    status: '',
    category: '',
    mail: '',
    mobile: '',
    indus_circle: [],
    to_cc: '',
  };

  usernameManuallyEdited = false;

  activeTab: string = 'activeUserList';
  userLicense: string = '';
  editedLicense: string = '';

  validatedFields: string[] = [];
  validatedFieldsDash: string[] = [];
  validateEditUser: string[] = [];
  validateEditReportUser: string[] = [];

  updateModalhistory: boolean = false;
  circleList: any;
  circleListReport: any;
  circleLength = 0;
  categorylist: any;
  historyData: any;

  isCircleDropdownOpen = false;
  addReportDistribution = false;
  editReportDistribution = false;
  isCircleExistReport = false;

  emailFilter: string = '';
  reportEmailFilter: string = '';
  showDeactivateConfirm = false;
  deactivateConfirmed = false;
  isReportUser: boolean = false;

  originalUserList: any[] = [];
  originalReportUserList: any[] = [];
  //#endregion

  //#region View Queries
  @ViewChild('circleDropdownWrapper', { static: false })
  circleDropdownWrapper?: ElementRef;

  @ViewChild('emailInput', { static: false })
  emailInput?: ElementRef;

  @ViewChild('reportFilter', { static: false })
  reportFilterInput?: ElementRef;

  @ViewChild('circleDropdown')
  circleDropdown!: ElementRef;
  //#endregion

  //#region Lifecycle
  ngOnInit(): void {
    let storedUser = localStorage.getItem('user');
    if (storedUser) {
      this.user = JSON.parse(storedUser);
      this.userRole = this.user.userrole;
    }
    if (this.user.userrole === 'Admin' || this.user.userrole === 'MLAdmin') {
      this.loadCircleListForDropdown();
      this.fetchUserLicense();
      this.fetchUserList();
      this.fetchCategoryList();
      this.fetchReportUserList();
    }
  }

  ngAfterViewInit(): void {}
  //#endregion

  //#region License Management
  fetchUserLicense = async () => {
    try {
      this.dataService
        .postRequest('/get-user-license')
        .pipe(
          catchError((error: any) => {
            const errorMessage =
              error?.error?.message || 'Internal Server Error';

            return throwError(() => error);
          }),
        )
        .subscribe((res: any) => {
          if (res.status === 'success') {
            this.userLicense = res.data[0].allowed_users;
            this.cdr.detectChanges();
          }
        });
    } catch (error: any) {}
  };

  // Open editedLicense Modal
  editUserLicense = () => {
    this.editedLicense = this.userLicense;
    const modal = document.getElementById('editLicenseModal');
    if (modal) {
      (modal as any).style.display = 'block';
    }
  };

  // close editedLicense Modal
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
        }),
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
  //#endregion

  //#region Dashboard User Management

  fetchUserList() {
    this.dataService.postRequest('get-user-list').subscribe({
      next: (res: any) => {
        const data = res?.data || [];

        // Build users array
        const usersArray = data.map((user: any) => ({
          userid: user.userid,
          unique_key: user?.unique_key,
          name: user.name,
          username: user.username,
          role: user.role,
          indus_circle: user.indus_circle,
          category: user.category,
          mail: user.mail,
          status: user.status,
          mobile: user.mobile,
          activationDate: user.status_activation_date
            ? this.formatCustomDateTime(user.status_activation_date)
            : null,
          deactivationDate: user.status_deactivation_date
            ? this.formatCustomDateTime(user.status_deactivation_date)
            : null,
        }));

        // Logged-in user
        const currentUser = usersArray.find(
          (u: any) => u.userid === this.user?.userid,
        );

        if (currentUser) {
          this.user = {
            userid: currentUser.userid,
            name: currentUser.name,
            username: currentUser.username,
            role: currentUser.role,
            indus_circle: currentUser.indus_circle,
            category: currentUser.category,
            mail: currentUser.mail,
            status: currentUser.status,
            mobile: currentUser.mobile,
          };
        }

        // Unique roles
        this.roles = [
          ...new Set(usersArray.map((u: any) => u.role).filter(Boolean)),
        ];

        // Exclude logged-in user from list
        this.userList = usersArray.filter(
          (u: any) => u.userid !== this.user?.userid,
        );

        this.originalUserList = [...this.userList];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to fetch user list', err);
      },
    });
  }

  onEdit(user: any) {
    this.selectedUser = { ...user };
    this.prevSelectedUser = { ...user };
    this.getUserReportCircle();
    this.isEditModalOpen = true;
  }

  saveEdit(): void {
    // -------- VALIDATION --------

    if (this.editReportDistribution) {
      //Validation for user
      this.validateAllEditFields(this.selectedUser, this.validateEditUser);

      this.isReportUser = true;
      // validation for report
      this.validateAllEditFields(
        this.selectedReportUser,
        this.validateEditReportUser,
      );
      this.isReportUser = false;

      if (
        this.validateEditReportUser.length > 0 ||
        this.validateEditUser.length > 0
      ) {
        return;
      }
    } else {
      this.validateAllEditFields(this.selectedUser, this.validateEditUser);
      if (this.validateEditUser.length > 0) {
        return;
      }
    }

    // -------- GET DASHBOARD CHANGES --------
    const dashboardChanges = this.getChangedFields(
      this.prevSelectedUser,
      this.selectedUser,
    );

    // -------- SYNC MODE --------
    if (this.editReportDistribution) {
      this.saveReportPayloadSyncDashBoard();

      const reportChanges = this.getChangedFields(
        this.prevSelectedReportUser,
        this.selectedReportUser,
      );

      const requests: any[] = [];

      // ---- Dashboard changed
      if (dashboardChanges?.length > 0) {
        requests.push(
          this.dataService.postRequest('/update_user', {
            userid: this.selectedUser.userid,
            modified_data: dashboardChanges,
            modifiedBy: this.user.userid,
            role: this.userRole,
            flag: 'Dashboard User List',
          }),
        );
      }

      // ---- Report changed
      if (reportChanges?.length > 0) {
        requests.push(
          this.dataService.postRequest('update_report_user', {
            userid: this.selectedReportUser.userid,
            modified_data: reportChanges,
            modifiedBy: this.user.userid,
            role: this.userRole,
            flag: 'Report Distribution List',
          }),
        );
      }

      // ---- No changes at all
      if (requests.length === 0) {
        this.openSnackBar('No Action Performed');
        return;
      }

      // ---- Call APIs (one or both)
      forkJoin(requests)
        .pipe(
          catchError((error) => {
            this.openSnackBar(error?.error?.message || 'Sync failed!');
            return of(null);
          }),
        )
        .subscribe((res) => {
          if (!res) return;
          this.closeEditModal();
          this.openSnackBar('Update successful');
          this.closeEditModal();
        });
    } else {
      // -------- NON SYNC MODE (Dashboard Only) --------

      if (!dashboardChanges || dashboardChanges.length === 0) {
        this.openSnackBar('No Action Performed');
        return;
      }

      this.dataService
        .postRequest('/update_user', {
          userid: this.selectedUser.userid,
          modified_data: dashboardChanges,
          modifiedBy: this.user.userid,
          role: this.userRole,
          flag: 'Dashboard User List',
        })
        .pipe(
          catchError((error) => {
            this.openSnackBar(
              error?.error?.message || 'Dashboard update failed!',
            );
            return of(null);
          }),
        )
        .subscribe((res) => {
          if (!res) return;

          this.openSnackBar('Dashboard updated successfully');
          this.closeEditModal();
        });
    }
  }

  closeEditModal() {
    this.fetchUserList();
    this.fetchReportUserList();
    this.validateEditUser = [];
    this.isEditModalOpen = false;
    this.isCircleExistReport = false;
    this.addReportDistribution = false;
    this.selectedUser = null;
    this.prevSelectedUser = null;
    this.circleListReport.forEach((circle: any) => {
      circle.checked = false;
    });
    this.editReportDistribution = false;

    if (this.emailInput?.nativeElement) {
      this.emailInput.nativeElement.value = '';
    }

    if (this.reportFilterInput?.nativeElement) {
      this.reportFilterInput.nativeElement.value = '';
    }

    this.emailFilter = '';
    this.reportEmailFilter = '';

    this.cdr.markForCheck();
  }

  async syncToAddUser(): Promise<void> {
    try {
      // -------- VALIDATION --------
      this.validateNewUserForm();

      let reportValidationLength = 0;

      if (this.addReportDistribution) {
        this.prepareSubmitNewReportUser();
        reportValidationLength = this.validateNewUser();
      }

      if (this.validatedFieldsDash.length > 0 || reportValidationLength > 0) {
        return;
      }

      // -------- SUBMISSION --------
      if (this.addReportDistribution) {
        const [res1, res2] = await Promise.all([
          this.submitNewUser(),
          this.submitNewReportUser(),
        ]);

        this.handleUserResponse(res1, res2);
      } else {
        const res = await this.submitNewUser();
        this.handleUserResponse(res, '');
      }
    } catch (error) {
      console.error(error);
      this.openSnackBar('Something went wrong. Please try again.');
    }
  }

  handleUserResponse(res1: any, res2: any) {
    if (this.addReportDistribution) {
      //  Any error case
      if (res1 === 'error' || res2 === 'error') {
        return this.openSnackBar('Operation failed due to server error');
      }

      //  Both exist
      if (res1 === 'exceed_licensed_limit' && res2 === 'added_successfully') {
        return this.openSnackBar(
          'User already exists in dashboard lists , added on report list',
        );
      }

      // Added in both
      if (res1 === 'added_successfully' && res2 === 'added_successfully') {
        return this.openSnackBar('User added successfully in both lists');
      }

      //  Exist in report, added in dashboard
      if (res1 === 'already_exists' && res2 === 'already_exists') {
        return this.openSnackBar(
          'User exists in both list report &  dashboard',
        );
      }

      //  Exist in dashboard, added in report
      if (res1 === 'added_successfully' && res2 === 'already_exists') {
        return this.openSnackBar(
          'User exists in dashboard user  list & added to report user list',
        );
      }

      //  Exist in report, added in dashboard
      if (res1 === 'already_exists' && res2 === 'added_successfully') {
        return this.openSnackBar(
          'User exists in report user list & added to dashboard user list',
        );
      }

      //  Exist in report, added in dashboard
      if (res1 === 'exceed_licensed_limit' && res2 === 'already_exists') {
        return this.openSnackBar(
          'Dashboard user list limit exceeded & User exists in report user list',
        );
      }

      if (res1 === 'exceed_licensed_limit' && res2 === 'added_successfully') {
        return this.openSnackBar(
          'Dashboard user list limit exceeded & User added in report user list',
        );
      }

      if (res1 === 'exceed_licensed_limit') {
        return this.openSnackBar('Dashboard user list limit exceeded');
      }
    } else {
      // Non-edit mode only cares about dashboard (res1)

      if (res1 === 'error') {
        return this.openSnackBar('Dashboard operation failed');
      }

      if (res1 === 'added_successfully') {
        return this.openSnackBar('User added to dashboard user list');
      }

      if (res1 === 'already_exists') {
        return this.openSnackBar('User already exists in dashboard user list');
      }

      if (res1 === 'exceed_licensed_limit') {
        return this.openSnackBar('Dashboard user list limit exceeded');
      }
    }

    this.addReportDistribution = false;
    this.resetNewUserForm();
    this.resetReportUserForm();
    this.cdr.markForCheck();
  }

  addNewUser() {
    const modalEl = document.getElementById('addNewUserModal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  HideNewUser() {
    const modalEl = document.getElementById('addNewUserModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      modal.hide();
    }
  }

  async submitNewUser(showMessage: boolean = true): Promise<string> {
    try {
      //  Prepare userid from email
      this.newUser.userid = this.newUser.mail
        ? this.newUser.mail.split('@')[0]
        : '';
      this.newUser.status = 'active';

      //  Map circle to location
      const matchedCircle = this.circleList.find(
        (circle: any) => circle.label === this.newUser.indus_circle,
      );
      this.newUser.location = matchedCircle?.value || '';

      //  Validate form
      this.validateNewUserForm();
      if (this.validatedFieldsDash.length > 0) {
        return 'validation error';
      }

      const payload = {
        data: this.newUser,
        modifiedBy: this.user.userid,
        role: this.userRole,
        action_on: ['addUser'],
        flag: 'Dashboard User List',
      };

      const res: any = await firstValueFrom(
        this.dataService.postRequest('/add_new_user', payload),
      );

      //  Success
      if (res?.status === 'success') {
        await this.fetchUserList();
        this.resetNewUserForm();
        this.HideNewUser();
        return res.message;
      }

      return res?.message;
    } catch (error: any) {
      const backendMessage = error?.error?.message;

      return backendMessage;
    }
  }

  resetNewUserForm(): void {
    this.newUser = {
      name: '',
      username: '',
      userid: '',
      password: '',
      status: '',
      role: '',
      category: '',
      mail: '',
      mobile: '',
      indus_circle: '',
      location: '',
    };
    this.circleListReport.forEach((circle: any) => {
      circle.checked = false;
    });
  }

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
      modified_data: [
        {
          key: 'status',
          prev_value: this.selectedUser.status,
          new_value: this.isCheckboxChecked === true ? 'active' : 'inactive',
        },
      ],
      userid: this.selectedUser.userid,
      status: this.isCheckboxChecked === true ? 'active' : 'inactive',
      modifiedBy: this.user.userid,
      role: this.userRole,
      flag: 'Dashboard User List',
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
        }),
      )
      .subscribe(async (res: any) => {
        if (res.status === 'success') {
          this.snackBar.open(res.message, 'X', {
            duration: 2000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-success-snackbar'],
          });
          this.fetchUserList();
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

  getUserReportCircle = async () => {
    try {
      const payload = {
        userid: this.selectedUser.userid,
      };

      this.dataService
        .postRequest('get-user-report-circles', payload)
        .subscribe((res: any) => {
          if (!res?.data?.length) {
            this.addReportDistribution = false;
            this.editReportDistribution = false;
            return;
          }
          this.addReportDistribution = true;
          const data = res.data[0];
          const circles = data.indus_circles || [];

          // Ensure object exists
          this.selectedReportUser = {
            indus_circle: circles,
            userid: data.userid,
            name: data.name,
            status: data.status,
            category: data.category,
            mail: data.mail,
            mobile: data.mobile,
            to_cc: data.to_cc,
          };

          this.prevSelectedReportUser = { ...this.selectedReportUser };

          circles.forEach((circle: any) => {
            this.circleListReport.find(
              (item: any) => item.name === circle,
            ).checked = true;
          });

          this.cdr.detectChanges();
        });
    } catch (error) {
      this.snackBar.open('Internal Server Error', 'X', {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['custom-error-snackbar'],
      });
    }
  };
  //#endregion

  //#region Report Distribution Management
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
            category: any;
          }[] = [];

          // Active users
          data.active_user.forEach((user: any) => {
            let userObj = {
              userid: user?.userid,
              name: user?.name,
              indus_circle:
                user?.indus_circle?.length === this.circleLength
                  ? 'All Circle'
                  : user?.indus_circle,

              mail: user?.mail,
              mobile: user?.mobile,
              status: user?.status,
              category: user?.category,
            };
            usersArray.push(userObj);
          });

          // Inactive users
          data.inactive_user.forEach((user: any) => {
            let userObj = {
              userid: user?.userid,
              name: user?.name,
              indus_circle:
                user?.indus_circle?.length === this.circleLength
                  ? 'All Circle'
                  : user?.indus_circle,

              mail: user?.mail,
              mobile: user?.mobile,
              status: user?.status,
              category: user?.category,
            };
            usersArray.push(userObj);
          });

          this.reportUserList = [];
          this.reportUserList.push(...usersArray);
          this.originalReportUserList = [...this.reportUserList];
          this.cdr.detectChanges();
        });
    } catch (error) {}
  };

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
    // this.selectedReportUser.indus_circle = [];
    this.circleListReport.forEach((circle: any) => {
      if (circle.checked === true) {
        this.selectedReportUser.indus_circle.push(circle.name);
      }
    });

    const payload = {
      modified_data: [
        {
          key: 'indus_circle',
          prev_value: this.selectedReportUser.indus_circle,
          new_value: null,
        },
      ],
      userid: this.selectedReportUser.userid,
      status:
        this.isReportStatusCheckboxChecked === true ? 'active' : 'inactive',
      modifiedBy: this.user.userid,
      role: this.userRole,
      flag: 'Report Distribution List',
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
        }),
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

  onReportUserEdit(user: any) {
    this.selectedReportUser = { ...user };

    if (this.selectedReportUser.indus_circle === 'All Circle') {
      this.circleListReport.forEach((circle: any) => {
        circle.checked = true;
      });
    } else {
      this.selectedReportUser.indus_circle.forEach((indus_circle: any) => {
        this.circleListReport.find(
          (item: any) => item.name === indus_circle,
        ).checked = true;
      });
    }

    this.prevSelectedReportUser = { ...user };

    //For handling in case of 'All Circle'
    this.prevSelectedReportUser.indus_circle = [];
    this.circleListReport.forEach((circle: any) => {
      if (circle.checked === true) {
        this.prevSelectedReportUser.indus_circle.push(circle.name);
      }
    });

    this.isReportUserEditModalOpen = true;
  }

  saveReportPayloadSyncDashBoard() {
    this.selectedReportUser.name = this.selectedUser.name;
    this.selectedReportUser.category = this.selectedUser.category;
    this.selectedReportUser.mail = this.selectedUser.mail;
    this.selectedReportUser.mobile = this.selectedUser.mobile;
  }

  saveReportUserEdit() {
    this.isReportUser = true;
    this.validateAllEditFields(
      this.selectedReportUser,
      this.validateEditReportUser,
    );

    if (this.validateEditReportUser.length > 0) {
      return;
    }

    const index = this.userList.findIndex(
      (u: any) => u.userid === this.selectedReportUser.userid,
    );

    if (index !== -1) {
      this.userList[index] = { ...this.selectedReportUser };
    }

    //To Ensure From 'All Circle' & 'Remove From All Circle'
    this.selectedReportUser.indus_circle = [];
    this.circleListReport.forEach((circle: any) => {
      if (circle.checked === true) {
        this.selectedReportUser.indus_circle.push(circle.name);
      }
    });

    const action_on = this.getChangedFields(
      this.prevSelectedReportUser,
      this.selectedReportUser,
    );

    if (!action_on || action_on.length === 0) {
      this.snackBar.open('No Action Performed', 'Close', {
        duration: 3000,
        panelClass: ['snackbar-info'],
      });
      return; // stop further processing
    }

    const payload = {
      userid: this.selectedReportUser.userid,
      //Modifier Details
      modified_data: action_on,
      modifiedBy: this.user.userid,
      role: this.userRole,
      flag: 'Report Distribution List',
    };

    this.isReportUser = false;
    this.dataService
      .postRequest('update_report_user', payload)
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
        }),
      )
      .subscribe((res: any) => {
        if (res.status === 'success') {
          this.fetchReportUserList(); // refresh the table
          this.snackBar.open(res.message, 'X', {
            duration: 2000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-success-snackbar'],
          });
        }
      });
    this.closeReportUserEditModal();
  }

  closeReportUserEditModal() {
    this.circleListReport.forEach((circle: any) => {
      circle.checked = false;
    });
    this.isReportUserEditModalOpen = false;
    this.prevSelectedReportUser = null;
    this.selectedReportUser = null;
    this.isCircleExistReport = false;

    if (this.reportFilterInput?.nativeElement) {
      this.reportFilterInput.nativeElement.value = '';
      this.reportEmailFilter = '';
    }

    this.validatedFieldsDash = [];
    this.validatedFields = [];
    this.validateEditReportUser = [];
  }

  addNewReportUser() {
    const modalEl = document.getElementById('addNewReportUserModal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  CloseNewReportUser() {
    const modalEl = document.getElementById('addNewReportUserModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      modal?.hide();
    }
  }

  prepareSubmitNewReportUser() {
    this.newReportUser.userid = this.newUser.mail
      ? this.newUser.mail.split('@')[0]
      : '';
    this.newReportUser.name = this.newUser?.name;
    this.newReportUser.category = this.newUser?.category;
    this.newReportUser.mail = this.newUser?.mail;
    this.newReportUser.mobile = this.newUser?.mobile ?? '';
  }

  async submitNewReportUser(): Promise<string> {
    try {
      this.newReportUser.status = 'active';

      const validLength = this.validateNewUser();
      if (validLength > 0) return 'validation error';

      this.newReportUser.userid = this.newReportUser.mail
        ? this.newReportUser.mail.split('@')[0]
        : '';

      const payload = {
        data: this.newReportUser,
        modifiedBy: this.user.userid,
        role: this.userRole,
        action_on: ['addUser'],
        flag: 'Report Distribution List',
      };

      const res: any = await firstValueFrom(
        this.dataService.postRequest('/add_new_report_user', payload),
      );

      if (res?.status === 'success') {
        await this.fetchReportUserList();
        this.resetReportUserForm();

        if (!this.addReportDistribution) {
          this.openSnackBar('Report user added successfully');
        }
        this.CloseNewReportUser();
        return res?.message;
      }

      if (!this.addReportDistribution) {
        this.openSnackBar(res?.message || 'Failed to add report user');
      }

      this.CloseNewReportUser();
      return res?.message;
    } catch (error: any) {
      const backendMessage = error?.error?.message;

      let message = 'Something went wrong. Please try again.';

      if (backendMessage === 'already_exists') {
        message = 'User already exist';
      }

      if (backendMessage === 'exceed_licensed_limit') {
        message = 'limit exceed';
      }

      if (!this.addReportDistribution) {
        this.openSnackBar(message);
      }

      return backendMessage;
    }
  }

  // Reset Report Edit User Modal
  resetReportUserForm(): void {
    this.newReportUser = {
      name: '',
      username: '',
      userid: '',
      password: '',
      status: '',
      role: '',
      category: '',
      mail: '',
      mobile: '',
      indus_circle: '',
      location: '',
    };
    this.circleListReport.forEach((circle: any) => {
      circle.checked = false;
    });
  }
  //#endregion

  //#region Shared UI And Data Helpers

  // Fetch Circle List
  async loadCircleListForDropdown() {
    try {
      const apiPayload = { circle: 'All Circle' };

      const res: any = await this.dataService
        .postRequest('get_circle_list', apiPayload)
        .toPromise();

      this.circleList = res.data;

      this.circleListReport = res.data
        .filter((item: any) => item.label !== 'All Circle')
        .map((d: any) => ({
          name: d.label,
          checked: false,
        }));

      this.circleLength = this.circleListReport.length;
      this.cdr.markForCheck();
    } catch (error) {
      console.error('❌ Failed to load circle list:', error);
      this.circleList = [];
    }
  }

  // To close the pop up modal
  @HostListener('document:click', ['$event'])
  handleOutsideClick(event: MouseEvent) {
    if (!this.isCircleDropdownOpen) return;

    if (!this.circleDropdownWrapper) return;

    const clickedInside = this.circleDropdownWrapper.nativeElement.contains(
      event.target,
    );

    if (!clickedInside) {
      this.isCircleDropdownOpen = false;
    }
  }

  handleActiveTab(tab: string) {
    this.activeTab = tab;
    this.loadCircleListForDropdown();
  }

  formatCustomDateTime(value: string | Date): string {
    if (!value) return '';

    const d = new Date(value);

    return (
      d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: this.timeZone,
      }) +
      ', ' +
      d
        .toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: this.timeZone,
        })
        .toUpperCase()
    );
  }

  handleAdd() {
    if (this.activeTab === 'activeUserList') {
      this.addNewUser();
    } else {
      this.addNewReportUser();
    }
  }

  getChangedFields(prev: any, curr: any) {
    return Object.keys(curr)
      .filter((key) => {
        const prevVal = prev[key];
        const currVal = curr[key];

        // If both are arrays → compare contents
        if (Array.isArray(prevVal) && Array.isArray(currVal)) {
          if (prevVal.length !== currVal.length) return true;

          return prevVal.some((item, index) => item !== currVal[index]);
        }

        // Normal comparison for non-arrays
        return prevVal !== currVal;
      })
      .map((key) => ({
        key,
        prev_value: prev[key],
        new_value: curr[key],
      }));
  }

  handleSaveClick() {
    if (this.isCircleExistReport) {
      this.showDeactivateConfirm = true;
    } else {
      this.activeTab === 'activeUserList'
        ? this.saveEdit()
        : this.saveReportUserEdit();
    }
  }

  confirmDeactivate(choice: boolean) {
    this.showDeactivateConfirm = false;

    if (choice) {
      this.deactivateConfirmed = true;
      this.activeTab === 'activeUserList'
        ? this.saveEdit()
        : this.saveReportUserEdit();
    }
  }

  openSnackBar(message: string) {
    this.snackBar.open(message, 'X', {
      duration: 6000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: ['custom-success-snackbar'],
    });
  }

  fetchCategoryList = async () => {
    try {
      this.dataService
        .postRequest('get_users_category')
        .subscribe(async (res: any) => {
          this.categorylist = res.data.map((item: any) => item.category);

          this.cdr.detectChanges();
        });
    } catch (error) {}
  };

  get activeTabLabel(): string {
    return this.activeTab === 'activeUserList'
      ? 'Dashboard User List'
      : 'Report Distribution List';
  }

  onEmailChange(email: string) {
    // trim leading & trailing spaces
    const mail = email?.trim() || '';
    this.newUser.mail = mail;
    if (!mail || this.usernameManuallyEdited) {
      return;
    }

    const atIndex = mail.indexOf('@');
    if (atIndex > 0) {
      this.newUser.username = mail.substring(0, atIndex);
    }
  }

  onUsernameInput() {
    this.usernameManuallyEdited = true;
  }

  toggleCircleDropdown() {
    this.isCircleDropdownOpen = !this.isCircleDropdownOpen;
  }

  onDistributionChange() {
    this.addReportDistribution = !this.addReportDistribution;
  }

  updateSelectAllCircle() {
    this.newReportUser.indus_circle = this.circleListReport
      .filter((circle: any) => circle.checked)
      .map((circle: any) => circle.name);
  }

  UpdateOnEditCircle() {
    this.isCircleExistReport = false;
    this.selectedReportUser.indus_circle = this.circleListReport
      .filter((circle: any) => circle.checked)
      .map((circle: any) => circle.name);

    if (this.selectedReportUser.indus_circle.length === this.circleLength) {
      this.selectedReportUser.indus_circle = 'All Circle';
    }

    if (this.selectedReportUser.indus_circle.length === 0) {
      this.isCircleExistReport = true;
      this.selectedReportUser.indus_circle = '';
    }
  }

  downloadUserCSV(): void {
    const isActiveUserTab = this.activeTab === 'activeUserList';

    //  Define headers
    const headers = [
      'S.No',
      'Name',
      'Circle',
      'Category',
      'Mobile',
      'Email-Id',
      'Status',

      //Only for User List (not for Report Distribution)
      ...(isActiveUserTab
        ? ['Role', 'Activation Date', 'DeActivation Date']
        : []),
    ];

    var userList = isActiveUserTab ? this.userList : this.reportUserList;
    //  Map rows
    const rows = (userList ?? []).map((item: any, index: number) => [
      index + 1,
      item.name ?? '',
      item.indus_circle ?? '',
      item.category ?? '',
      item.mobile ?? '',
      item.mail ?? '',
      item.status ?? '',
      //Only for User List (not for Report Distribution)

      ...(isActiveUserTab
        ? [
            item.role ?? '',
            item.activationDate ?? '',
            item.deactivationDate ?? '',
          ]
        : []),
    ]);

    //  Convert to CSV string
    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((value: any) => `"${String(value).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');

    //  Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    console.log(url);
    link.download = `${this.activeTabLabel}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  //#endregion

  //#region Password Modal
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

  //#endregion

  //#region Validation
  validateNewUser() {
    this.validatedFields = []; // reset every validation

    const user = this.newReportUser;

    // ---------- Required ----------
    const requiredFields = [
      'name',
      'to_cc',
      'mail',
      'category',
      'indus_circle',
    ];

    for (const field of requiredFields) {
      if (!user[field] || user[field].toString().trim() === '') {
        this.validatedFields.push(field);
      }
    }

    // ---------- Name: alphabets & space ----------
    if (user.name) {
      const nameRegex = /^[a-zA-Z ]+$/;
      if (!nameRegex.test(user.name)) {
        this.validatedFields.push('name');
      }
    }

    // ---------- Email ----------
    if (user.mail) {
      // remove leading & trailing spaces
      const email = user.mail.trim();
      this.newReportUser.mail = email;

      // stricter email regex (no slashes, no paths)
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;

      if (!emailRegex.test(email)) {
        this.validatedFields.push('mail');
      }
    }

    if (!user.category) {
      this.validatedFields.push('category');
    }

    if (user.indus_circle.length === 0) {
      this.validatedFields.push('indus_circle');
    }

    // ---------- To / CC (dropdown) ----------
    if (!user.to_cc || user.to_cc.trim() === '') {
      this.validatedFields.push('to_cc');
    }

    // ---------- Remove duplicates ----------
    this.validatedFields = [...new Set(this.validatedFields)];

    // return count of invalid fields
    return this.validatedFields.length;
  }

  clearValidation(field: string) {
    if (this.activeTab === 'activeUserList') {
      this.validatedFields = this.validatedFields.filter((f) => f !== field);
      this.validatedFieldsDash = this.validatedFieldsDash.filter(
        (f) => f !== field,
      );
    } else {
      this.validatedFields = this.validatedFields.filter((f) => f !== field);
    }
  }

  clearValidationReportCircle(field: string) {
    this.validatedFields = this.validatedFields.filter((f) => f !== field);
  }

  hasError(field: string): boolean {
    return this.validatedFieldsDash.includes(field);
  }

  validateNewUserForm(): boolean {
    this.validatedFieldsDash = [];
    const user = this.newUser;

    // Required fields
    const requiredFields = [
      'name',
      'username',
      'category',
      'password',
      'role',
      'mail',
      'mobile',
      'indus_circle',
    ];

    requiredFields.forEach((field) => {
      if (!user[field] || user[field].toString().trim() === '') {
        this.validatedFieldsDash.push(field);
      }
    });

    // Name: letters & space
    if (user.name && !/^[a-zA-Z ]+$/.test(user.name)) {
      this.validatedFieldsDash.push('name');
    }

    // Username: alphanumeric
    if (user.username && !/^\S+$/.test(user.username)) {
      this.validatedFieldsDash.push('username');
    }

    // Email format
    const email = user.mail.trim();
    user.mail = email;

    // stricter email regex (no slashes, no paths)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(email)) {
      this.validatedFieldsDash.push('mail');
    }

    // Mobile: exactly 10 digits
    if (user.mobile && !/^[0-9]{10}$/.test(user.mobile)) {
      this.validatedFieldsDash.push('mobile');
    }

    if (user.password.length < 6) {
      this.validatedFieldsDash.push('password');
    }

    // Remove duplicates
    this.validatedFieldsDash = [...new Set(this.validatedFieldsDash)];

    // valid if no errors
    return this.validatedFieldsDash.length === 0;
  }

  validateAllEditFields(model: any, errors: string[]) {
    // reset once
    errors.length = 0;

    Object.keys(this.editValidationRules).forEach((field) => {
      const rule = this.editValidationRules[field];

      if (this.isReportUser && field === 'mobile') return;
      if (this.isReportUser && field === 'indus_circle') return;
      if (this.isReportUser && field === 'role') return;

      // skip fields without validation rules
      if (!rule) return;

      let value: any;
      if (field !== 'indus_circle') {
        value = model[field]?.trim();
      } else {
        value = model[field];
      }

      if (!value) {
        errors.push(field);
        return;
      }

      if (!rule.test(value)) {
        errors.push(field);
      }
    });
  }

  hasErrorEdit(field: string, errors: string[]): boolean {
    return errors.includes(field);
  }

  editValidationRules: Record<string, RegExp | null> = {
    name: /^[A-Za-z ]{2,}$/,
    mail: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/,
    mobile: /^[0-9]{10}$/,
    indus_circle: /.+/,
    role: /.+/,
    category: /.+/,
  };

  validateEditField(
    model: any,
    field: string,
    value: string,
    errors: string[],
  ) {
    const trimmedValue = value?.trim();
    model[field] = trimmedValue;

    // remove old error
    const idx = errors.indexOf(field);
    if (idx !== -1) errors.splice(idx, 1);

    // validate only if value exists
    if (!trimmedValue) return;

    const rule = this.editValidationRules[field];
    if (rule && !rule.test(trimmedValue)) {
      errors.push(field);
    }
  }

  //#endregion

  //#region History
  handleUpdate() {
    this.fetchUpdateHistory();
    this.updateModalhistory = true;
  }

  fetchUpdateHistory(): void {
    const payload = {
      flag:
        this.activeTab === 'activeUserList'
          ? 'Dashboard User List'
          : 'Report Distribution List',
    };

    this.dataService.postRequest('get-user-history', payload).subscribe({
      next: (res: any) => {
        this.historyData = [];
        const data = res?.data ?? [];

        this.historyData = (data ?? []).map((rec: any) => ({
          userid: rec.userid,
          new_value: rec.new_value,
          old_value: rec.old_value,
          modifier_role: rec.modifier_role,
          modified_by: rec.modified_by,
          action_on: rec.action_on,
          modified_on: rec.modified_on,
          restore: rec.restore,
        }));

        this.cdr.markForCheck();
      },
      error: (error: any) => {
        this.snackBar.open(error?.message || 'Failed to fetch history', 'X', {
          duration: 2000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: ['custom-success-snackbar'],
        });
      },
    });
  }

  cancelHistoryModal() {
    this.updateModalhistory = false;
  }

  downloadHistoryCSV(): void {
    if (!this.historyData || !this.historyData.length) {
      this.snackBar.open('No data available for download..', 'X', {
        duration: 2000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['custom-success-snackbar'],
      });
      return;
    }

    const isActiveUserTab = this.activeTab === 'activeUserList';

    //  Define headers
    const headers = [
      'S.No',
      'User ID',
      'Action',
      'Old Value',
      'New Value',
      'Modified By',
      'Modifier Role',
      'Modified On',
    ];

    //  Map rows
    const rows = (this.historyData ?? []).map((item: any, index: number) => [
      index + 1,
      item.userid ?? '',
      item.action_on ?? '',
      item.old_value ?? '',
      item.new_value ?? '',
      item.modified_by ?? '',
      item.modifier_role ?? '',
      this.formatCustomDateTime(item.modified_on),
    ]);

    //  Convert to CSV string
    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((value: any) => `"${String(value).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');

    //  Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `History_${this.activeTabLabel}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  confirmRestore(row: any) {
    this.isRestore = true;
    this.restoreRow = row;
  }

  onRestore = async () => {
    const payload = {
      modified_data: [
        {
          key: 'restore',
          prev_value: null,
          new_value: this.restoreRow?.old_value
            .split(',')
            .map((item: any) => item.trim())
            .filter((item: any) => item.length > 0),
        },
      ],

      userid: this.restoreRow.userid,
      status: 'active',
      modifiedBy: this.user.userid,
      role: this.userRole,
      restore: 'restore',
      flag: 'Report Distribution List',
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
        }),
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
          this.fetchUpdateHistory();
          this.closeRestoreModal();
          this.cdr.detectChanges();
        }
      });
  };

  openRestoreModal(row: any) {
    this.isRestore = true;
    this.restoreRow = row;
    this.cdr.markForCheck();
  }

  closeRestoreModal() {
    this.isRestore = false;
    this.restoreRow = {};
  }

  //#endregion

  //#region Filters And Reset
  applyDashbaordListEmailFilter() {
    if (!this.emailFilter) {
      this.userList = [...this.originalUserList];
      return;
    }
    const filterValue = this.emailFilter.toLowerCase();
    this.emailFilter = '';

    this.userList = this.originalUserList.filter((user: any) =>
      user.mail?.toLowerCase().includes(filterValue),
    );
  }

  applyReportEmailFilter() {
    if (!this.reportEmailFilter) {
      this.reportUserList = [...this.originalReportUserList];
      return;
    }
    const filterValue = this.reportEmailFilter.toLowerCase();

    this.reportUserList = this.originalReportUserList.filter((user) =>
      user.mail?.toLowerCase().includes(filterValue),
    );
  }

  onCancel() {
    this.validatedFieldsDash = [];
    this.validatedFields = [];
    this.newUser = {
      name: '',
      username: '',
      userid: '',
      category: '',
      password: '',
      status: '',
      role: '',
      mail: '',
      mobile: '',
      indus_circle: '',
      location: '',
    };
    this.newReportUser = {
      userid: '',
      name: '',
      status: '',
      category: '',
      mail: '',
      mobile: '',
      indus_circle: [],
      to_cc: '',
    };

    this.circleListReport.forEach((circle: any) => {
      circle.checked = false;
    });
    this.selectedReportUser = {};

    this.reportEmailFilter = '';
    this.emailFilter = '';

    this.editReportDistribution = false;
    this.isCircleDropdownOpen = false;
    this.addReportDistribution = false;

    this.cdr.markForCheck();
  }
  //#endregion
}
