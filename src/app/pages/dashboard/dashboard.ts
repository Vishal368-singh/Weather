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
import { fromLonLat, get } from 'ol/proj';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke, Icon } from 'ol/style';
import { CommonModule } from '@angular/common';
import { DataService } from '../../data-service/data-service';
import { MapWeather } from '../../components/map-weather/map-weather';
import { FormsModule } from '@angular/forms';
import { WeatherService } from '../../services/weather';
import { firstValueFrom, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { DateTimeService } from '../../services/date-time';
import { CurrentLocationService } from '../../services/current-location-service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Circle, Point } from 'ol/geom';
import { Feature } from 'ol';
import { District } from '../district/district';
import * as XLSX from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';
import { environment } from '../../../environments/environment';
declare const ol: any;

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
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MapWeather, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, AfterViewInit {
  @ViewChild('scrollContainer', { static: false }) scrollContainer!: ElementRef;
  @ViewChild('scrollContainer7DayForecast', { static: false })
  scrollContainer7DayForecast!: ElementRef;
  @ViewChild(MapWeather) mapWeather!: MapWeather;

  currentHour24 = new Date().getHours().toString().padStart(2, '0') + ':00';

  serviceType: string | null = 'visualcrossapi';

  rainfactor: number = 1;
  selectedPage = 'dashboard';
  showForecast = false;
  atScrollStart: boolean = true;
  atScrollEnd: boolean = false;
  atScrollStart7DayForecast: boolean = true;
  atScrollEnd7DayForecast: boolean = false;
  hourlyRainfallIMD: any = [];
  current: any = null;
  location: any = null;
  isDashboardLocationSelected: boolean = true;
  dropdownLocation: string = '';
  activeAccordion: string = '';
  currentTime: string = '';
  lastUpdatedTime: string = '';
  loading: boolean = false;
  isSearchLoading: boolean = false;
  isOpen = false;
  selectedHazard = 'All';
  selectedSeverity = 'All';
  selectedDistrict = '';
  selectedLayer = '';

  currentHourRainPercent: any;
  currentHourRainMM: any;

  hourlyData: HourlyWeather[] = [];
  weatherData: DailyWeather[] = [];

  hazardTypes: any = [];
  severityTypes: any = [];
  hazardsArray: any = [];
  hazardsGeoJSON: any;
  timezone = environment.timeZone;

  initialCenter = fromLonLat([80.8320187, 22.4463565]);
  initialZoom = 4;

  apiResponseOfWeatherData: any[] = [];
  dayForecastWeatherData: any[] = []; //Store 7 days forecast data

  isToggledHazardsOnMap: boolean = false;

  severityColor: any = {
    Extreme: '#e53935',
    Severity: '#ffaa00',
    Moderate: '#ffff00',
  };

  searchTerm: string = '';
  searchResults: any[] = [];
  showDropdown = false;
  private searchSubject = new Subject<string>();

  //For Detect Changes Faster
  safeDetectChanges() {
    this.cdr.markForCheck();
  }

  get logId(): string | null {
    return localStorage.getItem('logId');
  }

  isLoading: boolean = false;

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

  alertMessages: string[] = [];

  @ViewChild('ticker') ticker!: ElementRef<HTMLDivElement>;

  private SPEED_PX_PER_SEC = 130; // constant speed

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
  ];

  hazardMapIcon = [
    { label: 'Flood', icon: 'assets/icons/flood.svg' },
    { label: 'Thunderstorm', icon: 'assets/icons/thunderstorm.svg' },
    { label: 'Rainfall', icon: 'assets/icons/rainfall.svg' },
    { label: 'Lightning', icon: 'assets/icons/lightning.svg' },
    { label: 'Landslide', icon: 'assets/icons/landslide.svg' },
    { label: 'Avalanche', icon: 'assets/icons/landslide.svg' },
    { label: 'Fog', icon: 'assets/icons/fog.svg' },
    { label: 'Snowfall', icon: 'assets/icons/snowfall.svg' },
    { label: 'Heat Wave', icon: 'assets/icons/heat-wave.svg' },
    { label: 'Cold Wave', icon: 'assets/icons/cold-wave.svg' },
    { label: 'Earthquake', icon: 'assets/icons/earthquake.svg' },
  ];

  selectedhazardsGeoJSON: any = {};
  todaysDate: string = '';
  selectedDay: string = 'TODAY';

  activeTab: string = ''; // default tab
  categoriesKeys: any = [];

  hazardMap!: Map;
  showHazardModal = false;
  user: any = {};
  selectedLocation: string = '';
  private weatherRequestId = 0;

  constructor(
    private dataService: DataService,
    private cdr: ChangeDetectorRef,
    private WeatherService: WeatherService,
    private http: HttpClient,
    private dateTimeService: DateTimeService,
    private locationSevice: CurrentLocationService,
    private snackBar: MatSnackBar,
  ) {
    this.searchSubject
      .pipe(
        debounceTime(1000),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term || term.trim() === '') {
            return [];
          }
          return this.searchPlaces(term);
        }),
      )
      .subscribe((results) => {
        if (results.length > 0) {
          this.showMarkers(results); // Will show empty or filtered markers
        } else {
          this.WeatherService.setSearchLoader(false);
          // this.isLoading = false;
          this.safeDetectChanges();
          this.snackBar.open('Please enter correct name.', 'X', {
            duration: 2000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-error-snackbar'],
          });
        }
        this.isSearchLoading = false;
      });
  }

  ngOnInit(): void {
    this.loadUserLocationFromSession();
    this.loadWeather();

    this.WeatherService.setDashboardCircleLocation(this.selectedLocation);

    this.WeatherService.clearSelectedLayer();
    this.WeatherService.setDistrictHighlight('');

    this.WeatherService.weatherDataCache$.subscribe((responseData: any) => {
      if (responseData.length == 0) return;
      this.isDashboardLocationSelected = false;
      var response: any = responseData;
      if (this.selectedDay === 'TODAY') {
        this.loadTodayWeatherdata(response);
      } else {
        this.loadNextDayWeatherData(1);
      }
      this.safeDetectChanges();
    });

    this.WeatherService.selectedLayer$.subscribe((layer) => {
      this.selectedLayer = layer;
      this.safeDetectChanges();
    });

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
        return;
      }
      const mappedLocation = this.normalizeLocation(changedCircle?.value);
      if (!mappedLocation) {
        console.warn('circleChangedIs$ received invalid location. Skipping.');
        return;
      }

      this.user.circle = changedCircle?.label || this.user.circle || '';
      this.user.indus_circle = this.user.indus_circle || this.user.circle;
      this.dropdownLocation = changedCircle?.location_name || '';
      this.isDashboardLocationSelected = true;
      this.selectedLocation = mappedLocation;
      this.persistDashboardLocation();
      this.WeatherService.setDashboardCircleLocation(this.selectedLocation);
      this.loadWeather();
      this.fetchHazardTypes();
    });

    this.fetchHazardTypes();
    this.fetchRecentEarthquake();
  }

  async ngAfterViewInit(): Promise<void> {}

  selectLayer(layer: string) {
    this.WeatherService.setSelectedLayer(layer);
  }

  private loadUserLocationFromSession(): void {
    const storedUser = localStorage.getItem('user');
    this.serviceType = localStorage.getItem('service_type');

    if (!storedUser) return;

    try {
      this.user = JSON.parse(storedUser) || {};
    } catch (error) {
      console.warn(
        'Unable to parse stored user. Dashboard will skip session location.',
        error,
      );
      this.user = {};
      return;
    }

    this.user.circle = this.getUserCircle(this.user);
    const sessionLocation = this.normalizeLocation(this.user.location);
    if (sessionLocation) {
      this.selectedLocation = sessionLocation;
      this.dropdownLocation = this.user.location_name || this.user.circle || '';
      this.isDashboardLocationSelected = true;
    }
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

  private persistDashboardLocation(): void {
    const storedUser = localStorage.getItem('user');
    if (!storedUser || !this.user) return;

    const updatedUser = {
      ...this.user,
      Change_circle: this.getUserCircle(this.user),
      Change_location: this.selectedLocation,
      Change_location_name: this.dropdownLocation,
    };

    localStorage.setItem('user', JSON.stringify(updatedUser));
    this.user = updatedUser;
  }

  getUserCurrentLocation() {
    this.locationSevice
      .getSafeLocation()
      .then((pos: any) => {
        const nextLocation = this.normalizeLocation(pos);
        if (!nextLocation) return;

        this.selectedLocation = nextLocation;
        this.isDashboardLocationSelected = false;
        this.WeatherService.setCircleForUser(nextLocation);
        this.loadWeather();
      })
      .catch((err) => {
        console.warn('Unable to get current location.', err);
      });
  }

  updateWeatherLogTable(payload: Object) {
    this.dataService.sendWeatherUserLog(payload).subscribe((res) => {
      if (res?.status === 'success') {
        // Log updated successfully
      }
    });
  }

  //#region Search Location
  onSearchChange() {
    if (this.searchTerm.trim()) {
      this.selectedLocation = this.searchTerm;
      this.WeatherService.setSearchLoader(true);
      this.isSearchLoading = true;
      this.searchSubject.next(this.searchTerm.trim() + ', India');
    }
  }

  searchPlaces(query: string) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query,
    )}&format=json&limit=10`;
    return this.http.get<any[]>(url);
  }

  showMarkers(locations: any[]): void {
    if (locations.length > 0) {
      const lon = parseFloat(locations[0].lon);
      const lat = parseFloat(locations[0].lat);
      const d_name = locations[0].display_name;
      let location = `${lat},${lon},${d_name}`;
      this.selectedLocation = `${lat},${lon}`;
      this.WeatherService.setCircleLocationChange(this.selectedLocation);
      this.isDashboardLocationSelected = false;
      this.loadWeather();

      this.WeatherService.setSearchLocation(location);
      this.searchTerm = '';
    }
  }
  //#endregion

  //#region WeatherAPI

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
    const currentHourData = this.hourlyForecastList.find(
      (item) => item.time === currentHour,
    );
    this.currentHourRainPercent = currentHourData?.chance_of_rain ?? 0;
    this.currentHourRainMM = currentHourData?.rain_mm ?? 0;
  }

  mapWeatherAPIToCurrentForecast(data: any, index: number): void {
    if (!data || !data.location) return;

    const locationObj = data.location;
    let name = locationObj.name || '';
    const regionName = locationObj.region || '';

    // Normalize location

    if (this.isDashboardLocationSelected) {
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
      const currentTime = String(dt.getHours()).padStart(2, '0') + ':00';

      const dateObj = new Date(forecastDay.date);
      const date = dateObj.toLocaleString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      // Compute current hour once
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

  mapWeatherAPIDayForecast(forecastday: any) {
    if (!Array.isArray(forecastday)) return [];

    return forecastday.map((day: any) => ({
      date: day.date,
      temp_min: day?.day?.mintemp_c,
      temp_max: day?.day?.maxtemp_c,
      condition_text: day?.day?.condition?.text ?? '',
      chance_of_rain: day?.day?.daily_chance_of_rain,
      humidity: day?.day?.avghumidity,
      icon: day?.day?.condition?.icon,
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
          hourData.time.split(' ')[1],
        );
        return {
          time: hourData.time.split(' ')[1].substring(0, 5), // full time string
          temp: hourData.temp_c, // temperature in °C
          chance_of_rain: mappedData ? '100' : hourData.chance_of_rain, // %
          rain_mm: mappedData
            ? mappedData.rain_value
            : Number((hourData.precip_mm * this.rainfactor).toFixed(2)),
          icon: (mappedData ? mappedData.icon : hourData.condition?.icon) || '',
          wind_kph: hourData.wind_kph, // km/h
        };
      });
    } else {
      const forecastDays = weatherData || [];

      return (forecastDays.hour ?? []).map((hourData: any) => ({
        time: hourData?.time?.split(' ')[1], // full time string
        temp: hourData?.temp_c, // temperature in °C
        chance_of_rain: hourData?.chance_of_rain, // %
        rain_mm: Number((hourData?.precip_mm * this.rainfactor).toFixed(2)), // mm
        wind_kph: hourData?.wind_kph, // km/h
        icon: hourData?.condition?.icon, //icon url
      }));
    }
  }

  getMapIMDHourlyRainfall(hour: string): any {
    if (!this.hourlyRainfallIMD || this.hourlyRainfallIMD.length === 0) {
      return null;
    }

    hour = hour.length === 5 ? hour : hour.slice(0, 5); // HH:MM or HH:MM:SS -> HH:MM

    const data = this.hourlyRainfallIMD.find((h: any) => h.hour === hour);
    return data || null;
  }

  //#endregion

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

  //#region Load Weather & their sub functions
  loadWeather(): void {
    const location = this.normalizeLocation(this.selectedLocation);
    if (!location) {
      this.loading = false;
      this.safeDetectChanges();
      return;
    }

    this.loading = true;
    const requestId = ++this.weatherRequestId;
    this.dataService.getWeatherForecast(location).subscribe({
      next: async (response: any) => {
        try {
          if (requestId !== this.weatherRequestId) return;

          this.apiResponseOfWeatherData = response;
          this.dayForecastWeatherData = response?.forecast?.forecastday ?? [];

          // According To Day , update weather data
          if (this.selectedDay === 'TODAY') {
            await this.loadTodayWeatherdata(response);
          } else {
            await this.loadNextDayWeatherData(1);
          }
        } catch (error) {
          console.error('Unable to map weather response', error);
        }

        if (requestId !== this.weatherRequestId) return;

        // this.isLoading = false; // Stop loader
        this.loading = false;
        this.activeAccordion = 'hourly';
        this.safeDetectChanges();
      },
      error: (err: any) => {
        if (requestId !== this.weatherRequestId) return;

        console.error('Error from weather_api', err);
        // this.isLoading = false;
        this.loading = false;
        this.safeDetectChanges();
      },
    });

    this.safeDetectChanges();
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

  formatTo12Hour(time24: string): string {
    let [hourStr, minuteStr] = time24.split(':');
    let hours = parseInt(hourStr, 10);
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 -> 12
    const formattedHour = hours.toString().padStart(2, '0');
    return `${formattedHour}:${minuteStr} ${ampm}`;
  }

  getIcon(category: string): string {
    const found = this.hazardIcon.find((h) => h.label === category);
    return found ? found.icon : '';
  }

  getHazardIcon(category: string): string {
    const found = this.hazardMapIcon.find((h) => h.label === category);
    return found ? found.icon : '';
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

  //#endregion

  //#region scroll operation
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

  //#region Switch Heat Map Button
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

  //#region WarningMessage

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
  //#endregion

  //#region Hazard / Bad Weather data and API calls
  get hasHazards(): boolean {
    return Array.isArray(this.hazardsArray) && this.hazardsArray.length > 0;
  }

  get hasCategories(): boolean {
    return Array.isArray(this.categoriesKeys) && this.categoriesKeys.length > 0;
  }

  get hasSeverities(): boolean {
    return Array.isArray(this.severityTypes) && this.severityTypes.length > 1; // Beacause 'All' is always present
  }

  hazardToggleOff = () => {
    const checkbox = document.getElementById('toggleBtn') as HTMLInputElement;
    checkbox.checked = false;
    this.isToggledHazardsOnMap = false;
  };

  callHazardsAddOnMap() {
    if (!this.mapWeather?.map) {
      return;
    }

    if (this.isToggledHazardsOnMap) {
      const payload = {
        type: 'update',
        id: this.logId,
        data: {
          view_on_map_clicked: 'true',
        },
      };

      this.updateWeatherLogTable(payload);
      this.mapWeather.addHazardsGeoJSONLayerOnMap(this.hazardsGeoJSON);
      document.querySelector('.map-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    } else {
      this.mapWeather.map.getLayers().forEach((layer) => {
        if (layer.get('title') === 'Hazard Layer') {
          this.mapWeather.map.removeLayer(layer);
          if (layer.get('title') === 'Disaster Layer') {
            this.mapWeather.map.removeLayer(layer);
          }
        }
      });
    }
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    const newTab = tab === 'Rainfall' ? 'Rain' : tab;
    this.selectedHazard = newTab;
    this.callTabFunction(newTab);
  }

  callTabFunction(tab: string) {
    switch (tab) {
      case 'Rain':
        this.onchangeHazardsType();
        break;
      case 'Fog':
        this.onchangeHazardsType();
        break;
      case 'Thunderstorm':
        this.onchangeHazardsType();
        break;
      case 'Lightning':
        this.onchangeHazardsType();
        break;
      case 'Flood':
        this.onchangeHazardsType();
        break;
      case 'Landslide':
        this.onchangeHazardsType();
        break;
      case 'Avalanche':
        this.onchangeHazardsType();
        break;
      case 'Heat Wave':
        this.onchangeHazardsType();
        break;
      case 'Cold Wave':
        this.onchangeHazardsType();
        break;
      case 'Snowfall':
        this.onchangeHazardsType();
        break;
      case 'Earthquake':
        this.onchangeHazardsType();
        break;
      default:
        break;
    }
  }

  onchangeHazardsType = async () => {
    this.fetchSeverityTypes();
    await this.fetchHazardCurrentDay(
      this.selectedHazard,
      this.selectedSeverity,
    );
    this.callHazardsAddOnMap();
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

  onchangeSeverityType = async () => {
    await this.fetchHazardCurrentDay(
      this.selectedHazard,
      this.selectedSeverity,
    );
    this.callHazardsAddOnMap();
    const payload = {
      type: 'update',
      id: this.logId,
      data: {
        severity_selected: `${this.selectedSeverity}`,
      },
    };
    this.updateWeatherLogTable(payload);
    this.safeDetectChanges();
  };

  fetchHazardTypes = () => {
    const circle = this.getUserCircle(this.user);
    if (!circle) {
      this.categoriesKeys = [];
      this.hazardsArray = [];
      this.severityTypes = [];
      this.safeDetectChanges();
      return;
    }

    const params = {
      circle,
    };
    this.dataService
      .postRequest('get-nsystem-hazards-list', { params })
      .subscribe((res: any) => {
        const data = Array.isArray(res?.data) ? res.data : [];
        // collect only the categories that exist
        this.categoriesKeys = data;

        //  set first tab active only once
        if (this.categoriesKeys.length > 0) {
          this.activeTab = this.categoriesKeys[0];
          this.selectedHazard =
            this.categoriesKeys[0] === 'Rainfall'
              ? 'Rain'
              : this.categoriesKeys[0];
          this.onchangeHazardsType();
        } else {
          this.hazardsArray = [];
          this.severityTypes = [];
          this.mapWeather?.map?.getLayers().forEach((layer) => {
            if (layer.get('title') === 'Hazard Layer') {
              this.mapWeather.map.removeLayer(layer);
            }
          });
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
      .postRequest('get-nsystem-severity-list', { params })
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

  fetchHazardCurrentDay = async (
    hazardType: string,
    selectedSeverity: string,
  ) => {
    const circle = this.getUserCircle(this.user);
    if (!circle) {
      this.hazardsArray = [];
      this.hazardsGeoJSON = { type: 'FeatureCollection', features: [] };
      return;
    }

    const params = {
      hazardType: hazardType,
      severityType: selectedSeverity,
      circle,
    };
    try {
      const res: any = await firstValueFrom(
        this.dataService.postRequest('get-nsystem-today-disasters', { params }),
      );
      if (!res?.data) return;

      const data = res.data;
      this.hazardsArray = [];
      const featuresArray: any = [];
      this.hazardsGeoJSON = {
        type: 'FeatureCollection',
        features: data,
      };

      (data.features ?? []).forEach((hazard: any, i: number) => {
        try {
          const geometry =
            typeof hazard.geometry === 'string'
              ? JSON.parse(hazard.geometry)
              : hazard.geometry;

          const obj = {
            id: hazard.id,
            areaDesc: hazard.properties?.area_covered,
            certainty: hazard.properties?.certainty,
            description: hazard.properties?.warning_message,
            effective: hazard.properties?.effective_start_time,
            event: hazard.properties?.disaster_type,
            expires: hazard.properties?.effective_end_time,
            sender: hazard.properties?.alert_source,
            sent: hazard.properties?.alert_from,
            severity: hazard.properties?.severity,
            state: hazard.properties?.state_ut,
            indus_circle: hazard.properties?.indus_circle,
            severity_level: hazard.properties?.severity_level,
            district: hazard.properties?.district,
            geom: hazard.geometry,
          };

          this.hazardsArray.push(obj);
          featuresArray.push({
            type: 'Feature',
            geometry,
            properties: obj,
          });
        } catch (err) {
          console.error('ERROR at index', i, err);
        }
      });

      this.safeDetectChanges();
    } catch (error) {
      console.warn('Hazard service failed. Keeping dashboard active.', error);
      this.hazardsArray = [];
      this.hazardsGeoJSON = { type: 'FeatureCollection', features: [] };
      this.safeDetectChanges();
    }
  };

  viewSelectedHazardOnMap = async (id: any) => {
    this.selectedhazardsGeoJSON = await this.fetchSelectedHazardData(id);

    if (this.selectedhazardsGeoJSON.features.geometry === null) {
      this.snackBar.open('No geometry, so can not display on map.', 'X', {
        duration: 2000, // auto close after 3s
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['custom-info-snackbar'],
      });
      return;
    }
    this.showHazardModal = true;
    setTimeout(() => {
      this.initMap(this.selectedhazardsGeoJSON);
    }, 0);
  };

  getCssVar(varName: string): string {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
  }

  async initMap(hazardsGeoJSON: any): Promise<void> {
    const severity = hazardsGeoJSON.features.properties.severity;

    let fillColor;

    switch (severity) {
      case 'Extreme':
        fillColor = this.getCssVar('--extreme-color');
        break;
      case 'High':
        fillColor = this.getCssVar('--high-color');
        break;
      case 'Moderate':
        fillColor = this.getCssVar('--moderate-color');
        break;
      default:
        fillColor = this.getCssVar('--ndma-hazard-low');
    }

    // Base map layer
    const baseMap = new TileLayer({
      source: new ol.source.XYZ({
        url: 'http://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}',
        crossOrigin: 'anonymous',
      }),
      properties: {
        title: 'Base Map',
        fixed: true,
      },
    });

    const geo =
      hazardsGeoJSON?.type === 'FeatureCollection'
        ? {
            type: 'FeatureCollection',
            features: Array.isArray(hazardsGeoJSON.features)
              ? hazardsGeoJSON.features
              : [hazardsGeoJSON.features],
          }
        : hazardsGeoJSON;

    const hazardFeatures = new GeoJSON().readFeatures(geo, {
      dataProjection: 'EPSG:4326', // your coordinates are lon/lat
      featureProjection: 'EPSG:3857',
    });

    const hazardSource = new VectorSource({ features: hazardFeatures });

    // Hazard style (fill + stroke)
    const hazardStyle = new Style({
      fill: new Fill({
        color: `${fillColor}80`, // 55 hex ≈ 33% opacity
      }),
      stroke: new Stroke({
        color: '#10623bff',
        width: 2,
      }),
    });

    const hazardLayer = new VectorLayer({
      source: hazardSource,
      style: hazardStyle,
    });

    // Add centroid points for better visibility
    const centroidFeatures: Feature[] = [];
    const feature = hazardFeatures[0];

    if (feature) {
      const geometry = feature.getGeometry();

      if (geometry) {
        const extent = geometry.getExtent();

        const centroid = [
          (extent[0] + extent[2]) / 2,
          (extent[1] + extent[3]) / 2,
        ];

        const pointFeature = new Feature({
          geometry: new Point(centroid),
        });

        centroidFeatures.push(pointFeature);
      }
    }

    const centroidSource = new VectorSource({
      features: centroidFeatures,
    });

    // ---------------------------
    // Mobile handling
    // ---------------------------
    const isMobile = window.innerWidth < 768;

    // Same scale as main map
    let baseScale = isMobile ? 0.55 : 0.8;

    let currentScale = baseScale;

    // ---------------------------
    // Shared style
    // ---------------------------
    const centroidStyle = () => {
      return new Style({
        image: new Icon({
          src: this.getHazardIcon(this.activeTab),
          scale: currentScale,
          anchor: [0.5, 0.5],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
          rotateWithView: false,
          crossOrigin: 'anonymous',
          opacity: 0.95,
          color: '#10623bff',
        }),
      });
    };

    // ---------------------------
    // Centroid Layer
    // ---------------------------
    const centroidLayer = new VectorLayer({
      source: centroidSource,

      style: centroidStyle,

      zIndex: 10,
    });

    // Map creation
    const map = new Map({
      target: 'hazardMap',
      layers: [baseMap, hazardLayer, centroidLayer],
      view: new View({
        projection: 'EPSG:3857',
        center: this.initialCenter,
        zoom: this.initialZoom,
        minZoom: 4,
        maxZoom: 11,
      }),
    });

    // Pulse (scale animation)
    let t = 0;

    const animate = () => {
      t += 0.05;
      currentScale = Number((baseScale + Math.sin(t) * 0.03).toFixed(3));
      centroidLayer.changed();
      map.render();
      requestAnimationFrame(animate);
    };

    animate();
    // Auto-fit to hazard geometry
    if (hazardSource.getFeatures().length > 0) {
      map
        .getView()
        .fit(hazardSource.getExtent(), { padding: [50, 50, 50, 50] });
    }
  }

  hazardDataBindPopup(data: any) {
    let state = data.state !== null ? data.state : '';
    return `
    <h6>Hazards / Bad Weather</h6>
    <table style="border-collapse: collapse; width: 100%; font-family: Arial; font-size: 11px;">
      <tr>
          <th style="text-align: left; padding: 4px;border: 1px solid #ccc;">Type</th>
          <td style="padding: 4px;border: 1px solid #ccc;">${data.event}</td>
      </tr>
      <tr>
          <th style="text-align: left; padding: 4px;border: 1px solid #ccc;">Severity</th>
          <td style="padding: 4px;border: 1px solid #ccc;">${data.severity}</td>
      </tr>
      <tr>
        <th style="text-align: left; padding: 4px;border: 1px solid #ccc;">State</th>
        <td style="padding: 4px;border: 1px solid #ccc;">${state}</td>
      </tr>
      <tr>
        <th style="text-align: left; padding: 4px;border: 1px solid #ccc;">Affective</th>
        <td style="padding: 4px;border: 1px solid #ccc;">${data.effective}</td>
      </tr>
      <tr>
        <th style="text-align: left; padding: 4px;border: 1px solid #ccc;">Onset</th>
        <td style="padding: 4px;border: 1px solid #ccc;">${data.onset}</td>
      </tr>
      <tr>
        <th style="text-align: left; padding: 4px;border: 1px solid #ccc;">Expires</th>
        <td style="padding: 4px;border: 1px solid #ccc;">${data.expires}</td>
      </tr>
      <tr>
        <th style="text-align: left; padding: 4px;border: 1px solid #ccc;">Affected Area</th>
        <td style="padding: 4px;border: 1px solid #ccc;">${data.areaDesc}</td>
      </tr>
    </table>
    
  `;
  }

  exportHazardsData(): void {
    const dataToExport = this.hazardsArray.map((hazard: any) => ({
      District: hazard.district,
      State: hazard.state,
      Circle: hazard.indus_circle,
      Hazard_Type: hazard.event,
      Severity: hazard.severity,
      Affective: hazard.effective,
      Expires: hazard.expires,
      Description: hazard.description,
    }));

    // Create empty worksheet
    const worksheet: XLSXStyle.WorkSheet = XLSX.utils.aoa_to_sheet([]);

    // Header row
    XLSX.utils.sheet_add_aoa(
      worksheet,
      [
        [
          `Updated Hazard : ${new Date().toLocaleString('en-US', {
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
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
    ];

    const workbook: XLSXStyle.WorkBook = {
      Sheets: { Hazards: worksheet },
      SheetNames: ['Hazards'],
    };

    XLSXStyle.writeFile(workbook, `${this.selectedHazard} Hazards Report.xlsx`);
  }

  fetchSelectedHazardData = async (id: any) => {
    let featuresArray: any = [];
    const res = this.hazardsGeoJSON.features.features[id];
    featuresArray = res;
    const hazardsGeoJSON = {
      type: 'FeatureCollection',
      features: featuresArray,
    };

    return hazardsGeoJSON;
  };

  closeModal = () => {
    this.showHazardModal = false;
  };
  //#endregion
}
