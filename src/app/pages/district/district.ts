import { circle } from '@turf/turf';
import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  AfterViewInit,
  ChangeDetectorRef,
} from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import { fromLonLat } from 'ol/proj';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke, Circle } from 'ol/style';
import { CommonModule } from '@angular/common';
import { DateTime } from 'luxon';
import { DataService } from '../../data-service/data-service';
import { MapWeather } from '../../components/map-weather/map-weather';
import { FormsModule } from '@angular/forms';
import { WeatherService } from '../../services/weather';
import { firstValueFrom, Subject, catchError, throwError, map } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { DateTimeService } from '../../services/date-time';
import { CurrentLocationService } from '../../services/current-location-service';
import { MatSnackBar } from '@angular/material/snack-bar';

interface DistrictGroup {
  [circle: string]: string[];
}
interface districtfillcolor {
  district?: string;
  color?: string;
}

interface HazardItem {
  state: string;
  time: string;
  date: string;
  hazardType: string;
  district: string;
  city: string;
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
  @ViewChild('scrollContainer7DayForecast', { static: false })
  scrollContainer7DayForecast!: ElementRef;
  @ViewChild(MapWeather) mapWeather!: MapWeather;
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

  // loading: boolean = false;
  isLoading: boolean = false;

  allDistrictFeatures: any[] = [];
  districtList: any[] = [];
  highlightedDistrictName: string = '';

  /* --------- Extreme Affected District Report --------- */
  showDistrictModal = false;
  districtEmails = '';
  sendingDistrict = false;
  selectAllDistrict = false;

  // Hard-coded districts for now
  districtList2: any[] = [];

  isOpen = false;
  selectedHazard = 'All';
  selectedSeverity = 'All';
  selectedDistrict = '';
  selectedDistrictName: string = '';
  selectedLayer = '';
  SelectedDistrict: string | null = null;
  private searchSubject = new Subject<string>();
  currentHourRainPercent: any;
  currentHourRainMM: any;

  hourlyData: HourlyWeather[] = [];
  weatherData: DailyWeather[] = [];

  hazardTypes: any = [];
  severityTypes: any = [];
  hazardsArray: any = [];
  hazardsGeoJSON: any;

  apiResponseOfWeatherData: any[] = [];
  dayForecastWeatherData: any[] = []; //Store 7 days forecast data
  private loadWeatherSubject = new Subject<void>();

  // isToggledHazardsOnMap: boolean = false;

  // severityColor: any = {
  //   Extreme: '#e53935',
  //   Severity: '#ffaa00',
  //   Moderate: '#ffff00',
  // };
  showDropdown = false;
  loading: boolean = false;

  //For Detect Changes Faster
  safeDetectChanges() {
    this.cdr.markForCheck();
  }

  get logId(): string | null {
    return localStorage.getItem('logId');
  }

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

  condition_text: any[] = [];
  dayForecastList: any[] = [];
  hourlyForecastList: any[] = [];
  sources = [{ label: 'Weather API', value: 'weather_api', visibility: true }];

  alertMessages: string[] = [];
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
  selectedDay: string = 'TODAY';

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
  selectedLocation: string = '';
  groupedDistricts: DistrictGroup = {};
  districtsList: string[] = [];

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

