import { DataService } from './../../data-service/data-service';
import { circle } from '@turf/turf';
import {
  Component,
  OnInit,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  NgZone,
  AfterViewInit,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';

import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-hazards-feed , map-weather',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hazards-feed.html',
  styleUrls: ['./hazards-feed.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HazardsFeed implements OnInit, AfterViewInit {
  finalSubmittedData: any[] = [];
  activeHazardTab: string = 'Snowfall';
  editingIndex: number | null = null;
  selectedDayDate: any;

  isLoadingCircle = false;

  districtSearch: string = '';
  filteredDistrictList: any = [];
  circleList: any = [];
  snowfallCircleList: any = [];
  insertedCircleList: any = [];
  districtList: any = [];

  severityList = ['Extreme', 'High', 'Moderate', 'Low'];

  days = ['Day1', 'Day2', 'Day3', 'Day4', 'Day5', 'Day6', 'Day7'];
  selectedDays: string[] = []; // selected for current division
  availableDays: string[] = [...this.days];

  selectedCircle: any = '';
  selectedDivision: any = '';
  selectedSeverity: any = '';
  // selectedDay: any = '';

  hazardValue: any = '';
  description: any = '';

  kpiColor = {
    extreme: '',
    high: '',
    moderate: '',
    low: '',
  };

  form: any = {
    circle: '',
    districts: [],
    severity: '',
    day: [],
    hazardValue: '',
    description: '',
  };

  tableData: any[] = [];
  currenttableData: any[] = [];
  snowfallDistrictList: any = [];

  hazardWiseTableData: any = {
    Flood: [],
    Cyclone: [
      {
        sno: 1,
        tab: 'Cyclone',
        circle: 'AP',
        districts: 'AP',
        severity: 'High',
        day: 1,
        date: '1-12-2025',
        hazardValue: 'Cyclone',
        description: 'Cyclone alert in coastal AP',
      },
    ],
    Snowfall: [
      {
        sno: 1,
        tab: 'Snowfall',
        circle: 'AP',
        districts: 'AP',
        severity: 'High',
        day: 1,
        date: '1-12-2025',
        hazardValue: 'Snow',
        description: 'Heavy Snowfall expected',
      },
    ],
    Avalanche: [],
    Lightning: [],
    Landslide: [],
    Cloudburst: [],
  };

  linksData: any = {
    Flood: [],

    Cyclone: [
      {
        name: 'Cyclone Team',
        description: 'For verification and detailed cyclone insights',
        url: 'https://dss.imd.gov.in/dwr_img/GIS/cyclone.html',
      },
      {
        name: 'CPC GTH GIS Forecasts',
        description: 'for Week-2 and Week-3 global tropical hazards forecasts ',
        url: 'https://www.cpc.ncep.noaa.gov/products/precip/CWlink/ghaz/',
      },
      {
        name: 'IMD Cyclone Bulletins',
        description: 'for next 168-hour advisories and updates',
        url: 'https://mausam.imd.gov.in/responsive/cyclone_bulletin_archive.php?id=1',
      },
    ],

    Snowfall: [
      {
        name: 'Himalayan Regional Advisory (J&K, HP, and Ladakh Circle) ',
        description: 'Snowfall For Himalayan regional weather advisories',
        url: 'https://internal.imd.gov.in/section/nhac/dynamic/hmc.pdf',
      },
    ],

    Avalanche: [
      {
        name: 'Avalanche Information',
        description: 'For avalanche warnings and bulletins',
        url: 'https://www.drdo.gov.in/drdo/en/documents/avalanche-warning-bulletin',
      },
    ],

    Cloudburst: [
      {
        name: 'Cloudburst Monitoring',
        description: 'For verification and detailed cyclone insights:',
        url: 'https://mosdac.gov.in/cloudburst/',
      },
    ],
  };

  showSeverityPanel = false;

  constructor(
    private dataService: DataService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private snackBar: MatSnackBar
  ) {}
  userRole: string = '';

  ngOnInit() {
    let storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      this.userRole = user.userrole;
    }
    this.loadCircleListForDropdown();
    this.loadDivisionListForDropdown();
    this.currentHazardData();
  }

  async ngAfterViewInit(): Promise<void> {}

  //Layer of Circle
  async setActive(tab: string) {
    this.formReset();
    this.form = {
      circle: '',
      division: '',
      districts: [],
      severity: '',
      day: '',
      date: '',
      hazardValue: '',
      description: '',
      hazardWiseTableData: '',
    };
    this.activeHazardTab = tab;
    this.tableData = [];
    // this.currenttableData = this.hazardWiseTableData[tab] || [];
    this.loadCircleListForDropdown();
    this.loadDivisionListForDropdown();
    await this.currentHazardData();
  }

  toggleDistrict(district: string, event: any) {
    if (event.target.checked) {
      this.form.districts.push(district);
    } else {
      this.form.districts = this.form.districts.filter(
        (d: any) => d !== district
      );
    }
  }

  onDayToggle(day: string, event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;

    if (isChecked) {
      if (!this.selectedDays.includes(day)) {
        this.selectedDays = [...this.selectedDays, day];
      }
    } else {
      this.selectedDays = this.selectedDays.filter((d: any) => d !== day);
    }

    // Always re-evaluate dependent dropdowns
    this.getAvailableDistricts(this.form.day);
  }

  onSubmitClick() {
    if (this.tableData.length === 0) {
      alert('No data to submit!');
      return;
    }

    this.finalSubmittedData = this.tableData.map(
      ({ division, ...rest }) => rest
    );

    this.insertHazards(this.finalSubmittedData);
    this.form = {
      circle: '',
      districts: [],
      division: '',
      severity: '',
      day: [],
      date: '',
      hazardValue: '',
      description: '',
    };
    this.tableData = [];
    this.districtList = [];

    // remove saved days from dropdown
    this.availableDays = [...this.days];
    this.form.days = [];
    // reset selection
    this.selectedDays = [];
    this.selectedDivision = '';
    this.selectedCircle = '';
  }

  deleteSelectedRow(index: number) {
    this.tableData.splice(index, 1);

    if (this.editingIndex === index) {
      this.editingIndex = null;
      this.form = {
        circle: '',
        districts: [],
        severity: '',
        day: '',
        date: '',
        hazardValue: '',
        description: '',
      };
    }

    this.getAvailableDaysForDivision(this.selectedCircle);
    this.getAvailableSeverities(this.availableDays);
  }

  editTableRecords(index: number) {
    this.editingIndex = index;
    const row = this.tableData[index];

    /*  Restore Division / Circle (CRITICAL) */
    if (this.activeHazardTab === 'Snowfall') {
      this.selectedDivision = row.division;
    } else {
      this.selectedCircle = row.circle;
    }

    /*  Restore Days as ARRAY */
    this.availableDays = [row?.day, ...this.availableDays];

    /*  Load form data */
    this.form = {
      circle: row.circle,
      division: row.division,
      districts: [...row.districts],
      severity: row.severity,
      day: row.day,
      hazardValue: row.hazardValue,
      description: row.description,
    };

    // /*  Recalculate dependent dropdowns */
    // this.getAvailableDaysForDivision(this.selectedCircle);
    this.getAvailableSeverities(this.selectedDays);
    this.addDistrictInDropdownList(row);
  }

  // Submit / Update
  addNewRecord() {
    const days = [...this.selectedDays];
    if (this.editingIndex !== null) {
      // Update existing row
      this.tableData[this.editingIndex] = {
        tab: this.activeHazardTab,
        division: this.form.division,
        circle: this.form.circle,
        districts:
          this.activeHazardTab == 'Snowfall'
            ? this.snowfallDistrictList
            : [...this.form.districts],
        severity: this.form.severity,
        day: this.form.day,
        date: this.getDateFromSelectedDay(this.form.day),
        hazardValue: this.form.hazardValue,
        description: this.form.description,
      };
      this.editingIndex = null;
    } else if (this.activeHazardTab === 'Snowfall') {
      // Add new row
      days.forEach((day: string) => {
        this.tableData.push({
          tab: this.activeHazardTab,
          circle: this.selectedCircle,
          division: this.selectedDivision,
          districts:
            this.activeHazardTab == 'Snowfall'
              ? this.snowfallDistrictList
              : [...this.form.districts],
          severity: this.form.severity,
          day: day, //  single day per row
          date: this.getDateFromSelectedDay(day),
          hazardValue: this.form.hazardValue,
          description: this.form.description,
        });
      });
    } else {
      this.tableData.push({
        tab: this.activeHazardTab,
        circle: this.selectedCircle,
        districts: [...this.form.districts],
        severity: this.form.severity,
        day: this.form.day,
        date: this.selectedDayDate,
        hazardValue: this.form.hazardValue,
        description: this.form.description,
      });
    }

    this.selectedSeverity = this.form.severity;
    // this.selectedDay = this.form.day;
    this.getAvailableSeverities(this.selectedDays);
    this.activeHazardTab === 'Snowfall'
      ? this.getAvailableDaysForDivision(this.selectedCircle)
      : '';
    this.removeDistrictsForDropodwn(this.tableData);

    // Reset form
    this.form = {
      circle: this.selectedCircle,
      districts: [],
      severity: '',
      day: [],
      date: '',
      hazardValue: '',
      description: '',
    };
  }

  formReset() {
    this.form = {
      circle: '',
      division: '',
      districts: [],
      severity: '',
      day: '',
      date: '',
      hazardValue: '',
      description: '',
      hazardWiseTableData: '',
    };

    this.selectedCircle = '';
    this.selectedDivision = '';
    this.selectedDays = [];
    this.availableDays = [...this.days];
    this.districtList = [];
    this.filteredDistrictList = [];
    this.tableData = [];
    this.editingIndex = null;

    this.getAvailableSeverities(this.availableDays);
  }

  getAvailableSeverities(days: string[] | string) {
    const masterList = ['Extreme', 'High', 'Moderate', 'Low'];

    const usedSeverities = new Set(
      this.tableData
        .map((item: any) => item.severity)
        .filter((s: string) => !!s)
    );

    this.severityList = masterList.filter(
      (severity) => !usedSeverities.has(severity)
    );

    this.severityList.sort();
  }

  getAvailableDaysForDivision(division: string) {
    this.selectedDays = [];

    const divisionData = this.tableData.filter(
      (item: any) => item.circle === division
    );

    const alreadySelectedDays = new Set(
      divisionData.flatMap((item: any) => item.day)
    );

    this.availableDays = this.days.filter(
      (d: string) => !alreadySelectedDays.has(d)
    );

    this.availableDays.sort((a, b) => a.localeCompare(b));
  }

  getAvailableDistricts = (day: any) => {
    this.form.districts = [];
    const filterTableData = this.tableData.filter((item) => item.day === day);
    const alreadySelectedDistrict = new Set(
      filterTableData.flatMap((item: any) => item.districts)
    );
    // let alreadySelectedDistrict: any = record.map((item) => item.districts);
    if (alreadySelectedDistrict.size > 0) {
      this.districtList = this.districtList.filter(
        (d: any) => !alreadySelectedDistrict.has(d.district)
      );
      this.districtList.sort((a: any, b: any) =>
        a.district.localeCompare(b.district)
      );

      this.filteredDistrictList = this.filteredDistrictList.filter(
        (d: any) => !alreadySelectedDistrict.has(d.district)
      );
      this.filteredDistrictList.sort((a: any, b: any) =>
        a.district.localeCompare(b.district)
      );
    } else {
      this.loadDistrictListForDropdown();
    }
  };

  getDateFromSelectedDay(day: string): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayNum = Number(day.replace('Day', '').trim());
    if (isNaN(dayNum)) {
      return '';
    }

    const recordDate = new Date(today);
    recordDate.setDate(today.getDate() + (dayNum - 1));

    const dd = String(recordDate.getDate()).padStart(2, '0');
    const mm = String(recordDate.getMonth() + 1).padStart(2, '0');
    const yyyy = recordDate.getFullYear();

    return `${dd}-${mm}-${yyyy}`;
  }

  // selectedDay: any = '';/
  getDateFromSelectedDayForOtherHaz = (day: any) => {
    this.selectedDays = day;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayNum = parseInt(day.replace('Day', '').trim(), 10);
    const recordDate = new Date(today);
    recordDate.setDate(today.getDate() + (dayNum - 1));
    const dd = String(recordDate.getDate()).padStart(2, '0');
    const mm = String(recordDate.getMonth() + 1).padStart(2, '0');
    const yyyy = recordDate.getFullYear();

    const recordDateStr = `${dd}-${mm}-${yyyy}`;
    this.selectedDayDate = recordDateStr;
    this.getAvailableSeverities(day);
    this.getAvailableDistricts(day);
    // console.log(this.tableData);
  };

  changeDateFormat = (dateStr: any) => {
    const date = new Date(dateStr);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // months are 0-indexed
    const yyyy = date.getFullYear();
    const formattedDate = `${dd}-${mm}-${yyyy}`;

    return formattedDate;
  };

  onCircleChange = () => {
    this.selectedCircle =
      this.activeHazardTab === 'Snowfall' ? '' : this.selectedCircle;
    this.selectedDivision =
      this.activeHazardTab === 'Snowfall' ? this.selectedDivision : '';
    if (this.activeHazardTab === 'Snowfall') {
      this.snowfallAffectedDistricts();
      // this.selectedCircle = this.districtList[0]?.indus_circle;
    }
  };

  async snowfallAffectedDistricts() {
    try {
      this.snowfallDistrictList = [];

      const res: any = await this.dataService
        .postRequest('get_snowfall_affected_districts', {
          division: this.selectedDivision,
        })
        .toPromise();

      this.ngZone.run(() => {
        if (res?.status && Array.isArray(res.data)) {
          //  push only district names
          this.snowfallDistrictList = [];
          this.selectedCircle = res.data[0]?.indus_circle;
          res.data.forEach((item: any) => {
            if (item?.district) {
              this.snowfallDistrictList.push(item.district);
            }
          });
          this.cdr.markForCheck();
        } else {
          console.error(
            'Failed to load district list: Invalid API response format'
          );
          this.snowfallDistrictList = [];
          this.cdr.markForCheck();
        }
      });
    } catch (error) {
      console.error('Failed to load district list from API:', error);
      this.ngZone.run(() => {
        this.snowfallDistrictList = [];
        this.filteredDistrictList = [];
        this.cdr.markForCheck();
      });
    }
  }

  async currentHazardData() {
    try {
      this.currenttableData = [];
      const res: any = await this.dataService
        .postRequest('get-hazards', {
          hazard: this.activeHazardTab,
        })
        .toPromise();
      this.ngZone.run(() => {
        if (res?.status && Array.isArray(res.data)) {
          this.currenttableData = res.data;
          console.log(res.data);
          this.cdr.markForCheck();
        } else {
          console.error(
            'Failed to load district list: Invalid API response format'
          );
          this.snowfallDistrictList = [];
          this.cdr.markForCheck();
        }
      });
    } catch (error) {
      console.error('Failed to load district list from API:', error);
      this.ngZone.run(() => {
        this.snowfallDistrictList = [];
        this.filteredDistrictList = [];
        this.cdr.markForCheck();
      });
    }
  }

  onDistrictSearch() {
    const search = this.districtSearch.toLowerCase();
    this.filteredDistrictList = this.districtList.filter((d: any) =>
      d.district.toLowerCase().includes(search)
    );
  }

  removeDistrictsForDropodwn = (tableData: any) => {
    // District
    const usedDistricts = new Set(
      tableData.flatMap((item: any) => item.districts)
    );
    this.districtList = this.districtList.filter(
      (d: any) => !usedDistricts.has(d.district)
    );
    this.districtList.sort((a: any, b: any) =>
      a.district.localeCompare(b.district)
    );

    this.filteredDistrictList = this.filteredDistrictList.filter(
      (d: any) => !usedDistricts.has(d.district)
    );
    this.filteredDistrictList.sort((a: any, b: any) =>
      a.district.localeCompare(b.district)
    );
    // Severity
    // this.severityList = this.severityList.filter(
    //   (d) => d !== this.selectedSeverity
    // );
    // this.severityList.sort();

    // D-ays
    // this.days = this.days.filter((d) => d !== this.selectedDay);
    // this.days.sort();
  };

  addDistrictInDropdownList = (row: any) => {
    row.districts.forEach((dist: string) => {
      // Add only if district not already present
      if (!this.districtList.some((d: any) => d.district === dist)) {
        this.districtList.push({ district: dist });
      }
      if (!this.filteredDistrictList.some((d: any) => d.district === dist)) {
        this.filteredDistrictList.push({ district: dist });
      }
    });
    this.districtList.sort((a: any, b: any) =>
      a.district.localeCompare(b.district)
    );
    this.filteredDistrictList.sort((a: any, b: any) =>
      a.district.localeCompare(b.district)
    );

    // Severity
    this.getAvailableSeverities(row.day);
    if (row.severity !== '' && !this.severityList.includes(row.severity)) {
      this.severityList.push(row.severity);
      this.severityList.sort();
    }
  };

  loadCircleListForDropdown = () => {
    this.isLoadingCircle = true; // Show loader

    forkJoin({
      circleList: this.dataService.postRequest('get_circle_list', {
        circle: 'All Circle',
      }),
      inserted: this.insertedHazardCirclesList(),
    }).subscribe(({ circleList, inserted }: any) => {
      // Validate response
      if (!circleList?.status || !Array.isArray(circleList.data)) {
        this.circleList = [];
        this.isLoadingCircle = false;
        this.cdr.markForCheck();
        return;
      }

      // API returns items like: { value, label, full_name }
      // Remove the "All Circle" label first
      let circles = circleList.data.filter(
        (c: any) => c.label === 'UN-JK' || c.label === 'UN-HP'
      );

      if (this.activeHazardTab === 'Avalanche') {
        circles = circles.filter();
      }

      // inserted likely contains { indus_circle: 'AP' } etc. Compare against label
      const usedCircle = Array.isArray(inserted)
        ? inserted.map((x: any) => x.indus_circle)
        : [];

      // Filter out circles already used (by label)
      let filterCircles = circles.filter(
        (c: any) => !usedCircle.includes(c.label)
      );

      // If nothing left, fall back to full list (excluding "All Circle")
      if (!filterCircles.length) filterCircles = [...circles];

      // Map to desired shape and sort
      this.circleList = filterCircles
        .map((c: any) => ({
          value: c.value, // API 'value'
          label: c.label, // API 'label'
          full_name: c.full_name,
        }))
        .sort((a: any, b: any) => a.label.localeCompare(b.label));

      this.isLoadingCircle = false; // hide loader
      this.cdr.markForCheck();
    });
  };

  loadDivisionListForDropdown = () => {
    this.isLoadingCircle = true; // Show loader
    this.dataService
      .postRequest('get_snowfall_division')
      .subscribe((res: any) => {
        this.isLoadingCircle = false; // hide loader
        if (res && res.status && Array.isArray(res.data)) {
          this.snowfallCircleList = res.data;
        } else {
          this.snowfallCircleList = [];
        }
        this.cdr.markForCheck();
      });
  };

  async insertedHazardCirclesList() {
    try {
      this.insertedCircleList = [];
      const res: any = await this.dataService
        .postRequest('inserted_hazard_circle_list', {
          hazard: this.activeHazardTab,
        })
        .toPromise();

      if (res && res.status && Array.isArray(res.data)) {
        this.insertedCircleList = [...res.data]; // new array reference
      } else {
        console.error('Invalid API response format');
        this.insertedCircleList = [];
      }
    } catch (error) {
      console.error('API error:', error);
      this.insertedCircleList = [];
    }

    return this.insertedCircleList;
  }

  async loadDistrictListForDropdown() {
    try {
      this.districtList = [];
      this.filteredDistrictList = [];
      const res: any = await this.dataService
        .postRequest('get_district_list', { circle: this.selectedCircle })
        .toPromise();

      this.ngZone.run(() => {
        if (res && res.status && Array.isArray(res.data)) {
          // ALWAYS create new array reference
          this.districtList = [...res.data];
          this.filteredDistrictList = [...this.districtList];
          // If using ChangeDetectionStrategy.OnPush
          this.cdr.markForCheck();
        } else {
          console.error(
            'Failed to load district list: Invalid API response format'
          );
          this.districtList = [];
          this.filteredDistrictList = [];
          this.cdr.markForCheck();
        }
      });
    } catch (error) {
      console.error('Failed to load district list from API:', error);
      this.ngZone.run(() => {
        this.districtList = [];
        this.filteredDistrictList = [];
        this.cdr.markForCheck();
      });
    }
  }

  async insertHazards(data: any) {
    try {
      const res: any = await this.dataService
        .postRequest('insert-hazards', {
          data: data,
          hazard: this.activeHazardTab,
        })
        .toPromise();
      if (res && res.status) {
        this.snackBar.open(res.message, 'X', {
          duration: 2000, // auto close after 3s
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: ['custom-success-snackbar'],
        });
      } else {
        this.snackBar.open(
          'Failed to insert flood hazard : Invalid API response format',
          'X',
          {
            duration: 2000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-error-snackbar'],
          }
        );
      }
    } catch (error) {
      console.error(' Failed to insert flood hazard from API:', error);
    }
  }

  async getSelectedtHazardData() {
    try {
      const res: any = await this.dataService
        .postRequest('get-hazards', { hazard: this.activeHazardTab })
        .toPromise();

      this.ngZone.run(() => {
        if (res && res.status && Array.isArray(res.data)) {
          const data = res.data.map((ele: any) => ({
            tab: this.activeHazardTab,
            circle: ele.indus_circle,
            districts: ele.district,
            severity: ele.severity,
            day: ele.days,
            date: this.changeDateFormat(ele.date),
            hazardValue: ele.hazard_value,
            description: ele.description,
          }));

          // FIX: flat array, not nested array
          this.tableData = [...data];

          // OnPush: trigger UI update
          this.cdr.markForCheck();
        } else {
          console.error(
            'Failed to insert flood hazard : Invalid API response format'
          );
          this.tableData = [];
          this.cdr.markForCheck();
        }
      });
    } catch (error) {
      console.error('Failed to insert flood hazard from API:', error);

      this.ngZone.run(() => {
        this.tableData = [];
        this.cdr.markForCheck();
      });
    }
  }
}
