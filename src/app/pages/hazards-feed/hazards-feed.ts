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

  circleList: any = [];
  districtList: any = [];

  severityList = ['Extreme', 'High', 'Moderate', 'Low'];
  days = ['Day1', 'Day2', 'Day3', 'Day4', 'Day5', 'Day6', 'Day7'];

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
    this.getSelectedtHazardData();
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
    this.getSelectedtHazardData();
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
    console.log('Final Submitted Data:', this.finalSubmittedData);
    this.insertHazards(this.finalSubmittedData);
  }

  showmap() {
    this.showMapFull = true;
  }

  closeMap() {
    this.showMapFull = false;
  }
  delete(index: number) {
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

  edit(index: number) {
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
  }

  // Submit / Update
  addNew() {
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

    // Reset form
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
    console.log(this.selectedDayDate);
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

  //#region API CaLL
  loadCircleListForDropdown() {
    this.dataService
      .postData('get_circle_list', { circle: 'All Circle' })
      .subscribe((res: any) => {
        this.ngZone.run(() => {
          if (res && res.status && Array.isArray(res.data)) {
            let circles = res.data.filter(
              (c: any) => c.circle !== 'All Circle'
            );

            // VERY IMPORTANT: always create a NEW array reference
            const mapped = circles
              .map((circleName: { circle: string; location: string }) => ({
                value: circleName.location,
                label: circleName.circle,
              }))
              .sort((a:any, b:any) => a.label.localeCompare(b.label));

            this.circleList = [...mapped]; // <-- new reference
            // If using OnPush:
            this.cdr.markForCheck();
          } else {
            this.circleList = [];
            this.cdr.markForCheck();
          }
        });
      });
  }

  async loadDistrictListForDropdown() {
    let selectedCircle = this.form.circle;

    try {
      const res: any = await this.dataService
        .postData('get_district_list', { circle: selectedCircle })
        .toPromise();

      this.ngZone.run(() => {
        if (res && res.status && Array.isArray(res.data)) {
          // ALWAYS create new array reference
          this.districtList = [...res.data];

          // If using ChangeDetectionStrategy.OnPush
          this.cdr.markForCheck();
        } else {
          console.error(
            'Failed to load district list: Invalid API response format'
          );
          this.districtList = [];
          this.cdr.markForCheck();
        }
      });
    } catch (error) {
      console.error('Failed to load district list from API:', error);
      this.ngZone.run(() => {
        this.districtList = [];
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

          // ❗ FIX: flat array, not nested array
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
