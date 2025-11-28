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
import { circle } from '@turf/turf';

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

  selectedPage = 'dashboard';
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

  logId: string = '';
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
  sources = [
    { label: 'Weather API', value: 'weather_api', visibility: true },
    // { label: 'Cross Visual', value: 'cross_visual', visibility: false },
    // { label: 'Open Metro', value: 'open_metro', visibility: false },
  ];

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

  hazardIcon = [
    // { label: 'Flood', icon: 'fa-solid fa-water' },
    // { label: 'Thunderstorm', icon: 'fa-solid fa-cloud-bolt' },
    { label: 'Rainfall', icon: 'fa-solid fa-cloud-showers-heavy' },
    { label: 'Lightning', icon: 'fa-solid fa-bolt' },
    { label: 'Flood', icon: 'fa-solid fa-hill-rockslide' },
    { label: 'Thunderstorm', icon: 'fa-solid fa-hill-avalanche' },
  ];

  UP_West = [
    'Saharanpur',
    'Muzaffarnagar',
    'Shamli',
    'Moradabad',
    'Bijnor',
    'Rampur',
    'Amroha',
    'Sambhal',
    'Meerut',
    'Baghpat',
    'Ghaziabad',
    'Gautam Buddha Nagar',
    'Hapur',
    'Bulandshahr',
    'Aligarh',
    'Hathras',
    'Etah',
    'Kasganj',
    'Agra',
    'Mathura',
    'Firozabad',
    'Mainpuri',
    'Bareilly',
    'Badaun',
    'Pilibhit',
    'Shahjahanpur',
    'Farrukhabad',
    'Kannauj',
    'Etawah',
    'Auraiya',
    'Uttarakhand',
  ];

  UP_East = [
    'Gorakhpur',
    'Varanasi',
    'Sant Ravidas Nagar (Bhadohi)',
    'Pratapgarh',
    'Mirzapur',
    'Jaunpur',
    'Chandauli',
    'Ghazipur',
    'Kushinagar',
    'Deoria',
    'Azamgarh',
    'Mau',
    'Maharajganj',
    'Basti',
    'Sant Kabir Nagar',
    'Siddharth Nagar',
    'Ballia',
    'Sonbhadra',
    'Prayagraj (Allahabad)',
    'Kaushambi',
    'Bahraich',
    'Shrawasti',
    'Balrampur',
    'Gonda',
    'Ambedkar Nagar',
    'Sultanpur',
    'Amethi',
  ];

  North_East = [
    'Sikkim',
    'Tripura',
    'Nagaland',
    'Mizoram',
    'Meghalaya',
    'Manipur',
    'Arunachal Pradesh',
  ];

  selectedHazardDetail: any = {};
  todaysDate: string = '';
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
  showHazardModal = false;
  user: any = {};
  selectedLocation: string = '';

  getIcon(category: string): string {
    const found = this.hazardIcon.find((h) => h.label === category);
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
  constructor(
    private dataService: DataService,
    private cdr: ChangeDetectorRef,
    private WeatherService: WeatherService,
    private http: HttpClient,
    private dateTimeService: DateTimeService,
    private locationSevice: CurrentLocationService,
    private snackBar: MatSnackBar
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
        })
      )
      .subscribe((results) => {
        this.isSearchLoading = false;
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
      });
  }

  ngOnInit(): void {
    let storedUser = localStorage.getItem('user');
    if (storedUser) {
      this.user = JSON.parse(storedUser);

      if (this.user.indus_circle && !this.user.circle) {
        this.user.circle = this.user.indus_circle;
      }

      if (this.user.location) {
        this.selectedLocation = this.user.location;
      }

      if (this.user.indus_circle === 'All Circle') {
        this.WeatherService.setCircleChange('M&G');
      } else {
        this.WeatherService.setCircleChange(this.user.indus_circle);
      }
    }
    this.loadWeatherSubject
      .pipe(debounceTime(400))
      .subscribe(() => this.loadWeather());

    this.WeatherService.setCircleLocationChange('18.9582,72.8321');
    this.loadWeatherSubject.next();

    this.WeatherService.location$.subscribe((location: string) => {
      if (this.selectedDay === 'TODAY') {
        this.selectedLocation = location;
        this.loadWeatherSubject.next();
      } else {
        this.isLoading = true;
        this.dataService.getWeatherForecast(location).subscribe({});
        this.selectedLocation = location;
        this.loadWeatherSubject.next();
      }
    });

    this.WeatherService.selectedLayer$.subscribe((layer) => {
      this.selectedLayer = layer;
      this.safeDetectChanges();
    });

    this.WeatherService.weatherLogId$.subscribe((id) => {
      this.logId = id;
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

    this.WeatherService.circleChangedIs$.subscribe((circle: string) => {
      if (!circle) {
        console.warn(
          'circleChangedIs$ received empty value. Skipping loadWeather.'
        );
        return;
      }
      this.user.circle = circle;
    });

    this.WeatherService.circleLocationChangedIs$.subscribe(
      (circleLocation: string) => {
        this.selectedLocation = circleLocation;
        this.loadWeatherSubject.next();
      }
    );

    this.fetchHazardTypes();
    this.fetchSeverityTypes();
    this.fetchHazardCurrentDay('All', 'All');
    this.fetchRecentEarthquake();
  }

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
        this.loadWeatherSubject.next();
      })
      .catch((err) => {
        console.log(err.message);
      });
  }

  onSearchChange() {
    if (this.searchTerm.trim()) {
      this.selectedLocation = this.searchTerm;
      this.WeatherService.setSearchLoader(true);
      // this.isLoading = true;
      this.isSearchLoading = true;
      this.searchSubject.next(this.searchTerm.trim() + ', India');
    }
  }

  searchPlaces(query: string) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
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
      this.loadWeatherSubject.next();

      this.WeatherService.setSearchLocation(location);
      this.searchTerm = '';
    }
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
    this.loadWeatherSubject.next();
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

      const name = data.location['name'];
      const region = data.location['region'];
      let loc = '';
      if (this.UP_West.includes(name) || this.UP_West.includes(region)) {
        loc = `${name}, UP West`;
      } else if (this.UP_East.includes(name) || this.UP_East.includes(region)) {
        loc = `${name}, UP East`;
      } else if (
        this.North_East.includes(name) ||
        this.North_East.includes(region)
      ) {
        loc = `${name}, North East`;
      } else if (name && region) {
        if (name === 'Delhi') {
          loc = `${name}`;
        } else {
          loc = `${name}, ${region}`;
        }
      } else {
        loc = `${name || ''} ${region || ''}`.trim();
      }
      this.current_forecast = {
        location: loc,
        current_time: date_time,
        temp:
          data.current.temp_c != null ? parseFloat(data.current.temp_c) : null,
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

      const name = data.location['name'];
      let regionName = data.location['region'];
      const reginUPArray = ['Uttar Pradesh', 'UP'];
      const rgionMPArray = ['Madhya Pradesh', 'MP'];

      if (reginUPArray.includes(data.location['region'])) {
        regionName = 'UP East';
      } else if (rgionMPArray.includes(data.location['region'])) {
        regionName = 'Madhya Pradesh';
      }

      let loc = data.location['name'] + ', ' + regionName;

      const currentHour =
        new Date().getHours().toString().padStart(2, '0') + ':00';
      const hourlyForecast = data.forecast.forecastday[index].hour;
      const currentHourData = hourlyForecast.find(
        (item: any) => item.time.split(' ')[1] === currentHour
      );
      // const time = this.formatTo12Hour(currentHour);
      const time = currentHour;

      this.current_forecast = {
        location: loc,
        current_time: `${date}, ${time}`,
        temp:
          data.current.temp_c != null ? parseFloat(data.current.temp_c) : null,
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
      temp:
        data.current.temp_c != null ? parseFloat(data.current.temp_c) : null,
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

    this.isLoading = true; // Start loader

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

          this.isLoading = false; // Stop loader
          this.activeAccordion = 'hourly';
          this.safeDetectChanges();
        },
        error: (err: any) => {
          console.error('Error from weather_api', err);
          this.isLoading = false;
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
          this.isLoading = false; // Stop loader
          this.activeAccordion = 'hourly';
          this.safeDetectChanges();
        },
        error: (err: any) => {
          console.error('Error from cross_visual', err);
          this.isLoading = false;
          this.safeDetectChanges();
        },
      });
    }
  }

  async ngAfterViewInit(): Promise<void> {}
  selectLayer(layer: string) {
    this.WeatherService.setSelectedLayer(layer);
  }

  toggleAccordion(panel: string) {
    this.activeAccordion = this.activeAccordion === panel ? '' : panel;
    setTimeout(() => {
      this.scrollToCurrentHour();
    }, 3000);

    // if (this.scrollContainer && panel !== 'hourly') {
    //   this.scrollToCurrentHour();
    //   setTimeout(() => {
    //     this.scrollContainer.nativeElement.scrollLeft = 0;
    //     this.updateScrollButtons();
    //   }, 300);
    // }
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

  //To prevent memory to call same function multiple times
  private loadWeatherSubject = new Subject<void>();

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

  //#region Hazard Risk
  hazardData: HazardItem[] = [
    {
      state: 'Uttar Pradesh',
      time: '10:00',
      date: '2025-07-20',
      hazardType: 'Flood',
      district: 'Lucknow',
      city: 'Lucknow',
    },
    {
      state: 'Uttar Pradesh',
      time: '11:30',
      date: '2025-07-19',
      hazardType: 'Heatwave',
      district: 'Varanasi',
      city: 'Varanasi',
    },
    {
      state: 'Uttar Pradesh',
      time: '08:15',
      date: '2025-07-18',
      hazardType: 'Thunderstorm',
      district: 'Kanpur',
      city: 'Kanpur',
    },
    {
      state: 'Uttar Pradesh',
      time: '13:45',
      date: '2025-07-21',
      hazardType: 'Cold Wave',
      district: 'Agra',
      city: 'Agra',
    },
    {
      state: 'Uttar Pradesh',
      time: '09:00',
      date: '2025-07-21',
      hazardType: 'Flood',
      district: 'Gorakhpur',
      city: 'Gorakhpur',
    },
  ];
  districts = Array.from(new Set(this.hazardData.map((h) => h.district)));

  get filteredHazards(): HazardItem[] {
    if (!this.selectedHazard && !this.selectedDistrict) {
      return this.hazardData;
    }

    return this.hazardData.filter(
      (h) =>
        (!this.selectedHazard || h.hazardType === this.selectedHazard) &&
        (!this.selectedDistrict || h.district === this.selectedDistrict)
    );
  }
  toggleIcon() {
    this.isOpen = !this.isOpen;
  }

  //#endregion
  onchangeHazardsType = async () => {
    await this.fetchHazardCurrentDay(
      this.selectedHazard,
      this.selectedSeverity
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
      this.selectedSeverity
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

  updateWeatherLogTable = (payload: Object) => {
    this.dataService
      .sendWeatherUserLog(`weather_user_activity`, payload)
      .pipe(
        catchError((error) => {
          const errorMessage =
            error?.error?.message || 'User log insertion failed';
          return throwError(() => `${error} \n ${errorMessage}`);
        })
      )
      .subscribe((res: any) => {
        if (res?.status === 'success') {
          return;
        }
      });
  };

  hazardToggleOff = () => {
    const checkbox = document.getElementById('toggleBtn') as HTMLInputElement;
    checkbox.checked = false;
    this.isToggledHazardsOnMap = false;
  };

  updateWeatherLog(payload: object): void {
    this.dataService
      .sendWeatherUserLog(`weather_user_activity`, payload)
      .pipe(
        catchError((error) => {
          const errorMessage =
            error?.error?.message || 'User log insertion failed';
          return throwError(() => `${error} \n ${errorMessage}`);
        })
      )
      .subscribe((res: any) => {
        if (res?.status === 'success') {
          return;
        }
      });
  }

  callHazardsAddOnMap() {
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
      document
        .querySelector('.map-panel')
        ?.scrollIntoView({ behavior: 'smooth' });
    } else {
      this.mapWeather.map.getLayers().forEach((layer) => {
        if (layer.get('title') === 'Hazard Layer') {
          this.mapWeather.map.removeLayer(layer);
        }
        this.mapWeather.map.getView().animate({
          center: this.mapWeather.initialCenter,
          zoom: this.mapWeather.initialZoom,
          duration: 500,
        });
      });
    }
  }

  //#region Fetch Weather data and API calls
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
      default:
        break;
    }
  }

  fetchHazardTypes = () => {
    this.dataService
      .postRequest('get-hazards-list', {})
      .subscribe((res: any) => {
        const data = res.data;

        // filter out empty hazard_list
        const hazardEvent = data.filter((d: any) => d.hazard_list !== '');
        const events = hazardEvent.map((d: any) => d.hazard_list.toLowerCase());

        // start fresh
        let categories: { [key: string]: string[] } = {};

        events.forEach((event: string) => {
          let matched = false;

          for (let keyword of this.keywords) {
            if (event.includes(keyword.value.toLowerCase())) {
              // create the tab only once
              if (!categories[keyword.label]) {
                categories[keyword.label] = [event];
              }
              matched = true;
            }
          }
        });

        // collect only the categories that exist
        this.categoriesKeys = Object.keys(categories);

        //  set first tab active only once
        if (this.categoriesKeys.length > 0 && this.activeTab === '') {
          this.activeTab = this.categoriesKeys[0];
          this.selectedHazard = this.activeTab;
          this.onchangeHazardsType();
        }
      });
  };

  fetchSeverityTypes = () => {
    this.dataService
      .postRequest('get-severity-list', {})
      .subscribe((res: any) => {
        const data = res.data;
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
    selectedSeverity: string
  ) => {
    const params = {
      hazardType: hazardType,
      severityType: selectedSeverity,
    };
    const res: any = await firstValueFrom(
      this.dataService.postRequest('get-today-disasters', { params })
    );
    if (res.data) {
      const data = res.data;
      this.hazardsArray = [];
      const featuresArray: any = [];
      this.hazardsGeoJSON = {
        type: 'FeatureCollection',
        features: featuresArray,
      };
      data.forEach((hazard: any) => {
        if (hazard) {
          let description =
            hazard.description !== '' ? hazard.description : hazard.headline;
          let state =
            hazard.state !== null
              ? hazard.state.replace(/sdma/i, '').trim()
              : hazard.state;
          const obj = {
            id: hazard.id,
            areaDesc: hazard.areaDesc,
            certainty: hazard.certainty,
            description: description,
            effective: hazard.effective,
            event: hazard.event,
            expires: hazard.expires,
            onset: hazard.onset,
            sender: hazard.sender,
            sent: hazard.sent,
            severity: hazard.severity,
            state: state,
          };
          this.hazardsArray.push(obj);
          featuresArray.push({
            type: 'Feature',
            geometry: JSON.parse(hazard.geometry),
            properties: obj,
          });
        }
      });

      this.safeDetectChanges();
    }
  };

  fetchRecentEarthquake = () => {
    this.alertMessages = [];
    this.dataService.postRequest('get-earthquake', {}).subscribe((res: any) => {
      const data = res.data;
      data.forEach((alert: any) => {
        this.alertMessages.push(`${alert.title} - ${alert.time}`);
      });
    });
  };

  viewSelectedHazardOnMap = async (id: any) => {
    this.showHazardModal = true;
    const hazardsGeoJSON = await this.fetchSelectedHazardData(id);
    await this.initMap(hazardsGeoJSON);
  };

  async initMap(hazardsGeoJSON: any): Promise<void> {
    const severity = hazardsGeoJSON.features[0].properties.severity;
    let fillColor;
    switch (severity) {
      case 'Extreme':
        fillColor = '#e53935';
        break;
      case 'Severe':
        fillColor = '#ffaa00';
        break;
      case 'Moderate':
        fillColor = '#ffff00';
        break;
      default:
        fillColor = 'gray';
    }

    // Base map layer
    const baseMap = new TileLayer({
      source: new XYZ({
        url: 'http://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}',
        crossOrigin: 'anonymous',
      }),
      properties: { title: 'Base Map', fixed: true },
    });

    // Hazard source
    const hazardSource = new VectorSource({
      features: new GeoJSON().readFeatures(hazardsGeoJSON, {
        featureProjection: 'EPSG:3857',
      }),
    });

    // Hazard style (fill + stroke)
    const hazardStyle = new Style({
      fill: new Fill({
        color: `${fillColor}80`, // 55 hex ≈ 33% opacity
      }),
      stroke: new Stroke({
        color: '#000',
        width: 2,
      }),
    });

    const hazardLayer = new VectorLayer({
      source: hazardSource,
      style: hazardStyle,
    });

    // Map creation
    const map = new Map({
      target: 'hazardMap',
      layers: [baseMap, hazardLayer],
      view: new View({
        projection: 'EPSG:3857',
        center: fromLonLat([25.446356542436767, 82.83201876568786]),
        zoom: 8,
      }),
    });

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

  fetchSelectedHazardData = async (id: any) => {
    const res: any = await firstValueFrom(
      this.dataService.postRequest('get-selected-disasters', { id: id })
    );
    const featuresArray: any = [];
    const hazardsGeoJSON = {
      type: 'FeatureCollection',
      features: featuresArray,
    };
    if (res.data) {
      const data = res.data;
      data.forEach((hazard: any) => {
        if (hazard) {
          let description =
            hazard.description !== '' ? hazard.description : hazard.headline;
          let state =
            hazard.state !== null
              ? hazard.state.replace(/sdma/i, '').trim()
              : hazard.state;
          const obj = {
            id: hazard.id,
            areaDesc: hazard.areaDesc,
            certainty: hazard.certainty,
            description: description,
            effective: hazard.effective,
            event: hazard.event,
            expires: hazard.expires,
            onset: hazard.onset,
            sender: hazard.sender,
            sent: hazard.sent,
            severity: hazard.severity,
            state: state,
          };
          this.selectedHazardDetail = obj;
          this.safeDetectChanges();
          featuresArray.push({
            type: 'Feature',
            geometry: JSON.parse(hazard.geometry),
            properties: obj,
          });
        }
      });
    }
    return hazardsGeoJSON;
  };
  closeModal = () => {
    this.showHazardModal = false;
  };
  //#endregion
}
