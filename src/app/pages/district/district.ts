import { circle } from '@turf/turf';
import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  AfterViewInit,
  ChangeDetectorRef,
  HostListener,
} from '@angular/core';
import Map from 'ol/Map';
import { CommonModule } from '@angular/common';
import { DataService } from '../../data-service/data-service';
import { MapWeather } from '../../components/map-weather/map-weather';
import { FormsModule } from '@angular/forms';
import { WeatherService } from '../../services/weather';
import { Subject, catchError, throwError, map, firstValueFrom } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { CurrentLocationService } from '../../services/current-location-service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import * as XLSX from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';

interface DistrictGroup {
  [circle: string]: string[];
}

interface HourlyWeather {
  time: string;
  temp: number;
  rain: number;
  wind: number;
  chanceOfRain: any;
  icon: string;
}
interface DailyWeather {
  date: string;
  minTemp: number;
  maxTemp: number;
  description: string;
  chanceOfRain: any;
  humidity: any;
  icon: string;
}

interface CurrentForecast {
  location: string;
  current_time: string;
  temp: number | null;
  wind_speed: number | null;
  pressure: number | null;
  uv_index: number | null;
  humidity: number | null;
  wind_dir: string;
  visibility: number | null;
  heat_index: number | null;
  condition: string;
  feels_like: number | null;
  icon: string;
}

@Component({
  selector: 'app-district',
  standalone: true,
  imports: [CommonModule, MapWeather, FormsModule],
  templateUrl: './district.html',
  styleUrl: './district.css',
})
export class District implements OnInit, AfterViewInit {
  @ViewChild('scrollContainer', { static: false }) scrollContainer!: ElementRef;
  @ViewChild('searchDistrict') searchDistrict!: ElementRef<HTMLInputElement>;
  @ViewChild('ticker') ticker!: ElementRef<HTMLDivElement>;
  @ViewChild('scrollContainer7DayForecast', { static: false })
  scrollContainer7DayForecast!: ElementRef;
  @ViewChild(MapWeather) mapWeather!: MapWeather;

  constructor(
    private dataService: DataService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
    private WeatherService: WeatherService,
    private locationSevice: CurrentLocationService,
    private snackBar: MatSnackBar,
  ) {}

  //#region Component State
  timeZone = environment.timeZone;

  currentHour24 = new Date().getHours().toString().padStart(2, '0') + ':00';
  selectedPage = 'district';
  showForecast = false;
  atScrollStart: boolean = true;
  atScrollEnd: boolean = false;
  atScrollStart7DayForecast: boolean = true;
  atScrollEnd7DayForecast: boolean = false;
  current: any = null;
  location: any = null;
  activeAccordion: string = '';
  currentTime: string = '';
  lastUpdatedTime: string = '';
  isLoading: boolean = false;
  allDistrictFeatures: any[] = [];

  districtList: any[] = [];
  compareDistrict = (a: any, b: any) => a?.name === b?.name;
  highlightedDistrictName: string = '';
  showDistrictModal = false;
  districtEmails = '';
  sendingDistrict = false;
  selectAllDistrict = false;
  state_ut: string = '';
  activeIndex: number = -1;
  districtSearch: string = '';
  showSuggestions: boolean = false;
  districtList2: any[] = [];
  isOpen = false;
  selectedHazard = '';
  selectedSeverity = 'All';
  selectedDistrict = '';
  selectedDistrictName: string = '';
  selectedLayer = '';
  SelectedDistrict: string = '';
  currentHourRainPercent: any;
  currentHourRainMM: any;
  hourlyData: HourlyWeather[] = [];
  weatherData: DailyWeather[] = [];
  hourlyRainfallIMD: any = [];
  hazardTypes: any = [];
  severityTypes: any = [];
  hazardsArray: any = [];
  hazardsGeoJSON: any;
  apiResponseOfWeatherData: any[] = [];
  condition_text: any[] = [];
  dayForecastList: any[] = [];
  hourlyForecastList: any[] = [];
  sources = [{ label: 'Weather API', value: 'weather_api', visibility: true }];
  alertMessages: string[] = [];
  dayForecastWeatherData: any[] = []; //Store 7 days forecast data
  private loadWeatherSubject = new Subject<void>();
  selectedSource = 'weather_api';
  uniqueConditionsWithIcons: any[] = [
    {
      name: 'Rain, Partially cloudy',
      dayUrl: '//cdn.weatherapi.com/weather/64x64/day/353.png',
      nightUrl: '//cdn.weatherapi.com/weather/64x64/night/353.png',
    },
    {
      name: 'Rain, Overcast',
      dayUrl: '//cdn.weatherapi.com/weather/64x64/day/296.png',
      nightUrl: '//cdn.weatherapi.com/weather/64x64/night/296.png',
    },
    {
      name: 'Partially cloudy',
      dayUrl: '//cdn.weatherapi.com/weather/64x64/day/116.png',
      nightUrl: '//cdn.weatherapi.com/weather/64x64/night/116.png',
    },
    {
      name: 'Overcast',
      dayUrl: '//cdn.weatherapi.com/weather/64x64/day/122.png',
      nightUrl: '//cdn.weatherapi.com/weather/64x64/night/122.png',
    },
    {
      name: 'Clear',
      dayUrl: '//cdn.weatherapi.com/weather/64x64/day/113.png', // Clear day
      nightUrl: '//cdn.weatherapi.com/weather/64x64/night/113.png',
    },
  ];

