import {
  AfterViewInit,
  Component,
  OnInit,
  ChangeDetectorRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DataService } from '../../data-service/data-service';
import { catchError, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-severity-ranges',
  imports: [FormsModule, CommonModule],
  templateUrl: './severity-ranges.html',
  styleUrl: './severity-ranges.css',
})
export class SeverityRanges implements OnInit, AfterViewInit {
  constructor(
    private snackBar: MatSnackBar,
    private dataService: DataService,
    private cdr: ChangeDetectorRef
  ) {}

  responseData: any = {};
  circles: any = [];
  selectedCircle: string = '';
  editableKPIData: any = {};


  kpiList = [
    {
      name: 'Rainfall (mm)',
      field: 'rainfall',
      extreme: '',
      high: '',
      moderate: '',
      low: '',
      editMode: false,
    },
    {
      name: 'Wind (km/h)',
      field: 'wind',
      extreme: '',
      high: '',
      moderate: '',
      low: '',
      editMode: false,
    },
    {
      name: 'Temperature Max (°C)',
      field: 'temperature',
      extreme: '',
      high: '',
      moderate: '',
      low: '',
      editMode: false,
    },
    {
      name: 'Temperature Min (°C)',
      field: 'min_temp',
      extreme: '',
      high: '',
      moderate: '',
      low: '',
      editMode: false,
    },
    {
      name: 'Humidity',
      field: 'humidity',
      extreme: '',
      high: '',
      moderate: '',
      low: '',
      editMode: false,
    },
    {
      name: 'Visibility (Km)',
      field: 'visibility',
      extreme: '',
      high: '',
      moderate: '',
      low: '',
      editMode: false,
    },
    {
      name: 'Cyclone (km/h)',
      field: 'cyclone',
      extreme: '',
      high: '',
      moderate: '',
      low: '',
      editMode: false,
    },
    {
      name: 'Flood (metres)',
      field: 'flood',
      extreme: '',
      high: '',
      moderate: '',
      low: '',
      editMode: false,
    },
    {
      name: 'Snowfall (cm)',
      field: 'snowfall',
      extreme: '',
      high: '',
      moderate: '',
      low: '',
      editMode: false,
    },
    {
      name: 'Lightning (probability %)',
      field: 'lightning',
      extreme: '',
      high: '',
      moderate: '',
      low: '',
      editMode: false,
    },
    {
      name: 'Landslide (probability %)',
      field: 'landslide',
      extreme: '',
      high: '',
      moderate: '',
      low: '',
      editMode: false,
    },
    {
      name: 'Avalanche (probability %)',
      field: 'avalanche',
      extreme: '',
      high: '',
      moderate: '',
      low: '',
      editMode: false,
    },
    {
      name: 'Severity (colour)',
      field: 'severity',
      extreme: '',
      high: '',
      moderate: '',
      low: '',
      editMode: false,
    },
    {
      name: 'Temperature Min (colour)',
      field: 'min_color',
      extreme: '',
      high: '',
      moderate: '',
      low: '',
      editMode: false,
    },
  ];

  ngOnInit(): void {
    this.fetchKPIRanges();
  }

  ngAfterViewInit(): void {}

  /* Fetch Severity KPI Ranges */
  fetchKPIRanges = () => {
    try {
      this.dataService
        .getRequests('/fetch-kpi-range')
        .pipe(
          catchError((error: any) => {
            const errorMessage = error?.error?.message || 'Internal Server';
            console.log(errorMessage);
            return throwError(() => error);
          })
        )
        .subscribe((response) => {
          if (response.status === 'success') {
            this.responseData = response.data;
            

            this.circles = Object.keys(this.responseData);
            this.selectedCircle = this.circles[0];
            if (this.selectedCircle) {
              this.mapKpiData(this.selectedCircle);
              this.cdr.detectChanges();
            }
          }
        });
    } catch (error) {
      console.log(error);
    }
  };


  mapKpiData(circle: string) {
    const circleData = this.responseData[circle][0];

    this.kpiList = this.kpiList.map((kpi) => {
      if (kpi.field === 'severity') {
        // put only colors into severity KPI
        return {
          ...kpi,
          extreme: circleData[`severity_extreme_color`],
          high: circleData[`severity_high_color`],
          moderate: circleData[`severity_moderate_color`],
          low: circleData[`severity_low_color`],
          editMode: false,
        };
      }

      //Put only colors into min_color KPI
      if (kpi.field === 'min_color') {
        return {
          ...kpi,
          extreme: circleData[`extreme_min_color`],
          high: circleData[`high_min_color`],
          moderate: circleData[`moderate_min_color`],
          low: circleData[`low_min_color`],
          editMode: false,
        };
      }

      // normal KPI → values only (no colors)
      return {
        ...kpi,
        extreme: circleData[`extreme_${kpi.field}`],
        high: circleData[`high_${kpi.field}`],
        moderate: circleData[`moderate_${kpi.field}`],
        low: circleData[`low_${kpi.field}`],
        editMode: false,
      };
    });
  }

  //when circle change
  onCircleChange(circle: string) {
    this.mapKpiData(circle);
  }

  // Enable edit mode for a row
  editRow(index: number) {
    this.kpiList.forEach((kpi: any) => (kpi.editMode = false));
    this.kpiList[index].editMode = true;
    this.editableKPIData = JSON.parse(JSON.stringify(this.kpiList[index])); //deep copy
  }

  // Save changes
  saveRow(index: number) {
    this.kpiList[index].editMode = false;
    let editedKpiData = this.kpiList[index];

    const keyMap: any = {
      extreme: (f: string) => `extreme_${f}`,
      high: (f: string) => `high_${f}`,
      moderate: (f: string) => `moderate_${f}`,
      low: (f: string) => `low_${f}`,

      // for severity (color), ignore f because field = "severity"
      extremeColor: () => `severity_extreme_color`,
      highColor: () => `severity_high_color`,
      moderateColor: () => `severity_moderate_color`,
      lowColor: () => `severity_low_color`,

      // for min_color (color), ignore f because field = "min_color"
      extremeColorMin: () => `extreme_min_color`,
      highColorMin: () => `high_min_color`,
      moderateColorMin: () => `moderate_min_color`,
      lowColorMin: () => `low_min_color`,
    };

    const payload: any = { indus_circle: this.selectedCircle };

    (Object.keys(editedKpiData) as (keyof typeof editedKpiData)[]).forEach(
      (key) => {
        if (
          key !== 'field' &&
          key !== 'name' &&
          key !== 'editMode' &&
          editedKpiData[key] !== this.editableKPIData[key]
        ) {
          let mappedKey;
          if (editedKpiData.field === 'severity') {
            mappedKey = keyMap[`${key}Color`]();
          } else {
            mappedKey = keyMap[key](editedKpiData.field);
          }
          payload[mappedKey] = editedKpiData[key];
        }
      }
    );

    this.dataService
      .postRequest('/update-kpi-range', payload)
      .pipe(
        catchError((error: any) => {
          const errorMessage = error?.error?.message || 'Internal Server Error';
          console.log(errorMessage);
          return throwError(() => error);
        })
      )
      .subscribe((response) => {
        if (response.status === 'success') {
          this.snackBar.open(response.message, 'X', {
            duration: 2000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-success-snackbar'],
          });
          this.fetchKPIRanges();
          this.cdr.detectChanges();
        }
      });
  }

  // Cancel edit
  cancelEdit(index: number) {
    this.kpiList[index].editMode = false;
    this.editableKPIData = {};
  }
}
