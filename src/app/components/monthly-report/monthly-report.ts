import { DataService } from './../../data-service/data-service';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import Swal from 'sweetalert2';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

interface WeatherRecord {
  circleName: string;
  district: string;
  date: any;
  tMaxObs: number;
  tMinObs: number;
  hAvgObs: number;
  winMObs: number;
  rainTObs: number;
  vAvgObs: number;
  tMaxFst: number;
  tMinFst: number;
  hAvgFst: number;
  winMFst: number;
  rainTFst: number;
  vAvgFst: number;
}

interface AccuracyRow {
  parameter: string;
  variable: string;
  mae: number;
  rmse: number;
  mape: number;
  accuracy: number;
}
@Component({
  selector: 'app-monthly-report',
  imports: [
    CommonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    MatFormFieldModule,
  ],
  templateUrl: './monthly-report.html',
  styleUrl: './monthly-report.css',
})
export class MonthlyReport {
  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef;
  records: WeatherRecord[] = [];
  accuracyRows: AccuracyRow[] = [];
  averageAccuracy: number = 0;
  fileName = '';
  isLoading = false;
  activeTab: 'raw' | 'accuracy' = 'raw';
  formData: any = null;
  monthYearList: any[] = [];
  selectedMonthYear: string = '';
  isMonthDropdownOpen = false;
  months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  constructor(
    private cdr: ChangeDetectorRef,
    private dataService: DataService,
  ) {}

  ngOnInit() {
    this.getYearsFromApi(); // Fetch available month-year options first
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;
    this.formData = new FormData();
    this.formData.append('file', file, file.name);
  }

  uploadFileData() {
    if (!this.formData) return;

    Swal.fire({
      title: 'Upload File?',
      text: 'Do you want to upload this Excel file?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#198754',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, Upload',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        // Optional loader
        Swal.fire({
          title: 'Uploading...',
          text: 'Please wait while file is being uploaded',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        this.dataService.postFormData('upload-excel', this.formData).subscribe({
          next: (response) => {
            Swal.close();
            if (response) {
              console.log('API response:', response);

              Swal.fire({
                icon: 'success',
                title: 'Uploaded!',
                text: 'File uploaded successfully.',
                confirmButtonColor: '#198754',
              });

              this.formData = null;
              this.fileInput.nativeElement.value = '';
              this.getYearsFromApi(); // Refresh month-year list and data after upload
            }
          },
          error: (err) => {
            Swal.close();
            console.error('Upload error:', err);

            Swal.fire({
              icon: 'error',
              title: 'Upload Failed',
              text:
                `${err?.error?.error}` ||
                'An error occurred while uploading the file.',
              confirmButtonColor: '#d33',
            });
          },
        });
      }
    });
  }

  async getYearsFromApi() {
    this.dataService
      .postRequest('get_accuracy_report_month_list')
      .subscribe((response) => {
        if (response) {
          this.monthYearList = response.data.map(
            (item: any) => item.month_year,
          );
          this.selectedMonthYear = this.monthYearList[0];
          this.fetchAccuracyData();
          this.cdr.markForCheck();
        }
      });
  }

  get selectedMonthYearLabel() {
    return (
      this.monthYearList.find((item) => item === this.selectedMonthYear) ||
      'Select Month'
    );
  }

  toggleMonthDropdown() {
    this.isMonthDropdownOpen = !this.isMonthDropdownOpen;
  }

  closeMonthDropdown() {
    this.isMonthDropdownOpen = false;
  }

  selectMonthYear(item: any) {
    this.selectedMonthYear = item;
    this.closeMonthDropdown();
    this.fetchAccuracyData(); // Fetch data for the newly selected month-year
  }

  //Fetch Accuracy & raw Data from API
  fetchAccuracyData() {
    this.dataService
      .postRequest('/get_accuracy_report', {
        monthYear: this.selectedMonthYear,
      })
      .subscribe((data) => {
        this.accuracyRows = data?.accuracy_data?.accuracy_rows || [];
        this.averageAccuracy =
          data?.accuracy_data?.average_accuracy[0]?.average_accuracy || 0;
        this.records = data?.observed_data || [];
        this.cdr.markForCheck();
      });
  }
}