  todaysDate: string = '';
  circle: string = '';
  isLocationDropdown: boolean = true;
  dropdownLocation: string = '';
  selectedDay: string = 'TODAY';
  deviationData: any = null;

  activeTab: string = ''; // default tab
  categoriesKeys: any = [];
  keywords = [
    { label: 'Rainfall', value: 'Rain' },
    { label: 'Thunderstorm', value: 'Thunderstorm' },
    { label: 'Lightning', value: 'Lightning' },
    { label: 'Flood', value: 'Flood' },
    { label: 'Landslide', value: 'Landslide' },
    { label: 'Avalanche', value: 'Avalanche' },
  ];

  hazardMap!: Map;

  user: any = {};
  userRole: string = '';
  serviceType: string | null = 'weatherapi';
  selectedLocation: string = '';
  rainfactor: number = 1;
  groupedDistricts: DistrictGroup = {};
  districtsList: string[] = [];
  showDropdown = false;
  loading: boolean = false;
  countOfDistrict = 0;
  private weatherRequestId = 0;

  current_forecast: CurrentForecast = {
    location: '',
    current_time: '',
    temp: null,
    wind_speed: null,
    pressure: null,
    uv_index: null,
    humidity: null,
    wind_dir: '',
    visibility: null,
    heat_index: null,
    condition: '',
    feels_like: null,
    icon: '',
  };

  safeDetectChanges() {
    this.cdr.markForCheck();
  }

  get logId(): string | null {
    return localStorage.getItem('logId');
  }

  private SPEED_PX_PER_SEC = 130; // constant speed

  ngOnInit(): void {
    this.WeatherService.clearSelectedLayer();
    let storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        this.user = JSON.parse(storedUser) || {};
      } catch (error) {
        console.warn(
          'Unable to parse stored user. District page will skip session location.',
          error,
        );
        this.user = {};
      }
      this.serviceType = localStorage.getItem('service_type');
      this.userRole = this.user?.userrole || '';

      this.circle = this.getUserCircle(this.user);

      const sessionLocation = this.normalizeLocation(this.user.location);
      if (sessionLocation) {
        this.selectedLocation = sessionLocation;
        this.dropdownLocation = this.user.location_name || this.circle || '';
      }

