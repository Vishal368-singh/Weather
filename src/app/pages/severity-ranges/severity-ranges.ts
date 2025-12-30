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
  backups: { [index: number]: any } = {};

  userRole: string = '';

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
      name: 'Wind (kmph)',
      field: 'wind',
      extreme: '',
      high: '',
      moderate: '',
      low: '',
      editMode: false,
    },
    {
      name: 'Temp Max °C (Departure From Normal)',
      field: 'temperature',
      extreme: '',
      high: '',
      moderate: '',
      low: '',
      editMode: false,
    },
    {
      name: 'Temp Min °C (Departure From Normal)',
      field: 'min_temp',
      extreme: '',
      high: '',
      moderate: '',
      low: '',
      editMode: false,
    },
    {
      name: 'Humidity (%)',
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
    // {
    //   name: 'Landslide (probability %)',
    //   field: 'landslide',
    //   extreme: '',
    //   high: '',
    //   moderate: '',
    //   low: '',
    //   editMode: false,
    // },
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
    let storedUser = localStorage.getItem('user');
    if (storedUser) {
      let user = JSON.parse(storedUser);
      this.userRole = user.userrole;
    }
    this.loadCircleListForDropdown();
    this.fetchKPIRanges();
  }

  ngAfterViewInit(): void {}

  //Generate  format based on reference value
  generateValidFormat(referenceValue: string): string {
    referenceValue = referenceValue.trim();

    if (referenceValue.includes(' to ')) {
      return "Format: 5 to 10   (use 'to' for ranges)";
    }
    if (/^-?\d+(\.\d+)?\s*-\s*-?\d+/.test(referenceValue)) {
      return "Format: 5-10   (use '-' for ranges)";
    }
    if (referenceValue.startsWith('>') || referenceValue.startsWith('<')) {
      return 'Format: >5 , <10 , >=4 , <=3';
    }
    if (referenceValue.includes('%')) {
      return 'Format: 50% , 40% to 75% , <30%';
    }
    return 'Format: numeric values like 5 , 10 , 3-6';
  }

  //Detect traits dynamically from production reference
  validateKpiValue(value: string, referenceValue: string): boolean {
    if (!value || !referenceValue) return false;

    value = value.trim();
    referenceValue = referenceValue.trim();

    // Detect traits dynamically from production reference
    const requiresPercent = referenceValue.includes('%');
    const allowsNegative = referenceValue.includes('-');
    const usesTo = referenceValue.includes(' to ');
    const usesDash =
      /-/.test(referenceValue) && !referenceValue.includes(' to ');
    const usesCompare =
      referenceValue.startsWith('>') || referenceValue.startsWith('<');

    const numberUnit = requiresPercent
      ? '-?\\d+(\\.\\d+)?%'
      : '-?\\d+(\\.\\d+)?';

    let finalRegex;

    if (usesCompare) {
      finalRegex = new RegExp(`^(>=|<=|>|<)\\s*${numberUnit}$`);
    } else if (usesTo) {
      finalRegex = new RegExp(`^${numberUnit}\\s+to\\s+${numberUnit}$`);
    } else if (usesDash) {
      finalRegex = new RegExp(`^${numberUnit}\\s*-\\s*${numberUnit}$`);
    } else {
      finalRegex = new RegExp(`^${numberUnit}$`);
    }

    // Format validation
    if (!finalRegex.test(value)) return false;

    // Negative restriction
    if (!allowsNegative && value.includes('-')) return false;

    return true;
  }

  /* Fetch Severity KPI Ranges */
  fetchKPIRanges = () => {
    try {
      this.dataService
        .postRequest('/fetch-kpi-range')
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
        .postRequest('get_circle_list', apiPayload)
        .toPromise();

      // Validate and map API response
      // Normalize server response to this.circles (backwards-compatible & robust)
      if (res) {
        // Prefer array at res.data if present
        const items: any[] = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];

        if (items.length) {
          // map to uniform shape, filter out "All Circle", dedupe by label, then sort
          const mapped = items
            .map((it: any) => ({
              value: it.label ?? it.circle ?? '',
              location: it.value ?? it.location ?? '',
              full_name: it.full_name ?? it.fullName ?? '',
            }))
            .filter((it: any) => (it.value ?? '').trim() !== 'All Circle');

          // dedupe by value (label) keeping first occurrence
          const seen = new Set<string>();
          this.circles = mapped.filter((it: any) => {
            const key = (it.value ?? '').trim();
            if (!key) return false;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          // sort by label/value
          this.circles.sort((a: any, b: any) =>
            (a.value ?? '').localeCompare(b.value ?? '')
          );
        } else {
          // fallback to empty
          this.circles = [];
        }
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

    // backup this row separately (deep copy)
    this.backups[index] = JSON.parse(JSON.stringify(this.kpiList[index]));

    // keep the old behaviour if other code expects editableKPIData:
    this.editableKPIData = JSON.parse(JSON.stringify(this.kpiList[index]));
  }

  // Save changes
  saveRow(index: number) {
    // turn off edit mode first (UI)
    this.kpiList[index].editMode = false;

    const editedKpiData = this.kpiList[index];

    // --- validation  ---
    if (
      editedKpiData.field !== 'severity' &&
      editedKpiData.field !== 'min_color'
    ) {
      const fieldsToValidate: Array<'extreme' | 'high' | 'moderate' | 'low'> = [
        'extreme',
        'high',
        'moderate',
        'low',
      ];
      for (const f of fieldsToValidate) {
        const newVal = editedKpiData[f];
        // use the backup for reference value if available, otherwise fallback
        const referenceVal =
          this.backups[index] && this.backups[index][f]
            ? this.backups[index][f]
            : this.editableKPIData[f];

        const isValid = this.validateKpiValue(newVal, referenceVal);
        if (!isValid) {
          const validFormat = this.generateValidFormat(referenceVal);
          this.snackBar.open(
            `${editedKpiData.name} : "${newVal}" is invalid.\nUse valid format.\n${validFormat}`,
            'OK',
            {
              duration: 5000,
              panelClass: ['custom-error-snackbar'],
              verticalPosition: 'bottom',
              horizontalPosition: 'center',
            }
          );

          // re-open edit mode so user can correct
          this.kpiList[index].editMode = true;
          return;
        }
      }
    }

    // Continue with your existing API update logic below:
    let payload: any = { circle: this.selectedCircle };
    const keyMap: any = {
      extreme: (f: string) => `extreme_${f}`,
      high: (f: string) => `high_${f}`,
      moderate: (f: string) => `moderate_${f}`,
      low: (f: string) => `low_${f}`,
      extremeColor: () => `severity_extreme_color`,
      highColor: () => `severity_high_color`,
      moderateColor: () => `severity_moderate_color`,
      lowColor: () => `severity_low_color`,
      extremeColorMin: () => `extreme_min_color`,
      highColorMin: () => `high_min_color`,
      moderateColorMin: () => `moderate_min_color`,
      lowColorMin: () => `low_min_color`,
    };

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
          } else if (editedKpiData.field === 'min_color') {
            mappedKey = keyMap[`${key}ColorMin`]();
          } else {
            mappedKey = keyMap[key](editedKpiData.field);
          }
          payload[mappedKey] = editedKpiData[key];
        }
      }
    );

    // Send API
    this.dataService.postRequest('/update-kpi-range', payload).subscribe(
      (response) => {
        if (response.status === 'success') {
          this.snackBar.open(response.message, 'X', {
            duration: 2000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-success-snackbar'],
          });

          // cleanup backup for this row
          delete this.backups[index];
          this.editableKPIData = {}; // optional cleanup
          this.fetchKPIRanges();
        }
      },
      (err) => {
        // optional: keep backup so user can retry
        console.warn('update-kpi-range failed', err);
      }
    );
  }

  // Cancel edit
  cancelEdit(index: number) {
    // restore from per-row backup (if available)
    if (this.backups[index]) {
      this.kpiList[index] = JSON.parse(JSON.stringify(this.backups[index]));
      delete this.backups[index];
    } else {
      // fallback: do nothing (no backup available)
      console.warn('No backup found for index', index);
    }

    // turn off edit mode
    this.kpiList[index].editMode = false;

    // clear global editableKPIData if you used that elsewhere
    this.editableKPIData = {};
  }
}
