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
    private cdr: ChangeDetectorRef,
  ) {}

  responseData: any = {};
  circles: any = [];
  selectedCircle: string = '';
  editableKPIData: any = {};
  backups: { [index: number]: any } = {};
  updateModalhistory: boolean = false;
  historyData: any;

  userRole: string = '';
  user: any;

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
      name: 'Visibility (km)',
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
      this.user = JSON.parse(storedUser);
      this.userRole = this.user.userrole;
    }
    this.loadCircleListForDropdown();
    this.fetchKPIRanges();
  }

  ngAfterViewInit(): void {}

  /* Fetch Severity KPI Ranges */
  fetchKPIRanges = () => {
    try {
      this.dataService
        .postRequest('/fetch-kpi-range')
        .pipe(
          catchError((error: any) => {
            const errorMessage = error?.error?.message || 'Internal Server';

            return throwError(() => error);
          }),
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
            (a.value ?? '').localeCompare(b.value ?? ''),
          );
        } else {
          // fallback to empty
          this.circles = [];
        }
      } else {
        console.error(
          '❌ Failed to load circle list: Invalid API response format',
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

  getChangedFields(prev: any, curr: any) {
    return Object.keys(curr)
      .filter((key) => {
        // ❌ skip editmode completely
        if (key === 'editMode') return false;
        const prevVal = prev[key];
        const currVal = this.normalizeRangeValue(curr[key]);

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
        prev_value: this.normalizeRangeValue(prev[key]),
        new_value: this.normalizeRangeValue(curr[key]),
      }));
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
  saveRow(index: number): void {
    const row = this.kpiList[index];
    row.editMode = false;

    // ---------- VALIDATION ----------
    if (!['severity', 'min_color'].includes(row.field)) {
      if (!this.validateThresholds(row, index)) {
        row.editMode = true;
        return;
      }
    }

    // ---------- PAYLOAD BUILD ----------
    const prev = this.backups[index];
    const data = this.buildPayload(row, index);
    const modified_data = this.getChangedFields(prev, row);

    if (!modified_data || modified_data.length === 0) {
      this.snackBar.open('No Action Performed', 'Close', {
        duration: 3000,
        panelClass: ['snackbar-info'],
      });
      return; //  stop further processing
    }

    const payload: any = {
      data: data,
      modified_data: modified_data,
      kpi_name: prev.name,

      modified_by: this.user.userid,
      modifier_role: this.userRole,
    };

    if (Object.keys(data).length === 1) {
      // only circle present → nothing changed
      this.snackBar.open('No Action Performed', 'Close', {
        duration: 3000,
        panelClass: ['snackbar-info'],
      });
      this.editableKPIData = {};
      this.fetchKPIRanges();
      return;
    }

    // ---------- API CALL ----------
    this.dataService.postRequest('update-kpi-range', payload).subscribe({
      next: (res) => {
        if (res.status === 'success') {
          this.snackBar.open(res.message, 'X', {
            duration: 2000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-success-snackbar'],
          });

          delete this.backups[index];
          this.editableKPIData = {};
          this.fetchKPIRanges();
        }
      },
      error: (err) => console.warn('update-kpi-range failed', err),
    });
  }

  /* ================== HELPERS ================== */

  private validateThresholds(row: any, index: number): boolean {
    const levels: Array<'extreme' | 'high' | 'moderate' | 'low'> = [
      'extreme',
      'high',
      'moderate',
      'low',
    ];

    for (const level of levels) {
      const newVal = row[level];
      const referenceVal =
        this.backups[index]?.[level] ?? this.editableKPIData[level];
      if (!this.validateKpiValue(newVal, referenceVal)) {
        this.snackBar.open(
          `Please use valid format for KPI classification.`,
          'OK',
          {
            duration: 5000,
            panelClass: ['custom-error-snackbar'],
            verticalPosition: 'bottom',
            horizontalPosition: 'center',
          },
        );
        return false;
      }
    }
    return true;
  }

  private buildPayload(row: any, index: number): any {
    const payload: any = { circle: this.selectedCircle };

    const ignoredKeys = ['field', 'name', 'editMode'];
    const keyMap: Record<string, Function> = {
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

    Object.keys(row).forEach((key) => {
      if (ignoredKeys.includes(key) || row[key] === this.editableKPIData[key]) {
        return;
      }

      let mappedKey: string | undefined;

      if (row.field === 'severity') {
        mappedKey = keyMap[`${key}Color`]?.();
      } else if (row.field === 'min_color') {
        mappedKey = keyMap[`${key}ColorMin`]?.();
      } else {
        mappedKey = keyMap[key]?.(row.field);
      }

      if (mappedKey) {
        payload[mappedKey] = this.normalizeRangeValue(row[key]);
      }
    });

    return payload;
  }

  private normalizeRangeValue(value: any): any {
    if (typeof value !== 'string') return value;

    let cleaned = value.trim();

    // Normalize "to" ranges
    if (cleaned.includes(' to ')) {
      const parts = cleaned.split('to').map((p) => p.trim());
      if (parts.length === 2) {
        return `${parts[0]} to ${parts[1]}`;
      }
    }

    // Normalize "-" ranges (avoid affecting negative numbers)
    const dashMatch = cleaned.match(/^(.+?)\s*-\s*(.+)$/);
    if (dashMatch) {
      const before = dashMatch[1].trim();
      const after = dashMatch[2].trim();
      return `${before}-${after}`;
    }

    return cleaned;
  }

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

    let finalRegex: RegExp;

    if (usesCompare) {
      finalRegex = new RegExp(`^(>=|<=|>|<)\\s*${numberUnit}$`);
    } else if (usesTo) {
      finalRegex = new RegExp(`^${numberUnit}\\s+to\\s+${numberUnit}$`);
    } else if (usesDash) {
      finalRegex = new RegExp(`^${numberUnit}\\s*-\\s*${numberUnit}$`);
    } else {
      finalRegex = new RegExp(`^${numberUnit}$`);
    }

    //  Format validation
    if (!finalRegex.test(value)) return false;

    //  Negative restriction
    if (!allowsNegative && value.includes('-')) return false;

    //  Additional range logical validation
    if (usesTo || usesDash) {
      const separator = usesTo ? ' to ' : '-';
      const parts = usesTo ? value.split(' to ') : value.split('-');

      if (parts.length !== 2) return false;

      const before = parseFloat(parts[0].replace('%', '').trim());
      const after = parseFloat(parts[1].replace('%', '').trim());

      // Invalid numbers
      if (isNaN(before) || isNaN(after)) return false;

      //  Enforce before < after
      if (before >= after) return false;
    }

    return true;
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

  //Update History Modal
  handleUpdate() {
    this.fetchUpdateHistory();
    this.updateModalhistory = true;
  }

  fetchUpdateHistory(): void {
    this.dataService.postRequest('get-kpi-history').subscribe({
      next: (res: any) => {
        this.historyData = [];
        this.historyData = res?.data ?? [];
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

  // Download Update History
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

    //  Define headers
    const headers = [
      'S.No',
      'KPI Name',
      'Circle',
      'Action On',
      'Previous Value',
      'New Value',
      'Modified By',
      'Modifier Role',
      'Modified On',
    ];

    //  Map rows
    const rows = this.historyData.map((item: any, index: any) => [
      index + 1,
      item.kpi_name,
      item.indus_circle,
      item.action_on,
      item.old_value,
      item.new_value,
      item.modified_by,
      item.modifier_role,
      this.formatUtcDate(item.modified_on),
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
    link.download = `History_KPI_Update.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  formatUtcDate(value: any): string {
    if (!value) return '';

    let date: Date;

    // Already a Date object
    if (value instanceof Date) {
      date = value;
    }
    // SQL datetime without timezone: "YYYY-MM-DD HH:mm:ss(.sss)"
    else if (
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)
    ) {
      date = new Date(value.replace(' ', 'T') + 'Z');
    }
    // ISO string (with Z or +00:00) — let JS handle it
    else {
      date = new Date(value);
    }

    if (isNaN(date.getTime())) {
      console.warn('Invalid date received:', value);
      return '';
    }

    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    });
  }
}
