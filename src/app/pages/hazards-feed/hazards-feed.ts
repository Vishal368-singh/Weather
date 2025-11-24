import { Severity } from './../../components/severity/severity';
import {
  Component,
  OnInit,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  NgZone,
  NgModule,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapWeather } from '../../components/map-weather/map-weather';
import { DataService } from '../../data-service/data-service';
import { circle } from '@turf/turf';

@Component({
  selector: 'app-hazards-feed , map-weather',
  standalone: true,
  imports: [CommonModule, FormsModule, MapWeather],
  templateUrl: './hazards-feed.html',
  styleUrls: ['./hazards-feed.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HazardsFeed {
  finalSubmittedData: any[] = [];
  activeHazardTab: string = 'Flood';
  editingIndex: number | null = null;
  showMapFull = false;
  selectedDayDate: any;

  districtSearch: string = '';
  filteredDistrictList: any = [];
  circleList: any = [];
  insertedCircleList: any = [];
  districtList: any = [];

  severityList = ['Extreme', 'High', 'Moderate', 'Low'];
  days = ['Day1', 'Day2', 'Day3', 'Day4', 'Day5', 'Day6', 'Day7'];

  selectedCircle: any = '';
  selectedSeverity: any = '';
  selectedDay: any = '';

  hazardValue: any = '';
  description: any = '';

  form: any = {
    circle: '',
    districts: [],
    severity: '',
    day: '',
    hazardValue: '',
    description: '',
  };

  tableData: any[] = [];

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

  constructor(
    private dataService: DataService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.loadCircleListForDropdown();
    // this.getSelectedtHazardData();
  }

  async setActive(tab: string) {
    this.form = {
      circle: '',
      districts: [],
      severity: '',
      day: '',
      date: '',
      hazardValue: '',
      description: '',
    };
    this.activeHazardTab = tab;
    this.tableData = [];
    this.loadCircleListForDropdown();
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

  onSubmitClick() {
    if (this.tableData.length === 0) {
      alert('No data to submit!');
      return;
    }
    this.finalSubmittedData = [...this.tableData];
    // console.log('Final Submitted Data:', this.finalSubmittedData);
    const hasAllDays = this.days.every((day) =>
      this.finalSubmittedData.some((item) => item.day === day)
    );

    if (!hasAllDays) {
      alert('Please add all days in the table!');
    } else {
      this.insertHazards(this.finalSubmittedData);
      this.form = {
        circle: '',
        districts: [],
        severity: '',
        day: '',
        date: '',
        hazardValue: '',
        description: '',
      };
      this.tableData = [];
      this.districtList = [];
    }
  }

  showmap() {
    this.showMapFull = true;
  }

  closeMap() {
    this.showMapFull = false;
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
  }

  editTableRecords(index: number) {
    this.editingIndex = index;

    const row = this.tableData[index];

    // Load row data into form
    this.form = {
      circle: row.circle,
      districts: [...row.districts], // array copy
      severity: row.severity,
      day: row.day,
      hazardValue: row.hazardValue,
      description: row.description,
    };
    this.selectedSeverity = row.severity;
    this.selectedDay = row.day;
    this.addDistrictInDropdownList(row);
  }

  // Submit / Update
  addNewRecord() {
    if (this.editingIndex !== null) {
      // Update existing row
      this.tableData[this.editingIndex] = {
        tab: this.activeHazardTab,
        circle: this.form.circle,
        districts: [...this.form.districts],
        severity: this.form.severity,
        day: this.form.day,
        date: this.selectedDayDate,
        hazardValue: this.form.hazardValue,
        description: this.form.description,
      };
      this.editingIndex = null;
    } else {
      // Add new row
      this.tableData.push({
        tab: this.activeHazardTab,
        circle: this.form.circle,
        districts: [...this.form.districts],
        severity: this.form.severity,
        day: this.form.day,
        date: this.selectedDayDate,
        hazardValue: this.form.hazardValue,
        description: this.form.description,
      });
    }
    this.selectedSeverity = this.form.severity;
    this.selectedDay = this.form.day;
    this.getAvailableSeverities(this.selectedDay);
    this.removeDistrictsForDropodwn(this.tableData);

    // Reset form
    this.form = {
      circle: this.selectedCircle,
      districts: [],
      severity: '',
      day: this.selectedDay,
      date: '',
      hazardValue: '',
      description: '',
    };
  }

  getAvailableSeverities = (day: any) => {
    debugger;
    const record = this.tableData.filter((item) => item.day === day);
    let alreadySelectedSeverity: any = record.map((item) => item.severity);
    if (alreadySelectedSeverity.length > 0) {
      const setSeverity = new Set(alreadySelectedSeverity);
      this.severityList = this.severityList.filter(
        (s: any) => !setSeverity.has(s)
      );
      this.severityList.sort();
    } else {
      this.severityList = ['Extreme', 'High', 'Moderate', 'Low'];
    }
  };

  getDateFromSelectedDay = (day: any) => {
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
    console.log(this.tableData);
  };

  changeDateFormat = (dateStr: any) => {
    const date = new Date(dateStr);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // months are 0-indexed
    const yyyy = date.getFullYear();
    const formattedDate = `${dd}-${mm}-${yyyy}`;
    // console.log(formattedDate);
    return formattedDate;
  };

  onCircleChange = () => {
    this.selectedCircle = this.form.circle;
    this.loadDistrictListForDropdown();
  };

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

    // D-ays
    // if (row.day !== '') {
    //   this.days.push(row.day);
    //   this.days.sort();
    // }
  };

  //#region API CaLL
  loadCircleListForDropdown = () => {
    this.dataService
      .postData('get_circle_list', { circle: 'All Circle' })
      .subscribe((res: any) => {
        this.ngZone.run(async () => {
          if (res && res.status && Array.isArray(res.data)) {
            let circles = res.data.filter(
              (c: any) => c.circle !== 'All Circle'
            );

            // Remove already inserted circle
            const insertedCircleList: any =
              await this.insertedHazardCirclesList();
            const usedCircle = insertedCircleList.map(
              (item: any) => item.indus_circle
            );
            const filterCircles = circles.filter(
              (c: any) => !usedCircle.includes(c.circle)
            );

            const mapped = filterCircles
              .map((circleName: { circle: string; location: string }) => ({
                value: circleName.location,
                label: circleName.circle,
              }))
              .sort((a: any, b: any) => a.label.localeCompare(b.label));
            this.circleList = [...mapped]; // <-- new reference
            // If using OnPush:
            this.cdr.markForCheck();
          } else {
            this.circleList = [];
            this.cdr.markForCheck();
          }
        });
      });
  };

  async insertedHazardCirclesList() {
    try {
      const res: any = await this.dataService
        .postData('inserted_hazard_circle_list', {
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
      const res: any = await this.dataService
        .postData('get_district_list', { circle: this.selectedCircle })
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
        .postData('insert-hazards', {
          data: data,
          hazard: this.activeHazardTab,
        })
        .toPromise();
      if (res && res.status) {
        alert(res.message);
      } else {
        console.error(
          'Failed to insert flood hazard : Invalid API response format'
        );
      }
    } catch (error) {
      console.error(' Failed to insert flood hazard from API:', error);
    }
  }

  async getSelectedtHazardData() {
    try {
      const res: any = await this.dataService
        .postData('get-hazards', { hazard: this.activeHazardTab })
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

  //#endregion
}