      this.WeatherService.setDistrictCircle(this.selectedLocation);
    }

    // this.WeatherService.location$.subscribe((location: string) => {
    //   const nextLocation = this.normalizeLocation(location);
    //   if (!nextLocation) {
    //     console.warn('location$ received empty value. Skipping loadWeather.');
    //     return;
    //   }
    //   this.isLocationDropdown = false;
    //   if (this.selectedDay === 'TODAY') {
    //     this.selectedLocation = nextLocation;
    //     this.loadWeather();
    //   } else {
    //     this.selectedLocation = nextLocation;
    //     this.loadWeatherSubject.next();
    //     this.safeDetectChanges();
    //   }
    // });

    this.WeatherService.weatherDataCache$.subscribe((responseData: any) => {
      if (responseData.length == 0) return;
      this.isLocationDropdown = false;
      var response: any = responseData;
      if (this.selectedDay === 'TODAY') {
        this.loadTodayWeatherdata(response);
      } else {
        this.loadNextDayWeatherData(1);
      }
      this.safeDetectChanges();
    });

    this.loadWeatherSubject
      .pipe(debounceTime(400))
      .subscribe(() => this.loadWeather());

    this.WeatherService.selectedLayer$.subscribe((layer) => {
      this.selectedLayer = layer;
      this.safeDetectChanges();
    });

    this.loadWeatherSubject.next();

    this.WeatherService.selectedDay$.subscribe((day: string) => {
      if (day === 'today') {
        this.selectedDay = 'TODAY';
        this.loadTodayWeatherdata(this.apiResponseOfWeatherData);
      } else if (day === 'tomorrow') {
        let index = 1;
        this.selectedDay = 'TOMORROW';
        this.loadNextDayWeatherData(index);
      }
    });

    this.WeatherService.circleChangedIs$.subscribe((circleArray: any) => {
      const changedCircle = Array.isArray(circleArray) ? circleArray[0] : null;
      if (!changedCircle) {
        console.warn(
          'circleChangedIs$ received empty value. Skipping loadWeather.',
        );
        return;
      }
      const mappedLocation = this.normalizeLocation(changedCircle?.value);
      if (!mappedLocation) {
        console.warn(
          'circleChangedIs$ received invalid location. Skipping loadWeather.',
        );
        return;
      }

      this.circle = changedCircle?.label || this.circle;
      this.selectedLocation = mappedLocation;
      this.dropdownLocation = changedCircle?.location_name || this.circle;
      this.isLocationDropdown = true;

      this.selectedDistrictName = '';
      this.SelectedDistrict = null as any;
      this.persistDistrictLocation();
      this.WeatherService.setDistrictCircle(this.selectedLocation);
      this.fetchHazardTypes();

      this.loadWeather();
      this.fetchDistrictList();
      this.safeDetectChanges();
    });

    // this the  select distric function//
    this.WeatherService.getGroupedDistrictsArray$.subscribe(
      (districts: DistrictGroup) => {
        if (!districts) return;
        this.groupedDistricts = districts;
        this.districtList = this.groupedDistricts[this.circle] ?? [];
        this.prepareDistrictModalList();
      },
    );

    this.fetchDistrictList();
    this.fetchHazardTypes();

    this.fetchRecentEarthquake();
    this.safeDetectChanges();
  }

  async ngAfterViewInit(): Promise<void> {
    //this stops the zoom level to india for IDW buffer
    if (this.mapWeather) {
      this.mapWeather.disableZoomOnIDW = true;
    }
  }

  selectLayer(layer: string) {
    this.WeatherService.setSelectedLayer(layer);
  }

  private getUserCircle(user: any): string {
    return user?.circle || user?.indus_circle || user?.region || '';
  }

  private normalizeLocation(location: any): string {
    return typeof location === 'string' ? location.trim() : '';
  }

  private getLatLong(
    location: string,
  ): { latitude: number; longitude: number } | null {
    const [latitude, longitude] = this.normalizeLocation(location)
      .split(',')
      .map((value) => Number(value.trim()));

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return { latitude, longitude };
  }

  private persistDistrictLocation(): void {
    if (!localStorage.getItem('user') || !this.user) return;

    const updatedUser = {
      ...this.user,
    
    };

    localStorage.setItem('user', JSON.stringify(updatedUser));
    this.user = updatedUser;
  }

  updateWeatherLogTable(payload: Object) {
    this.dataService.sendWeatherUserLog(payload).subscribe((res) => {
      if (res?.status === 'success') {
      }
    });
  }

  hazardIcon = [
    { label: 'Flood', icon: 'fa-solid fa-water' },
    { label: 'Thunderstorm', icon: 'fa-solid fa-cloud-bolt' },
    { label: 'Rainfall', icon: 'fa-solid fa-cloud-showers-heavy' },
    { label: 'Lightning', icon: 'fa-solid fa-bolt' },
    { label: 'Flood', icon: 'fa-solid fa-hill-rockslide' },
    { label: 'Thunderstorm', icon: 'fa-solid fa-hill-avalanche' },
    { label: 'Landslide', icon: 'fa-solid fa-mountain' },
    { label: 'Avalanche', icon: 'fa-solid fa-mountain' },

    { label: 'Fog', icon: 'fa-solid fa-smog' },
    { label: 'Snowfall', icon: 'fa-solid fa-snowflake' },
    { label: 'Heat Wave', icon: 'fa-solid fa-temperature-high' },
    { label: 'Cold Wave', icon: 'fa-solid fa-temperature-low' },
    { label: 'Earthquake', icon: 'fa-solid fa-earthquake' },
    { label: 'Wind', icon: 'fa-solid fa-wind' },
    { label: 'Visibility', icon: 'fa-solid fa-eye' },
  ];

  getIcon(category: string): string {
    const found = this.hazardIcon.find((h) => h.label === category);
    return found ? found.icon : '';
  }

  onchangeSeverityType = async () => {
    this.fetchDeviationReport(this.selectedHazard, this.selectedSeverity);
    this.safeDetectChanges();
  };

  onchangeHazardsType = async () => {
    if (!this.selectedHazard) return;
    this.fetchSeverityTypes();
    this.fetchDeviationReport(this.selectedHazard, this.selectedSeverity);
    const payload = {
      type: 'update',
      id: this.logId,
      data: {
        hazard_type_selected: `${this.selectedHazard}`,
      },
    };
    this.updateWeatherLogTable(payload);
    this.safeDetectChanges();
  };

  fetchHazardTypes = () => {
    const circle = this.getUserCircle(this.user);
    if (!circle) {
      this.categoriesKeys = [];
      this.deviationData = [];
      this.severityTypes = [];
      this.safeDetectChanges();
      return;
    }

    const params = {
      circle,
    };
    this.dataService
      .postRequest('get-deviation-hazards-list', { params })
      .subscribe((res: any) => {
        const data = Array.isArray(res?.data) ? res.data : [];
        // collect only the categories that exist
        this.categoriesKeys = [];
        this.categoriesKeys = data;

        //  set first tab active only once
        if (this.categoriesKeys.length > 0) {
          this.activeTab = this.categoriesKeys[0];
          this.selectedHazard = this.categoriesKeys[0] = this.categoriesKeys[0];
          this.deviationData = [];
          this.severityTypes = [];
          this.onchangeHazardsType();
        } else {
          this.deviationData = [];
          this.severityTypes = [];
          this.safeDetectChanges();
        }
      });
  };

  fetchSeverityTypes = () => {
    const circle = this.getUserCircle(this.user);
    if (!circle) {
      this.severityTypes = [];
      return;
    }
    const params = {
      hazardType: this.selectedHazard,
      circle,
    };

    this.dataService
      .postRequest('get-deviation-severity-list', { params })
      .subscribe((res: any) => {
        const data = Array.isArray(res?.data) ? res.data : [];
        this.severityTypes = [];
        this.severityTypes.push('All');
        data.forEach((type: any) => {
          if (type.severity !== '') {
            this.severityTypes.push(type.severity);
          }
        });
      });
  };

  fetchDeviationReport(
    hazardType: string = this.selectedHazard,
    severityType: string = this.selectedSeverity,
  ) {
    const params = {
      circle: this.circle,
      hazardType: hazardType,
      severityType: severityType,
    };
    this.dataService.postRequest('get-today-deviation', { params }).subscribe(
      (res: any) => {
        if (res?.status === 'success' && res.data) {
          this.deviationData = res.data;
        } else {
          this.deviationData = null;
        }
        this.safeDetectChanges();
      },
      (error) => {
        console.error('Error fetching deviation report:', error);
        this.deviationData = null;
        this.safeDetectChanges();
      },
    );
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    const newTab = tab;
    this.selectedHazard = newTab;
    // this.callTabFunction(newTab);
    this.onchangeHazardsType();
  }

  exportDeviationData() {
    if (!this.deviationData) return;

    const dataToExport = this.deviationData.map((deviation: any) => ({
      Circle: deviation.indus_circle,
      District: deviation.district,
      Severity: deviation.severity,
      Severity_Change: deviation.severity_change,
      Weather_Phenomena: deviation.hazard_value,
      Description: deviation.description,
      Effective: new Date(deviation.insert_at).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC', // remove if you want local time
      }),
      Validity_Msg: deviation.validity_msg,
    }));

    // Create empty worksheet
    const worksheet: XLSXStyle.WorkSheet = XLSX.utils.aoa_to_sheet([]);

    // Header row
    XLSX.utils.sheet_add_aoa(
      worksheet,
      [
        [
          `Deviation Report: ${new Date().toLocaleString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}`,
        ],
      ],
      { origin: 'A1' },
    );

    // Add table with column headers starting at A3
    XLSX.utils.sheet_add_json(worksheet, dataToExport, {
      origin: 'A2',
      skipHeader: false,
    });

    // Merge title row
    worksheet['!merges'] = [
      {
        s: { r: 0, c: 0 },
        e: { r: 0, c: 7 },
      },
    ];

    // Center Align Main Header
    worksheet['A1'].s = {
      alignment: {
        horizontal: 'center',
        vertical: 'center',
      },
      font: {
        bold: true,
        sz: 14,
      },
    };
    const headerCells = ['A2', 'B2', 'C2', 'D2', 'E2', 'F2', 'G2', 'H2'];

    headerCells.forEach((cell) => {
      if (worksheet[cell]) {
        worksheet[cell].s = {
          font: {
            bold: true,
          },
        };
      }
    });

    // Column widths
    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 15 },
    ];

    const workbook: XLSXStyle.WorkBook = {
      Sheets: { Deviation: worksheet },
      SheetNames: ['Deviation'],
    };

    XLSXStyle.writeFile(
      workbook,
      `${this.selectedHazard} Deviation Report.xlsx`,
    );
  }

  //#region district list section & it's Operation
  async fetchDistrictList(): Promise<void> {
    try {
      this.districtList = [];

      // IMPORTANT: clear selection immediately so placeholder shows during refresh
      this.SelectedDistrict = null as any;

      const currentCircle = this.circle || this.getUserCircle(this.user);
      if (!currentCircle) {
        this.allDistrictFeatures = [];
        this.districtList = [];
        this.SelectedDistrict = null as any;
        this.safeDetectChanges();
        return;
      }

      const payload = { circle: currentCircle };
      const res: any = await this.dataService
        .postRequest('get_district_list', payload)
        .toPromise();

      if (res?.status && Array.isArray(res.data)) {
        this.allDistrictFeatures = [];
        this.allDistrictFeatures = res.data;
        this.districtList = res.data.map((d: any) => ({
          name: d.district,
          checked: false,
        }));
      } else {
        this.districtList = [];
      }

      // Defensive: if something set SelectedDistrict to a stale value, clear it
      const exists = this.districtList.some(
        (d) => d.name === this.SelectedDistrict,
      );
      if (!exists) this.SelectedDistrict = null as any;
    } catch (error) {
      console.error('Error fetching district list:', error);
      this.districtList = [];
      this.SelectedDistrict = null as any;
    }
    this.safeDetectChanges();
  }

  openDistrictModal() {
    const modalEl = document.getElementById('districtReportModal');
    if (modalEl) {
      const modal = new (window as any).bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  toggleSelectAllDistrict() {
    this.districtList.forEach((d) => (d.checked = this.selectAllDistrict));
    this.countOfDistrict = this.districtList.filter((d) => d.checked).length;
  }

  // Close the Dropdown on focus change
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const isInsideA = target.closest('.autocomplete-wrapper');
    if (!isInsideA) {
      this.showSuggestions = false;
    }
  }

  //To search through keyboard event
  onKeyDown(event: KeyboardEvent) {
    if (!this.showSuggestions) return;

    const listLength = this.districtList.length;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex =
          this.activeIndex < listLength - 1 ? this.activeIndex + 1 : 0;
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex =
          this.activeIndex > 0 ? this.activeIndex - 1 : listLength - 1;
        break;

      case 'Enter':
        event.preventDefault();
        if (this.activeIndex >= 0) {
          const selected = this.districtList[this.activeIndex];
          this.selectDistrict(selected.name);
          this.searchDistrict.nativeElement.blur();
        }
        break;

      case 'Escape':
        this.showSuggestions = false;
        break;
    }
  }

  openDropdown() {
    this.showSuggestions = true;
    this.activeIndex = -1;
  }

  closeDropdown() {
    setTimeout(() => {
      this.showSuggestions = false;
    }, 150);
  }

  selectDistrict(name: string) {
    this.SelectedDistrict = name;
    this.districtSearch = name;
    this.showSuggestions = false;
    this.onDistrictChange(name); // existing logic
  }

  //Filter list on search
  get filteredDistrictList() {
    if (!this.districtSearch) {
      return this.districtList;
    }

    return this.districtList.filter((dist: any) =>
      dist.name.toLowerCase().includes(this.districtSearch.toLowerCase()),
    );
  }

  get filteredDistricts() {
    if (!this.SelectedDistrict) return this.districtList;
    return this.districtList.filter((d) =>
      d.name.toLowerCase().includes(this.selectAllDistrict),
    );
  }

  /* --------- Update district checkbox based on individual selections --------- */
  updateSelectAllDistrict() {
    this.selectAllDistrict = this.districtList.every((d) => d.checked);
    this.countOfDistrict = this.districtList.filter((d) => d.checked).length;
  }

  /* --------- send selected district names for email --------- */
  Send_Extreme_Affected_District_Report() {
    const selectedDistrictList = this.districtList
      .filter((d) => d.checked)
      .map((d) => d.name);
    if (!selectedDistrictList.length || !this.districtEmails.length) {
      return;
    }
    this.sendingDistrict = true;
    const payload = {
      username: this.user.username,
      name: this.user.name,
      indus_circle: this.circle,
      districts: selectedDistrictList,
      emails: this.districtEmails.split(','),
    };

    this.dataService
      .postRequest('send_district_weather_report', payload)
      .pipe(
        catchError((error) => {
          const message = error?.error?.message || 'Internal Server Error';
          this.sendingDistrict = false;
          this.cancelDistrictReport();
          this.snackBar.open(message, 'X', {
            duration: 2000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-error-snackbar'],
          });
          this.safeDetectChanges();
          return throwError(() => error);
        }),
      )
      .subscribe((response: any) => {
        if (response.status === 'success') {
          this.districtList = this.districtList.map((u) => ({
            ...u,
            checked: false,
          }));

          const modalEl = document.getElementById('districtReportModal');
          const modal = (window as any).bootstrap.Modal.getInstance(modalEl);
          modal?.hide();

          this.sendingDistrict = false;

          this.snackBar.open(
            'Reports have been successfully sent via email.',
            'X',
            {
              duration: 2000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
              panelClass: ['custom-success-snackbar'],
            },
          );
        }
      });
  }

  getSelectedDistrictNames() {
    const selected = this.districtList
      .filter((d) => d.checked)
      .map((d) => d.name);
    return selected.length
      ? selected.length === this.districtList.length
        ? 'All Districts'
        : selected.join(', ')
      : '';
  }

  cancelDistrictReport() {
    this.selectAllDistrict = false;
    this.districtEmails = '';
    this.districtList.forEach((d) => (d.checked = false));
  }

  prepareDistrictModalList() {
    this.districtList2 = this.districtList.map((d) => ({
      name: d,
      checked: false,
    }));
  }

  searchPlaces(query: string) {
    const location = this.allDistrictFeatures.find((d) => d.district === query);
    return location;
  }
  //this is for the district chnage//
  onDistrictChange(value: any) {
    if (!value) return;

    this.selectedDistrictName = value;
    this.WeatherService.setDistrictHighlight(this.selectedDistrictName);
    const Location = this.searchPlaces(this.selectedDistrictName);
    if (!Location?.location) {
      console.warn(
        'Selected district has no mapped location. Skipping weather update.',
      );
      return;
    }
    this.isLocationDropdown = true;
    this.selectedLocation = this.normalizeLocation(Location.location);
    this.dropdownLocation = Location.district || value;
    this.WeatherService.setSearchLoader(true);
    this.districtSearch = '';
    this.activeIndex = -1;

    this.loadWeather();
    this.safeDetectChanges();
  }
  //#endregion

  //#region WeatherAPI

  mapWeatherAPIToCurrentForecast(data: any, index: number): void {
    if (!data || !data.location) return;

    const locationObj = data.location;
    let name = locationObj.name || '';
    const regionName = locationObj.region || '';

    // Normalize location
    if (this.isLocationDropdown) {
      name = this.dropdownLocation;
    }
    const loc = `${name}${regionName ? ', ' + regionName : ''}`;

    if (this.selectedDay === 'TODAY') {
      const current = data.current;
      if (!current) return;

      //  Cache Date object + formatter once
      const dt = new Date();
      const date_time = dt.toLocaleString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const currentHour = String(dt.getHours()).padStart(2, '0') + ':00';
      let mappedData: any = this.getMapIMDHourlyRainfall(currentHour);

      this.current_forecast = {
        location: loc,
        current_time: date_time,
        temp: current.temp_c ?? null,
        wind_speed: current.wind_kph ?? null,
        pressure: current.pressure_mb ?? null,
        uv_index: current.uv ?? null,
        humidity: current.humidity ?? null,
        wind_dir: current.wind_dir ?? '',
        visibility: current.vis_km ?? null,
        heat_index: current.heatindex_c ?? null,
        condition: mappedData
          ? mappedData.condition_text
          : (current.condition?.text ?? ''),
        feels_like: current.feelslike_c ?? null,
        icon: mappedData ? mappedData.icon : (current.condition?.icon ?? ''),
      };
    } else {
      const forecastDay = data.forecast?.forecastday?.[index];
      if (!forecastDay) return;

      const dt = new Date();
      // const currentTime = String(dt.getHours()).padStart(2, '0') + ':00';

      const dateObj = new Date(forecastDay.date);
      const date = dateObj.toLocaleString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      //  Compute current hour once
      const now = new Date();
      let time_sec = this.serviceType === 'weatherapi' ? ':00' : ':00:00';
      const currentHour = String(now.getHours()).padStart(2, '0') + `:00`;
      this.currentHour24 = currentHour;

      //  Faster lookup (no split)
      const hourlyForecast = forecastDay.hour;
      const currentHourData = hourlyForecast?.find((h: any) =>
        h.time.endsWith(
          String(now.getHours()).padStart(2, '0') + `${time_sec}`,
        ),
      );
      if (!currentHourData) return;

      this.current_forecast = {
        location: loc,
        current_time: `${date}, ${currentHour}`,
        temp: currentHourData.temp_c ?? null,
        wind_speed: currentHourData.wind_kph ?? null,
        pressure: currentHourData.pressure_mb ?? null,
        uv_index: currentHourData.uv ?? null,
        humidity: currentHourData.humidity ?? null,
        wind_dir: currentHourData.wind_dir ?? '',
        visibility: currentHourData.vis_km ?? null,
        heat_index: currentHourData.heatindex_c ?? null,
        condition: currentHourData.condition?.text ?? '',
        feels_like: currentHourData.feelslike_c ?? null,
        icon: currentHourData.condition?.icon ?? '',
      };
    }

    //  One cheap change-detection trigger
    this.cdr.markForCheck();
  }

  mapWeatherAPIDayForecast(forecastday: any[]) {
    if (!Array.isArray(forecastday)) return [];

    return forecastday.map((day) => ({
      date: day.date,
      temp_min: parseFloat(day?.day?.mintemp_c),
      temp_max: parseFloat(day?.day?.maxtemp_c),
      condition_text: day?.day?.condition?.text ?? '',
      chance_of_rain: day?.day?.daily_chance_of_rain,
      humidity: day?.day?.avghumidity,
      icon: day?.day?.condition?.icon ?? '',
    }));
  }

  getWeatherAPIHourlyForecast(weatherData: any) {
    if (this.selectedDay === 'TODAY') {
      const today = new Date().toISOString().split('T')[0]; // e.g., '2025-08-05'
      const forecastDays = weatherData?.forecast?.forecastday || [];

      // Find today's forecast data
      const todayForecast = forecastDays.find((day: any) => day.date === today);

      if (!todayForecast) return [];

      return (todayForecast.hour ?? []).map((hourData: any) => {
        const mappedData: any = this.getMapIMDHourlyRainfall(
          hourData?.time?.split(' ')[1] ?? '',
        );
        return {
          time: hourData?.time?.split(' ')[1]?.substring(0, 5) ?? '', // full time string
          temp: hourData.temp_c, // temperature in °C
          chance_of_rain: mappedData ? '100' : hourData.chance_of_rain, // %
          rain_mm: mappedData
            ? mappedData.rain_value
            : ((hourData?.precip_mm ?? 0) * this.rainfactor).toFixed(2),
          icon: mappedData
            ? mappedData.icon
            : (hourData?.condition?.icon ?? ''),
          wind_kph: hourData.wind_kph, // km/h
        };
      });
    } else {
      const forecastDays = weatherData || [];
      return (forecastDays.hour ?? []).map((hourData: any) => {
        return {
          time: hourData?.time?.split(' ')[1],
          temp: hourData.temp_c,
          chance_of_rain: hourData.chance_of_rain,
          rain_mm: Number(
            ((hourData?.precip_mm ?? 0) * this.rainfactor).toFixed(2),
          ),
          icon: hourData?.condition?.icon ?? '',
          wind_kph: hourData.wind_kph,
        };
      });
    }
  }

  getMapIMDHourlyRainfall(hour: string): any {
    if (!this.hourlyRainfallIMD || this.hourlyRainfallIMD.length === 0) {
      return null;
    }
    if (!hour) return null;

    hour = hour.length === 5 ? hour : hour.slice(0, 5); // HH:MM or HH:MM:SS -> HH:MM
    const data = this.hourlyRainfallIMD.find((h: any) => h.hour === hour);
    return data || null;
  }

  //#endregion

  //#region Update Weather Data & it's sub-ops

  onSourceChange(source: string) {
    this.selectedSource = source;
    this.loadWeather();
  }

  async loadTodayWeatherdata(data: any) {
    const forecastDays = data?.forecast?.forecastday ?? [];
    if (!data?.location || forecastDays.length === 0) {
      return;
    }

    const apiRainfall = Number(forecastDays[0]?.day?.totalprecip_mm) || 0;
    const imdRainfall = await this.getRainfallFactore(this.selectedLocation);
    this.rainfactor = this.calculateRainFactor(imdRainfall, apiRainfall);

    const nextSevenDays = forecastDays;
    let index = 0;
    this.mapWeatherAPIToCurrentForecast(data, index);
    this.dayForecastList = this.mapWeatherAPIDayForecast(nextSevenDays);

    this.hourlyForecastList = this.getWeatherAPIHourlyForecast(data);
    setTimeout(() => {
      this.scrollToCurrentHour();
    }, 800);

    const currentHour =
      new Date().getHours().toString().padStart(2, '0') + ':00';
    const currentHourData = this.hourlyForecastList.find(
      (item) => item.time === currentHour,
    );

    let mappedData: any = this.getMapIMDHourlyRainfall(currentHour);

    if (mappedData && this.dayForecastList.length > 0) {
      this.dayForecastList[0].chance_of_rain = 100;
      this.dayForecastList[0].icon = mappedData.icon;
      this.dayForecastList[0].condition_text = mappedData.condition_text;
    }

    this.currentHourRainPercent = mappedData
      ? '100'
      : (currentHourData?.chance_of_rain ?? 0);

    this.currentHourRainMM = mappedData
      ? mappedData.rain_value
      : (currentHourData?.rain_mm ?? 0);
  }

  async loadNextDayWeatherData(index: number) {
    if (
      !this.dayForecastWeatherData ||
      this.dayForecastWeatherData.length === 0
    ) {
      return;
    }

    const nextSevenDays = this.dayForecastWeatherData.slice(index, index + 7);

    const apiRainfall = Number(nextSevenDays[0]?.day?.totalprecip_mm) || 0;
    const imdRainfall = await this.getRainfallFactore(this.selectedLocation);
    this.rainfactor = this.calculateRainFactor(imdRainfall, apiRainfall);

    this.mapWeatherAPIToCurrentForecast(this.apiResponseOfWeatherData, index);
    this.dayForecastList = this.mapWeatherAPIDayForecast(nextSevenDays);
    this.hourlyForecastList = this.getWeatherAPIHourlyForecast(
      nextSevenDays[0],
    );
    setTimeout(() => {
      this.scrollToCurrentHour();
    }, 800);

    const currentHour =
      new Date().getHours().toString().padStart(2, '0') + ':00';
    this.currentHour24 = currentHour;

    const currentHourData = this.hourlyForecastList.find(
      (item) => item.time === currentHour,
    );
    this.currentHourRainPercent = currentHourData?.chance_of_rain ?? 0;
    this.currentHourRainMM = currentHourData?.rain_mm ?? 0;
  }

  async getRainfallFactore(location: string): Promise<number> {
    const latLong = this.getLatLong(location);
    if (!latLong) {
      this.hourlyRainfallIMD = [];
      return 0;
    }

    const payload = {
      longitude: latLong.longitude,
      latitude: latLong.latitude,
      selectedDay: this.selectedDay?.toUpperCase(),
    };

    try {
      const response: any = await firstValueFrom(
        this.dataService.get_rainfall_factor(payload),
      );
      this.hourlyRainfallIMD = response?.hourly_district_rainfall ?? [];
      return Number(response?.day_district_rainfall?.[0]?.imd_rainfall) || 0;
    } catch (error) {
      console.warn(
        'Rainfall factor service failed. Continuing with API rainfall.',
        error,
      );
      this.hourlyRainfallIMD = [];
      return 0;
    }
  }

  calculateRainFactor(imd_rainfall_str: any, api_rainfall: any): number {
    const imd_rainfall = Number(imd_rainfall_str);
    const apiRainfall = Number(api_rainfall) || 0;

    if (!Number.isFinite(imd_rainfall) || imd_rainfall <= 0) {
      return 1;
    }

    if (apiRainfall === 0 && imd_rainfall === 0) {
      return 0;
    } else if (apiRainfall === 0 && imd_rainfall !== 0) {
      return imd_rainfall / 1;
    } else if (apiRainfall > imd_rainfall) {
      return 1;
    } else {
      return imd_rainfall / apiRainfall;
    }
  }

  loadWeather(): void {
    const location = this.normalizeLocation(this.selectedLocation);
    if (!location) {
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    //  Show loader immediately
    this.loading = true;
    const requestId = ++this.weatherRequestId;

    this.dataService.getWeatherForecast(location).subscribe({
      next: async (response: any) => {
        try {
          if (requestId !== this.weatherRequestId) return;

          this.apiResponseOfWeatherData = response;
          this.dayForecastWeatherData = response?.forecast?.forecastday ?? [];

          // Update weather data
          if (this.selectedDay === 'TODAY') {
            await this.loadTodayWeatherdata(response);
          } else {
            await this.loadNextDayWeatherData(1);
          }
        } catch (error) {
          console.error('Unable to map weather response', error);
        }

        if (requestId !== this.weatherRequestId) return;

        // this.activeAccordion = 'hourly';
        this.loading = false;

        // single CD trigger
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        if (requestId !== this.weatherRequestId) return;

        console.error('Error from weather_api', err);
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  getTodaydate() {
    const todayDate = new Date();
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const today = formatDate(todayDate);
    return today;
  }

  getTomorrowDate() {
    const todayDate = new Date();
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const tomorrowDate = new Date();
    tomorrowDate.setDate(todayDate.getDate() + 1);
    const tomorrow = formatDate(tomorrowDate);
    return tomorrow;
  }

  convertTo24Hour(time12h: string): string {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  formatTo12Hour(time24: string): string {
    let [hourStr, minuteStr] = time24.split(':');
    let hours = parseInt(hourStr, 10);
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 -> 12
    const formattedHour = hours.toString().padStart(2, '0');
    return `${formattedHour}:${minuteStr} ${ampm}`;
  }

  getUserCurrentLocation() {
    this.locationSevice
      .getSafeLocation()
      .then((pos: any) => {
        const nextLocation = this.normalizeLocation(pos);
        if (!nextLocation) return;

        this.selectedLocation = nextLocation;
        this.isLocationDropdown = false;
        this.WeatherService.setCircleForUser(nextLocation);
        this.loadWeather();
        this.loadWeatherSubject.next();
      })
      .catch((err) => {
        console.warn('Unable to get current location.', err);
      });
  }
  //#endregion

  //#region scroll ops
  checkScroll() {
    if (!this.scrollContainer) return;

    const el = this.scrollContainer.nativeElement;

    this.atScrollStart = el.scrollLeft <= 5;
    this.atScrollEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 5;
  }
  onHourlyAccordionOpen() {
    this.activeAccordion = 'hourly';

    setTimeout(() => {
      this.scrollToCurrentHour();
      this.checkScroll();
    }, 100);
  }

  // Inside dashboard.ts
  scrollToCurrentHour() {
    if (!this.hourlyForecastList?.length) return;

    const index = this.hourlyForecastList.findIndex(
      (h) => h.time === this.currentHour24,
    );
    if (index === -1) return;

    setTimeout(() => {
      const card = document.getElementById('hour-card-' + index);
      const container = this.scrollContainer?.nativeElement;

      if (card && container) {
        container.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
        setTimeout(() => this.checkScroll(), 100);
      }
    }, 300);
  }

  toggleAccordion(panel: string) {
    this.activeAccordion = this.activeAccordion === panel ? '' : panel;
    setTimeout(() => {
      this.scrollToCurrentHour();
    }, 3000);

    if (this.scrollContainer && panel !== 'hourly') {
      setTimeout(() => {
        this.scrollContainer.nativeElement.scrollLeft = 0;
        this.updateScrollButtons();
      }, 300);
    }
  }

  scrollLeft() {
    if (this.scrollContainer?.nativeElement) {
      this.scrollContainer.nativeElement.scrollLeft -= 150;
      this.updateScrollButtons();
    }
  }

  scrollRight() {
    if (this.scrollContainer?.nativeElement) {
      this.scrollContainer.nativeElement.scrollLeft += 150;
      this.updateScrollButtons();
    }
  }

  private updateScrollButtons() {
    const el = this.scrollContainer?.nativeElement;
    if (!el) return;

    this.atScrollStart = el.scrollLeft === 0;
    this.atScrollEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
  }

  scrollLeft7DayForeCast() {
    if (this.scrollContainer7DayForecast?.nativeElement) {
      this.scrollContainer7DayForecast.nativeElement.scrollLeft -= 150;
      this.scrollCards7DayForeCast();
    }
  }

  scrollRight7DayForeCast() {
    if (this.scrollContainer7DayForecast?.nativeElement) {
      this.scrollContainer7DayForecast.nativeElement.scrollLeft += 150;
      this.scrollCards7DayForeCast();
    }
  }

  private scrollCards7DayForeCast() {
    const el = this.scrollContainer7DayForecast?.nativeElement;
    if (!el) return;

    this.atScrollStart7DayForecast = el.scrollLeft === 0;
    this.atScrollEnd7DayForecast =
      el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
  }

  toggleForecast(panel: any) {
    this.showForecast = !this.showForecast;

    if (this.showForecast && panel == 'sevenDayForecast') {
      setTimeout(() => {
        this.scrollContainer7DayForecast.nativeElement.scrollLeft = 0;
        this.scrollCards7DayForeCast();
      }, 300);
    }
  }
  //#endregion

  //#region heat-map call

  callToggleTempIDW() {
    this.mapWeather.toggleTempIDW();
    let payload = {};
    if (this.selectedDay === 'TODAY') {
      payload = {
        type: 'update',
        id: this.logId,
        data: {
          today_temp_clicked: 'true',
        },
      };
    } else {
      payload = {
        type: 'update',
        id: this.logId,
        data: {
          tomorrow_temp_clicked: 'true',
        },
      };
    }
    this.updateWeatherLogTable(payload);
  }

  callToggleRainIDW() {
    this.mapWeather.toggleRainIDW();
    let payload = {};
    if (this.selectedDay === 'TODAY') {
      payload = {
        type: 'update',
        id: this.logId,
        data: {
          today_rain_clicked: 'true',
        },
      };
    } else {
      payload = {
        type: 'update',
        id: this.logId,
        data: {
          tomorrow_rain_clicked: 'true',
        },
      };
    }
    this.updateWeatherLogTable(payload);
  }

  callToggleWindIDW() {
    this.mapWeather.toggleWindIDW();
    let payload = {};
    if (this.selectedDay === 'TODAY') {
      payload = {
        type: 'update',
        id: this.logId,
        data: {
          today_wind_clicked: 'true',
        },
      };
    } else {
      payload = {
        type: 'update',
        id: this.logId,
        data: {
          tomorrow_wind_clicked: 'true',
        },
      };
    }
    this.updateWeatherLogTable(payload);
  }

  callToggleHumidityIDW() {
    this.mapWeather.toggleHumidiyIDW();
    let payload = {};
    if (this.selectedDay === 'TODAY') {
      payload = {
        type: 'update',
        id: this.logId,
        data: {
          today_humidity_clicked: 'true',
        },
      };
    } else {
      payload = {
        type: 'update',
        id: this.logId,
        data: {
          tomorrow_humidity_clicked: 'true',
        },
      };
    }
    this.updateWeatherLogTable(payload);
  }

  callToggleFogIDW() {
    this.mapWeather.toggleFogIDW();
    let payload = {};
    if (this.selectedDay === 'TODAY') {
      payload = {
        type: 'update',
        id: this.logId,
        data: {
          today_visibility_clicked: 'true',
        },
      };
    } else {
      payload = {
        type: 'update',
        id: this.logId,
        data: {
          tomorrow_visibility_clicked: 'true',
        },
      };
    }
    this.updateWeatherLogTable(payload);
  }
  //#endregion

  //#region warning_message
  fetchRecentEarthquake = () => {
    this.alertMessages = [];
    this.dataService.postRequest('get-earthquake', {}).subscribe((res: any) => {
      const data = res.data;

      data.forEach((alert: any) => {
        this.alertMessages.push(`${alert.warning_message}`);
      });

      this.safeDetectChanges();
      setTimeout(() => this.setMarqueeSpeed(), 0);
    });
  };

  private setMarqueeSpeed(): void {
    if (!this.ticker) return;

    const contentWidth = this.ticker.nativeElement.scrollWidth / 2;
    const duration = contentWidth / this.SPEED_PX_PER_SEC;

    this.ticker.nativeElement.style.setProperty(
      '--marquee-duration',
      `${duration}s`,
    );

    this.safeDetectChanges();
  }

  //#endregion
}