  constructor(
    private dataService: DataService,
    private cdr: ChangeDetectorRef,
    private WeatherService: WeatherService,
    private http: HttpClient,
    private dateTimeService: DateTimeService,
    private locationSevice: CurrentLocationService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.WeatherService.districtFeatures$.subscribe((list) => {
      this.allDistrictFeatures = list;
    });

    this.WeatherService.clearSelectedLayer(); // for remove layer and unset active the kpi//
    let storedUser = localStorage.getItem('user');
    if (storedUser) {
      this.user = JSON.parse(storedUser);

      if (this.user.indus_circle && !this.user.circle) {
        this.circle = this.user.indus_circle;
      }

      if (this.user.location) {
        this.selectedLocation = this.user.location;
      }

      this.WeatherService.setDistrictCircle(this.user.location);
    }

    //  Load weather correctly using lat,lo corrcted for shwoing exect loction 3/11/2025//
    this.WeatherService.districtCircle$.subscribe((circleLocation: string) => {
      if (!circleLocation) return;

      //  Weather should load using circle coordinates
      this.selectedLocation = circleLocation;

      //  DO NOT override district selection here
      this.selectedDistrictName = this.selectedDistrictName;

      //  Trigger weather load
      this.loadWeather();
      this.loadWeatherSubject.next();
    });

    this.WeatherService.location$.subscribe((location: string) => {
      if (!location) {
        console.warn('location$ received empty value. Skipping loadWeather.');
        return;
      }

      if (this.selectedDay === 'TODAY') {
        this.selectedLocation = location;
        this.loadWeather();
        this.loadWeatherSubject.next();
      } else {
        this.selectedLocation = location;
        this.dataService
          .getWeatherForecast(this.selectedLocation)
          .subscribe({});
        this.loadWeatherSubject.next();
        this.safeDetectChanges();
      }
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
      if (circleArray.length === 0) {
        console.warn(
          'circleChangedIs$ received empty value. Skipping loadWeather.'
        );
        return;
      }
      this.circle = circleArray[0]?.label;

      this.selectedDistrictName = '';
      this.SelectedDistrict = null;

      this.current_forecast.location = circleArray[0]?.value;

      this.loadWeather();
      this.fetchDistrictList();
      this.loadWeatherSubject.next();
    });

    // this.fetchHazardTypes();
    // this.fetchSeverityTypes();
    // this.fetchHazardCurrentDay('All', 'All');
    this.fetchRecentEarthquake();

    // this the  select distric function//
    this.WeatherService.getGroupedDistrictsArray$.subscribe(
      (districts: DistrictGroup) => {
        if (!districts) return;

        this.groupedDistricts = districts;

        const userCircle = this.user.indus_circle;
        const upperNorthCircles = [
          'Upper North (PUN)',
          'Upper North (HP)',
          'Upper North (JK)',
          'Upper North (HAR)',
        ];

        let selectedKey: string;

        if (userCircle === 'All Circle') {
          selectedKey = 'M&G';
        } else if (upperNorthCircles.includes(userCircle)) {
          selectedKey = 'Upper North';
        } else {
          selectedKey = userCircle;
        }

        this.districtList = this.groupedDistricts[selectedKey] ?? [];
        this.prepareDistrictModalList();
      }
    );

    this.fetchDistrictList();
    this.safeDetectChanges();
  }

  async fetchDistrictList(): Promise<void> {
    try {
      const payload = { circle: this.circle };
      const res: any = await this.dataService
        .postRequest('get_district_list', payload)
        .toPromise();

      if (res?.status && Array.isArray(res.data)) {
        this.districtList = res.data.map((d: any) => ({
          name: d.district,
          checked: false,
        }));
      } else {
        this.districtList = [];
      }
    } catch (error) {
      console.error('Error fetching district list:', error);
      this.districtList = [];
    }
  }

  // button of the district affted area new ******************************//

  getUserCurrentLocation() {
    this.locationSevice
      .getSafeLocation()
      .then((pos: any) => {
        this.selectedLocation = pos;
        let storedUser = localStorage.getItem('user');
        if (storedUser) {
          this.user = JSON.parse(storedUser);

          if (this.user.circle === '') {
            this.user.circle = pos;
            localStorage.removeItem('user');
            localStorage.setItem('user', JSON.stringify(this.user));
          }
        }
        this.WeatherService.setCircleForUser(pos);
        this.loadWeather();
        this.loadWeatherSubject.next();
      })
      .catch((err) => {
        console.log(err.message);
      });
  }

  fToC(f: number): number {
    return Math.round(((f - 32) * 5) / 9);
  }

