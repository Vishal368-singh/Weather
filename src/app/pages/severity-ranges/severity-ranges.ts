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

  // kpiList = [
  //   { name: 'Rainfall (mm)', field: 'rainfall', extreme: '', extremeColor: '', high: '', highColor: '', moderate: '', moderateColor: '', editMode: false },
  //   { name: 'Wind (Kmph)', field: 'wind', extreme: '', extremeColor: '', high: '', highColor: '', moderate: '', moderateColor: '', editMode: false },
  //   { name: 'Temperature (°C)', field: 'temperature', extreme: '', extremeColor: '', high: '', highColor: '', moderate: '', moderateColor: '', editMode: false },
  //   { name: 'Humidity', field: 'humidity', extreme: '', extremeColor: '', high: '', highColor: '', moderate: '', moderateColor: '', editMode: false },
  //   { name: 'Visibility (Km)', field: 'visibility', extreme: '', extremeColor: '', high: '', highColor: '', moderate: '', moderateColor: '', editMode: false },
  //   { name: 'Cyclone (Kmph)', field: 'cyclone', extreme: '', extremeColor: '', high: '', highColor: '', moderate: '', moderateColor: '', editMode: false },
  //   { name: 'Flood (depth in meter)', field: 'flood', extreme: '', extremeColor: '', high: '', highColor: '', moderate: '', moderateColor: '', editMode: false },
  //   { name: 'Snowfall (cm)', field: 'snowfall', extreme: '', extremeColor: '', high: '', highColor: '', moderate: '', moderateColor: '', editMode: false },
  //   { name: 'Lightning (probability)', field: 'lightning', extreme: '', extremeColor: '', high: '', highColor: '', moderate: '', moderateColor: '', editMode: false },
  //   { name: 'Landslide (probability)', field: 'landslide', extreme: '', extremeColor: '', high: '', highColor: '', moderate: '', moderateColor: '', editMode: false },
  //   { name: 'Avalanche (probability)', field: 'avalanche', extreme: '', extremeColor: '', high: '', highColor: '', moderate: '', moderateColor: '', editMode: false }
  // ];
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
      name: 'Accu Rainfall (mm)',
      field: 'accu_rainfall',
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
    this.loadCircleListForDropdown();
    this.fetchKPIRanges();
  }

  ngAfterViewInit(): void {}

  /* Fetch Severity KPI Ranges */
  fetchKPIRanges = () => {
    try {
      this.dataService
        .postData('/fetch-kpi-range')
        .pipe(
          catchError((error: any) => {
            const errorMessage = error?.error?.message || 'Internal Server';

            return throwError(() => error);
          })
        )
        .subscribe((response) => {
          if (response.status === 'success') {
            this.responseData = response.data;
            this.selectedCircle = 'AP';

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

  async loadCircleListForDropdown() {
    try {
      // Prepare payload based on user role
      const apiPayload = { circle: 'All Circle' };

      // Fetch circle list from API
      const res: any = await this.dataService
        .postData('get_circle_list', apiPayload)
        .toPromise();

      // Validate and map API response
      if (res?.status && Array.isArray(res.data)) {
        this.circles = res.data
          .filter(
            (item: { circle: string; location: string }) =>
              item.circle !== 'All Circle'
          )
          .map((item: { circle: string; location: string }) => ({
            value: item.circle,
            location: item.location,
          }))
          .sort(
            (
              a: { value: string; location: string },
              b: { value: string; location: string }
            ) => a.value.localeCompare(b.value)
          );
    
      } else {
        console.error(
          '❌ Failed to load circle list: Invalid API response format'
        );
        this.circles = [];
      }

      // Ensure dropdown overlays correctly above the map
      setTimeout(() => {
        const dropdownEl = document.querySelector('.dropdown-menu');
        if (dropdownEl) {
          const el = dropdownEl as HTMLElement;
          el.style.position = 'absolute';
          el.style.zIndex = '2000'; // keep above map container
        }
      });

      // Trigger Angular change detection
      this.cdr.detectChanges();
    } catch (error) {
      console.error('❌ Failed to load circle list from API:', error);
      this.circles = [];
      this.cdr.detectChanges();
    }
  }

  //Mapping it to the kpiList
  // mapKpiData(circle: string) {
  //   const circleData = this.responseData[circle][0]; // one record per circle
  //   this.kpiList = this.kpiList.map(kpi => ({
  //     ...kpi,
  //     extreme: circleData[`extreme_${kpi.field}`],
  //     high: circleData[`high_${kpi.field}`],
  //     moderate: circleData[`moderate_${kpi.field}`],
  //     extremeColor: circleData[`extreme_${kpi.field}_color`],
  //     highColor: circleData[`high_${kpi.field}_color`],
  //     moderateColor: circleData[`moderate_${kpi.field}_color`],
  //     editMode: false
  //   }));
  // }
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

    const payload: any = { circle: this.selectedCircle };

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
      .postData('/update-kpi-range', payload)
      .pipe(
        catchError((error: any) => {
          const errorMessage = error?.error?.message || 'Internal Server Error';

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