  degreesToDirection(deg: number): string {
    const dirs = [
      'N',
      'NNE',
      'NE',
      'ENE',
      'E',
      'ESE',
      'SE',
      'SSE',
      'S',
      'SSW',
      'SW',
      'WSW',
      'W',
      'WNW',
      'NW',
      'NNW',
    ];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  convertTo24Hour(time12h: string): string {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  getWeatherIconUrl(condition: string, time?: string): string {
    const dayTimeHours = [
      '06:00',
      '07:00',
      '08:00',
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
    ];
    const nightTimeHours = [
      '00:00',
      '01:00',
      '02:00',
      '03:00',
      '04:00',
      '05:00',
      '18:00',
      '19:00',
      '20:00',
      '21:00',
      '22:00',
      '23:00',
    ];

    const iconMatch = this.uniqueConditionsWithIcons.find(
      (entry: any) => entry.name === condition
    );

    if (!iconMatch) return ''; // fallback if not found

    if (time) {
      if (dayTimeHours.includes(time)) {
        return iconMatch.dayUrl;
      } else if (nightTimeHours.includes(time)) {
        return iconMatch.nightUrl;
      }
    }

    // Default to day icon if time is not provided or doesn't match
    return iconMatch.dayUrl;
  }

  onSourceChange(source: string) {
    this.selectedSource = source;
    this.loadWeather();
  }

  openDistrictModal() {
    const modalEl = document.getElementById('districtReportModal');
    if (modalEl) {
      const modal = new (window as any).bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  /* --------- Checked All District on "select all" --------- */
  toggleSelectAllDistrict() {
    this.districtList.forEach((d) => (d.checked = this.selectAllDistrict));
  }

  /* --------- Update district checkbox based on individual selections --------- */
  updateSelectAllDistrict() {
    this.selectAllDistrict = this.districtList.every((d) => d.checked);
  }
  /* --------- send selected district names for email --------- */
  Send_Extreme_Affected_District_Report() {
    // this.sendingMail = true;
    const selectedUsers = this.districtList
      .filter((d) => d.checked)
      .map((d) => d.name);

    // const emails = this.sendEmails.split(',');
    const payload = {
      data: selectedUsers,
      emails: this.districtEmails.split(','),
    };

    // this.DataService.postRequest('send_usage_report', payload)
    //   .pipe(
    //     catchError((error) => {
    //       const message = error?.error?.message || 'Internal Server Error';
    //       return throwError(() => error);
    //     })
    //   )
    //   .subscribe((response) => {
    //     if (response.status === 'success') {
    //       this.sendUserList = this.sendUserList.map((u) => ({
    //         ...u,
    //         checked: false,
    //       }));
    //       const modalEl = document.getElementById('usageReportModal');
    //       const modal = bootstrap.Modal.getInstance(modalEl!);
    //       modal.hide();
    //       this.sendingMail = false;
    //       this.snackBar.open(response.message, 'X', {
    //         duration: 2000,
    //         horizontalPosition: 'center',
    //         verticalPosition: 'bottom',
    //         panelClass: ['custom-success-snackbar'],
    //       });
    //       this.cancelSendingMail();
    //     }
    //   });
  }

  getSelectedDistrictNames() {
    const selected = this.districtList2
      .filter((d) => d.checked)
      .map((d) => d.name);
    return selected.length
      ? selected.length === this.districtList2.length
        ? 'All Districts'
        : selected.join(', ')
      : '';
  }

  cancelDistrictReport() {
    this.selectAllDistrict = false;
    this.districtEmails = '';
    this.districtList2.forEach((d) => (d.checked = false));
  }

  prepareDistrictModalList() {
    this.districtList2 = this.districtList.map((d) => ({
      name: d,
      checked: false,
    }));
  }
  //this is for the district chnage//
  onDistrictChange(value: string) {
    if (value.trim()) {
      this.selectedDistrictName = value.trim();

      // Highlight on map
      this.WeatherService.setDistrictHighlight(this.selectedDistrictName);
      //  Update Dashboard Weather Card
      this.WeatherService.setLocation(this.selectedDistrictName);
      //  show loader
      this.WeatherService.setSearchLoader(true);

      this.SelectedDistrict = null;
      this.safeDetectChanges();
    }
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
  //#region WeatherAPI
  mapWeatherAPIToCurrentForecast(data: any, index: number): void {
    if (this.selectedDay === 'TODAY') {
      let date_time = new Date(data.location.localtime).toLocaleString(
        'en-IN',
        {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }
      );

      let name = data.location['name'];
      let regionName = data.location['region'];

      if (name === 'Bombay') {
        name = 'Mumbai';
      }
      let loc = name + ', ' + regionName;

      loc = `${name || ''}, ${regionName || ''}`.trim();
      this.current_forecast = {
        location: loc,
        current_time: date_time,
        temp: data.current.temp_c || null,
        wind_speed: data.current.wind_kph || null,
        pressure: data.current.pressure_mb || null,
        uv_index: data.current.uv || null,
        humidity: data.current.humidity || null,
        wind_dir: data.current.wind_dir || '',
        visibility: data.current.vis_km || null,
        heat_index: data.current.heatindex_c || null,
        condition: data.current.condition.text || '',
        feels_like: data.current.feelslike_c || null,
        icon: data.current.condition.icon || '',
      };
    } else {
      let date = new Date(data.forecast.forecastday[index].date).toLocaleString(
        'en-IN',
        {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }
      );

      let name = data.location['name'];
      let regionName = data.location['region'];

      if (name === 'Bombay') {
        name = 'Mumbai';
      }
      let loc = name + ', ' + regionName;

      const currentHour =
        new Date().getHours().toString().padStart(2, '0') + ':00';
      this.currentHour24 = currentHour;

      const hourlyForecast = data.forecast.forecastday[index].hour;
      const currentHourData = hourlyForecast.find(
        (item: any) => item.time.split(' ')[1] === currentHour
      );
      // const time = this.formatTo12Hour(currentHour);
      const time = currentHour;

      this.current_forecast = {
        location: loc,
        current_time: `${date}, ${time}`,
        temp: currentHourData.temp_c || null,
        wind_speed: currentHourData.wind_kph || null,
        pressure: currentHourData.pressure_mb || null,
        uv_index: currentHourData.uv || null,
        humidity: currentHourData.humidity || null,
        wind_dir: currentHourData.wind_dir || '',
        visibility: currentHourData.vis_km || null,
        heat_index: currentHourData.heatindex_c || null,
        condition: currentHourData.condition.text || '',
        feels_like: currentHourData.feelslike_c || null,
        icon: currentHourData.condition.icon || '',
      };
    }
  }
  mapWeatherAPIDayForecast(forecastday: any[]) {
    return forecastday.map((day) => ({
      date: day.date,
      temp_min: parseFloat(day.day.mintemp_c),
      temp_max: parseFloat(day.day.maxtemp_c),
      condition_text: day.day.condition?.text ?? '',
      chance_of_rain: day.day.daily_chance_of_rain,
      humidity: day.day.avghumidity,
      icon: day.day.condition.icon,
    }));
  }
  getWeatherAPIHourlyForecast(weatherData: any) {
    if (this.selectedDay === 'TODAY') {
      const today = new Date().toISOString().split('T')[0]; // e.g., '2025-08-05'
      const forecastDays = weatherData.forecast?.forecastday || [];

      // Find today's forecast data
      const todayForecast = forecastDays.find((day: any) => day.date === today);

      if (!todayForecast) return [];

      return todayForecast.hour.map((hourData: any) => ({
        time: hourData.time.split(' ')[1].substring(0, 5), // full time string
        temp: hourData.temp_c, // temperature in °C
        chance_of_rain: hourData.chance_of_rain, // %
        rain_mm: hourData.precip_mm, // mm
        wind_kph: hourData.wind_kph, // km/h
        icon: hourData.condition.icon, //icon url
      }));
    } else {
      const forecastDays = weatherData || [];
      return forecastDays.hour.map((hourData: any) => ({
        time: hourData.time.split(' ')[1], // full time string
        temp: hourData.temp_c, // temperature in °C
        chance_of_rain: hourData.chance_of_rain, // %
        rain_mm: hourData.precip_mm, // mm
        wind_kph: hourData.wind_kph, // km/h
        icon: hourData.condition.icon, //icon url
      }));
    }
  }
  //#endregion

  // #region Cross Visual
  mapCrossVisualToCurrentForecast(data: any) {
    let datetimeEpoch = data.currentConditions['datetimeEpoch'];
    let zone = data.timezone;
    const localDateTime = DateTime.fromSeconds(datetimeEpoch, { zone });
    // Format to something like "2025-09-02 09:00"
    let localTime = localDateTime.toFormat('yyyy-MM-dd HH:mm');
    let date_time = new Date(localTime).toLocaleString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    let regionName = '';
    const reginUPArray = ['Uttar Pradesh', 'UP'];
    const rgionMPArray = ['Madhya Pradesh', 'MP'];
    if (reginUPArray.includes(data.resolvedLocation.split(',')[1])) {
      regionName = 'UP East';
    } else if (rgionMPArray.includes(data.resolvedLocation.split(',')[1])) {
      regionName = 'Madhya Pradesh';
    }
    let exact_loc = data.resolvedLocation.split(',')[0] + ', ' + regionName;
    this.current_forecast = {
      location: exact_loc,
      current_time: date_time,
      temp: data.currentConditions.temp || null,
      wind_speed: data.currentConditions.windspeed || null,
      pressure: data.currentConditions.pressure || null,
      uv_index: data.currentConditions.uvindex || null,
      humidity: data.currentConditions.humidity || null,
      wind_dir: data.currentConditions.winddir
        ? this.degreesToDirection(data.currentConditions.winddir)
        : '',
      visibility: data.currentConditions.visibility || null,
      heat_index: data.currentConditions.feelslike || null,
      condition: data.currentConditions.conditions || '',
      feels_like: data.currentConditions.feelslike || null,
      icon: this.getWeatherIconUrl(data.currentConditions.conditions),
    };
  }
  mapCrossVisualDayForecast(days: any[]) {
    return days.map((day: any) => {
      return {
        date: day.datetime,
        temp_min: parseFloat(day.tempmin),
        temp_max: parseFloat(day.tempmax),
        condition_text: day.conditions || '',
        chance_of_rain: day.precipprob || 0,
        humidity: day.humidity || 0,
        icon: day.conditions ? this.getWeatherIconUrl(day.conditions) : '',
      };
    });
  }

  getCrossVisualHourlyForecast(visualCrossData: any) {
    const today = new Date().toISOString().split('T')[0]; // e.g., '2025-08-05'
    const forecastDays = visualCrossData.days || [];

    // Find today's forecast data
    const todayForecast = forecastDays.find(
      (day: any) => day.datetime === today
    );

    if (!todayForecast) return [];

    return todayForecast.hours.map((hourData: any) => ({
      time: hourData.time.split(' ')[1].substring(0, 5), // Only "HH:mm"
      temp: hourData.temp,
      chance_of_rain: hourData.precipprob || 0,
      precip_mm: hourData.precip || 0,
      wind: hourData.windspeed || 0, // km/h
      icon: hourData.conditions
        ? this.getWeatherIconUrl(
            hourData.conditions,
            hourData.datetime.substring(0, 5)
          )
        : '',
    }));
  }

  loadTodayWeatherdata(data: any) {
    if (!data || data.length === 0) {
      return;
    }
    const nextSevenDays = data.forecast.forecastday.slice(0, 7);
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
      (item) => item.time === currentHour
    );
    this.currentHourRainPercent = currentHourData.chance_of_rain;
    this.currentHourRainMM = currentHourData.rain_mm;
  }

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
      (h) => h.time === this.currentHour24
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

  loadNextDayWeatherData(index: number) {
    if (
      !this.dayForecastWeatherData ||
      this.dayForecastWeatherData.length === 0
    ) {
      return;
    }
    const nextSevenDays = this.dayForecastWeatherData.slice(index, index + 7);
    this.mapWeatherAPIToCurrentForecast(this.apiResponseOfWeatherData, index);
    this.dayForecastList = this.mapWeatherAPIDayForecast(nextSevenDays);
    this.hourlyForecastList = this.getWeatherAPIHourlyForecast(
      nextSevenDays[0]
    );
    setTimeout(() => {
      this.scrollToCurrentHour();
    }, 800);

    const currentHour =
      new Date().getHours().toString().padStart(2, '0') + ':00';
    this.currentHour24 = currentHour;

    const currentHourData = this.hourlyForecastList.find(
      (item) => item.time === currentHour
    );
    this.currentHourRainPercent = currentHourData.chance_of_rain;
    this.currentHourRainMM = currentHourData.rain_mm;
  }

  loadWeather(): void {
    let location: any;

    // Save the resolved location
    location = this.selectedLocation;

    // this.isLoading = true; // Start loader on whole page
    this.loading = true;   // Start loader 
    if (this.selectedSource === 'weather_api') {
      this.dataService.getWeatherForecast(location).subscribe({
        next: (response: any) => {
          this.apiResponseOfWeatherData = response;
          this.dayForecastWeatherData = response.forecast.forecastday;

          // According To Day , update weather data
          if (this.selectedDay === 'TODAY') {
            this.loadTodayWeatherdata(response);
          } else {
            this.loadNextDayWeatherData(1);
          }

          this.activeAccordion = 'hourly';
          // this.isLoading = false; // Stop loader
          this.loading = false;
          this.safeDetectChanges();
        },
        error: (err: any) => {
          console.error('Error from weather_api', err);
          // this.isLoading = false;
          this.loading = false;
          this.safeDetectChanges();
        },
      });
    } else if (this.selectedSource === 'cross_visual') {
      this.dataService.getCrossVisualForecast(location).subscribe({
        next: (response: any) => {
          this.mapCrossVisualToCurrentForecast(response);
          this.dayForecastList = this.mapCrossVisualDayForecast(response.days);
          this.hourlyForecastList = this.getCrossVisualHourlyForecast(response);
          this.scrollToCurrentHour();
          // this.isLoading = false; // Stop loader
          this.loading = false;
          this.activeAccordion = 'hourly';
          this.safeDetectChanges();
        },
        error: (err: any) => {
          console.error('Error from cross_visual', err);
          // this.isLoading = false;  
          this.loading = false;
          this.safeDetectChanges();
        },
      });
    }

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

  updateWeatherLogTable(payload: Object) {
    this.dataService.sendWeatherUserLog(payload).subscribe((res) => {
      if (res?.status === 'success') {
        console.log('Weather user activity logged.');
      }
    });
  }

  fetchRecentEarthquake = () => {
    this.alertMessages = [];
    this.dataService.postRequest('get-earthquake', {}).subscribe((res: any) => {
      const data = res.data;
      data.forEach((alert: any) => {
        this.alertMessages.push(`${alert.title} - ${alert.time}`);
      });
    });
  };
}
