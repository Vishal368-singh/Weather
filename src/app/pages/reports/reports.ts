import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  AfterViewInit,
  ChangeDetectorRef,
  HostListener,
} from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { CommonModule, NgIf } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { MapWeather } from '../../components/map-weather/map-weather';
import { DataService } from '../../data-service/data-service';
import { WeatherService } from '../../services/weather';
import { DateTimeService } from '../../services/date-time';

import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Title,
  Tooltip,
  ChartOptions,
  ChartData,
  registerables,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { CurrentLocationService } from '../../services/current-location-service';
import { visibility } from 'html2canvas/dist/types/css/property-descriptors/visibility';

Chart.register(
  ...registerables,
  ChartDataLabels,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Title,
  Tooltip
);

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Title,
  Tooltip
);
interface DailyWeather {
  date: string;
  minTemp: number;
  maxTemp: number;
  description: string;
  chanceOfRain: any;
  humidity: any;
  icon: string;
}
interface TowerCell {
  value: number;
  color: string;
}

type SeverityRow = {
  label: string;
  [key: string]: any; // allow dynamic KPI fields like rainfall, wind, etc.
};

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, NgIf, BaseChartDirective, MapWeather],
  templateUrl: './reports.html',
  styleUrls: ['./reports.css'],
})
export class Reports implements OnInit {
  constructor(
    private locationService: CurrentLocationService,
    private dataService: DataService,
    private cdr: ChangeDetectorRef,
    private WeatherService: WeatherService,
    private dateTimeService: DateTimeService
  ) {
    this.barThickness();
  }

  public isBrowser = typeof window !== 'undefined';
  selectedPage = 'dashboard';
  showForecast = false;
  atScrollStart: boolean = true;
  atScrollEnd: boolean = false;
  current: any = null;
  location: any = null;
  activeAccordion: string = '';
  currentTime: string = '';
  lastUpdatedTime: string = '';
  loading: boolean = false;
  isOpen = false;
  selectedHazard = '';
  selectedDistrict = '';
  selectedTab = 1;
  responseData: any = {};
  responseDataDistrictWise: any[] = [];
  responseDataSeverityWise: any = {};
  selectedCircle: string = '';
  selectedCircleSeverityRange: any = {};

  legendData: any;
  grouped: any = {};
  public barChartData1: any = {};
  public barChartData2: any = {};

  circleOptions: any = [];
  selectedPDFCircle: string = '';

  labels: any = ['Rain', 'Temp (Max)', 'Wind', 'Humidity', 'Visibility'];
  severityOrder: any = ['Extreme', 'High', 'Moderate'];
  severityColorMap: any = {};
  labelToColorKey: any = {
    Rain: 'rainfallColor',
    Temp: 'temperatureColor',
    Wind: 'windColor',
    Humidity: 'humidityColor',
    Visibility: 'visibilityColor',
  };
  currentDate: string = '';
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

  circleList: string[] = [
    'Haryana',
    'UP(W)',
    'Madhya Pradesh',
    'Tamil Nadu',
    'Rajasthan',
    'Maharashtra',
    'Bihar',
    'Jammu and Kashmir',
    'Gujarat',
    'Punjab',
    'UP(E)',
    'North East',
    'Himachal Pradesh',
    'Orissa',
    'Karnataka',
    'Delhi',
    'Assam',
    'West Bengal',
    'Andhra Pradesh',
  ];

  weatherData: DailyWeather[] = [];
  mappedTowerData: any;
  activeTab: string = 'temperature';
  activeKPIUnit: string = ' °C';
  user: any = {};

  setActive(tab: string) {
    this.activeTab = tab;
    if (tab === 'temperature') {
      this.activeKPIUnit = ' °C';
    } else if (tab === 'rainfall') {
      this.activeKPIUnit = ' mm';
    } else if (tab === 'wind') {
      this.activeKPIUnit = ' kph';
    } else if (tab === 'humidity') {
      this.activeKPIUnit = ' %';
    } else if (tab === 'visibility') {
      this.activeKPIUnit = ' km';
    } else if (tab === 'accu_rainfall') {
      this.activeKPIUnit = ' mm';
    } else {
      this.activeKPIUnit = '';
    }
    this.fetchDistrictWiseKPIValues();
    this.fetchDistrictNamesSeverityWise();
  }
  selectTab(tabNumber: number) {
    this.selectedTab = tabNumber;
  }

  ngOnInit(): void {
    const { formattedDate } = this.dateTimeService.getCurrentDateTime();
    this.currentDate = formattedDate;
    this.WeatherService.setSearchLocation('');
    localStorage.removeItem('selectedCircle');
    let storedUser = localStorage.getItem('user');
    if (storedUser) {
      this.user = JSON.parse(storedUser);

      if (this.user.indus_circle === 'All Circle') {
        this.location = 'M&G';
      } else {
        this.location = this.user.indus_circle;
      }

      if (this.user.circle === '') {
        this.getUserCurrentLocation();
        this.cdr.detectChanges();
      } else {
        this.fetch7daysForecastData();
        this.cdr.detectChanges();
      }
    }
    this.loadCircleListForDropdown();

    this.WeatherService.circleChangedIs$.subscribe((circle: string) => {
      if (circle) {
        if (circle === 'All Circle') {
          this.location = 'M&G';
        } else {
          this.location = circle;
        }
        this.fetchWeatherData();
      }
    });

    this.WeatherService.panIndia$.subscribe((location: string) => {
      if (location) {
        this.location = location;
        this.fetchSeverityKPIRanges();
        this.fetchWeatherData();
        this.fetchDistrictWiseKPIValues();
        this.fetchDistrictNamesSeverityWise();
        this.cdr.detectChanges();
      } else {
        this.location =
          this.user.indus_circle === 'All Circle'
            ? 'M&G'
            : this.user.indus_circle;

        this.fetchSeverityKPIRanges();
        this.fetchDistrictWiseKPIValues();
        this.fetchDistrictNamesSeverityWise();
        this.fetchWeatherData();
        this.cdr.detectChanges();
      }
    });

    this.fetchlegend_with_color();
    this.fetchDistrictWiseKPIValues();
  }

  towerData: any = [];
  fetch7daysForecastData() {
    const payload = {
      circle: this.location,
    };
    this.dataService
      .postRequest('fetch_circle_report', payload)
      .pipe(
        catchError((error) => {
          const errorMessage = error?.error?.message || 'Internal Server Error';
          console.error(errorMessage);
          return throwError(() => error);
        })
      )
      .subscribe((response: any) => {
        // Order of severity mapping must match your towerData order:
        const severityOrder = [
          'Temperature_Max',
          'Rainfall',
          'Wind',
          'Humidity',
          'Visibility',
        ];

        // Map API response into towerData
        this.towerData = Object.keys(response).map((dayKey) => {
          const dayData = response[dayKey];
          return severityOrder.map((severity) => {
            const sevData = dayData[severity];
            return [
              sevData.extreme || 0,
              sevData.high || 0,
              sevData.moderate || 0,
            ];
          });
        });
        this.fetchWeatherData();
        this.fetchSeverityKPIRanges();
        this.fetchDistrictWiseKPIValues();
        this.fetchDistrictNamesSeverityWise();
        this.buildBarChartData();
        this.cdr.detectChanges();
      });
  }

  fetchlegend_with_color() {
    const payload = { circle: this.location };
    this.dataService.postRequest('legend_with_color', payload).subscribe({
      next: (res: any) => {
        if (res?.status === 'success') {
          this.legendData = res.data;
          console.log('Legend Data Loaded:', this.legendData);

          document.documentElement.style.setProperty(
            '--extreme-color',
            this.legendData.color.extreme_color
          );
          document.documentElement.style.setProperty(
            '--high-color',
            this.legendData.color.high_color
          );
          document.documentElement.style.setProperty(
            '--moderate-color',
            this.legendData.color.moderate_color
          );
          document.documentElement.style.setProperty(
            '--low-color',
            this.legendData.color.low_color
          );

          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error('Legend load failed:', err),
    });
  }

  getUserCurrentLocation() {
    this.locationService
      .getSafeLocation()
      .then((pos: any) => {
        const location = pos;
        this.location = location;
        this.fetchSeverityKPIRanges();
        this.fetchWeatherData();
      })
      .catch((err) => {
        console.log(err.message);
      });
  }

  // ngAfterViewInit(): void {
  //   this.WeatherService.location$.subscribe((location: string) => {
  //     this.location = location;
  //     this.fetchWeatherData();
  //   });
  // }

  fetchSeverityKPIRanges = () => {
    try {
      this.dataService
        .postData('/fetch-kpi-range')
        .pipe(
          catchError((error: any) => {
            const errorMessage =
              error?.error?.message || 'Internal Server Error';
            console.error(errorMessage);
            return throwError(() => error);
          })
        )
        .subscribe((response) => {
          if (response.status === 'success') {
            this.responseData = response.data;
            let circle = '';

            // Normalize the circle name

            circle = this.location;

            const data = circle
              ? this.responseData[circle]
              : this.responseData[circle];

            // console.log('Severity KPI Ranges Data:', data);
            if (data && data.length > 0) {
              this.selectedCircleSeverityRange = data[0];
              this.grouped = this.categorizeKPI(
                this.selectedCircleSeverityRange
              );

              if (this.towerData.length > 0) {
                this.populateSeverityTable();
                this.buildBarChartData();
                this.bind7DaysForecastWithColor();
              }
            } else {
              console.warn(`No data found for circle: ${circle}`);
            }
          }
        });
    } catch (error) {
      console.error(error);
    }
  };

  fetchDistrictWiseKPIValues = () => {
    try {
      const payload = {
        circle: 'AP',
      };

      this.dataService
        .postRequest('/fetch_district_wise_KPI_values', payload)
        .pipe(
          catchError((error: any) => {
            const errorMessage =
              error?.error?.message || 'Internal Server Error';
            console.error(errorMessage);
            return throwError(() => error);
          })
        )
        .subscribe({
          next: (response: any) => {
            this.responseDataDistrictWise = [];

            if (response) {
              const kpidata = response[0].district_wise_kpi_values;
              if (this.activeTab === 'temperature') {
                kpidata.forEach((ele: any) => {
                  const obj = {
                    district: ele.district,
                    day1: ele.day1.temp_max,
                    min1: ele.day1.temp_min,

                    day2: ele.day2.temp_max,
                    min2: ele.day2.temp_min,

                    day3: ele.day3.temp_max,
                    min3: ele.day3.temp_min,

                    day4: ele.day4.temp_max,
                    min4: ele.day4.temp_min,

                    day5: ele.day5.temp_max,
                    min5: ele.day5.temp_min,

                    day6: ele.day6.temp_max,
                    min6: ele.day6.temp_min,

                    day7: ele.day7.temp_max,
                    min7: ele.day7.temp_min,
                  };
                  this.responseDataDistrictWise.push(obj);
                });
                this.cdr.detectChanges();
              } else if (this.activeTab === 'rainfall') {
                kpidata.forEach((ele: any) => {
                  const obj = {
                    district: ele.district,
                    day1: ele.day1.rain_precip,
                    day2: ele.day2.rain_precip,
                    day3: ele.day3.rain_precip,
                    day4: ele.day4.rain_precip,
                    day5: ele.day5.rain_precip,
                    day6: ele.day6.rain_precip,
                    day7: ele.day7.rain_precip,
                  };
                  this.responseDataDistrictWise.push(obj);
                });
                this.cdr.detectChanges();
              } else if (this.activeTab === 'humidity') {
                kpidata.forEach((ele: any) => {
                  const obj = {
                    district: ele.district,
                    day1: ele.day1.humidity,
                    day2: ele.day2.humidity,
                    day3: ele.day3.humidity,
                    day4: ele.day4.humidity,
                    day5: ele.day5.humidity,
                    day6: ele.day6.humidity,
                    day7: ele.day7.humidity,
                  };
                  this.responseDataDistrictWise.push(obj);
                });
                this.cdr.detectChanges();
              } else if (this.activeTab === 'visibility') {
                kpidata.forEach((ele: any) => {
                  const obj = {
                    district: ele.district,
                    day1: ele.day1.visibility,
                    day2: ele.day2.visibility,
                    day3: ele.day3.visibility,
                    day4: ele.day4.visibility,
                    day5: ele.day5.visibility,
                    day6: ele.day6.visibility,
                    day7: ele.day7.visibility,
                  };
                  this.responseDataDistrictWise.push(obj);
                });
                this.cdr.detectChanges();
              } else if (this.activeTab === 'accu_rainfall') {
                kpidata.forEach((ele: any) => {
                  const obj = {
                    district: ele.district,
                    day1: ele.day1.accu_rainfall,
                    day2: ele.day2.accu_rainfall,
                    day3: ele.day3.accu_rainfall,
                    day4: ele.day4.accu_rainfall,
                    day5: ele.day5.accu_rainfall,
                    day6: ele.day6.accu_rainfall,
                    day7: ele.day7.accu_rainfall,
                  };
                  this.responseDataDistrictWise.push(obj);
                });
                this.cdr.detectChanges();
              } else {
                kpidata.forEach((ele: any) => {
                  const obj = {
                    district: ele.district,
                    day1: ele.day1.wind,
                    day2: ele.day2.wind,
                    day3: ele.day3.wind,
                    day4: ele.day4.wind,
                    day5: ele.day5.wind,
                    day6: ele.day6.wind,
                    day7: ele.day7.wind,
                  };
                  this.responseDataDistrictWise.push(obj);
                });
                this.cdr.detectChanges();
              }

              this.responseDataDistrictWise = response.data;
              // console.log(
              //   'District-wise KPI Data Only:',
              //   this.responseDataDistrictWise
              // ); // LOG ACTUAL DATA
            } else {
              console.warn(
                'District-wise KPI API returned non-success status',
                response
              );
            }
          },
          error: (err: any) => {
            console.error('Error fetching district-wise KPI values', err);
          },
        });
    } catch (error) {
      console.error(error);
    }
  };

  fetchDistrictNamesSeverityWise = () => {
    try {
      const payload = { circle: 'AP' };

      this.dataService
        .postRequest('/fetch_district_names_severity_wise', payload)
        .pipe(
          catchError((error: any) => {
            const errorMessage =
              error?.error?.message || 'Internal Server Error';
            console.error(errorMessage);
            return throwError(() => error);
          })
        )
        .subscribe({
          next: (response: any) => {
            // console.log('Full API Response:', response);

            if (response) {
              this.responseDataSeverityWise = {
                Rainfall: response.Rainfall?.day1,
                Temperature_Max: response.Temperature_Max?.day1,
                Humidity: response.Humidity?.day1,
                Wind: response.Wind?.day1,
                Visibility: response.Visibility?.day1,
              };
            }
          },
          error: (err: any) => {
            console.error('Error fetching district names severity-wise:', err);
          },
        });
    } catch (error) {
      console.error('Unexpected error in fetchDistrictWiseKPIValues:', error);
    }
  };

  async loadCircleListForDropdown() {
    try {
      let apiPayload: { circle: string };
      if (['Admin', 'MLAdmin'].includes(this.user.userrole)) {
        apiPayload = { circle: 'All Circle' };
      } else {
        apiPayload = { circle: this.user.indus_circle };
      }

      const res: any = await this.dataService
        .postData('get_circle_list', apiPayload)
        .toPromise();

      if (res && res.status && Array.isArray(res.data)) {
        this.circleOptions = res.data
          .filter(
            (item: { circle: string; location: string }) =>
              item.circle !== 'All Circle'
          )
          .map((circleName: { circle: string; location: string }) => ({
            value: circleName.location,
            label: circleName.circle,
          }))
          .sort(
            (
              a: { label: string; value: string },
              b: { label: string; value: string }
            ) => a.label.localeCompare(b.label)
          );
      } else {
        console.error(
          'Failed to load circle list: Invalid API response format'
        );
        this.circleOptions = [];
      }
      this.cdr.detectChanges();
    } catch (error) {
      console.error('❌ Failed to load circle list from API:', error);
      this.circleOptions = [];
    }
  }

  pdfdownload(event: Event): void {
    const selectEl = event.target as HTMLSelectElement;
    const selectedValues = Array.from(selectEl.selectedOptions).map(
      (opt) => opt.label
    );

    this.selectedPDFCircle = selectedValues[0];
    const payload = {
      circle: this.selectedPDFCircle,
    };
    let circle_pdf_url = '';
    this.dataService
      .postData('/generate_pdf_link', payload)
      .pipe(
        catchError((error) => {
          const errorMessage = error?.error?.message || 'Internal Server Error';
          console.error(errorMessage);
          return throwError(() => error);
        })
      )
      .subscribe((res) => {
        if (res) {
          circle_pdf_url = res.url;
          if (circle_pdf_url) {
            window.open(circle_pdf_url);
          }
        }
      });
  }

  severityTable: SeverityRow[] = [
    { label: 'Extreme' },
    { label: 'High' },
    { label: 'Moderate' },
  ];
  severityColorBarChart: any = [
    { label: 'Extreme' },
    { label: 'High' },
    { label: 'Moderate' },
  ];

  populateSeverityTable() {
    Object.keys(this.grouped).forEach((key) => {
      if (key.endsWith('_color')) return;

      const kpiData = this.grouped[key]; // rainfall, wind, etc.
      const kpiColors = this.grouped['color']; // rainfall_color, wind_color

      // Assign values row-wise
      this.severityTable[0][key] = kpiData.extreme; // Extreme row
      this.severityTable[0][`${key}Color`] = kpiColors?.extremeColor;
      this.severityColorBarChart[0][`${key}Color`] = kpiColors?.extremeColor;

      this.severityTable[1][key] = kpiData.high; // High row
      this.severityTable[1][`${key}Color`] = kpiColors?.highColor;
      this.severityColorBarChart[1][`${key}Color`] = kpiColors?.highColor;

      this.severityTable[2][key] = kpiData.moderate; // Moderate row
      this.severityTable[2][`${key}Color`] = kpiColors?.moderateColor;
      this.severityColorBarChart[2][`${key}Color`] = kpiColors?.moderateColor;
    });

    this.severityColorBarChart.forEach((severity: any) => {
      this.severityColorMap[severity.label] = {};
      this.labels.forEach((label: any) => {
        this.severityColorMap[severity.label][label] =
          severity[this.labelToColorKey[label]];
      });
    });
    const towerData = this.towerData.map((towerSet: any) => {
      let value: any = [];
      towerSet.map((values: any, index: any) => {
        let data = {
          value1: values[0],
          value1color: this.severityColorMap['Extreme'][this.labels[index]],
          value2: values[1],
          value2color: this.severityColorMap['High'][this.labels[index]],
          value3: values[2],
          value3color: this.severityColorMap['Moderate'][this.labels[index]],
        };
        value.push(data);
      });
      return value;
    });
    // console.log('This is towerData', towerData);
    this.mappedTowerData = towerData;
    this.cdr.detectChanges();
  }

  // Function to categorize data
  categorizeKPI(data: any) {
    const categories: any = {};

    Object.keys(data).forEach((key) => {
      const match = key.match(/(extreme|high|moderate|low)_(\w+)/);
      if (match) {
        const severity = match[1]; // extreme, high, moderate, low
        const field = match[2]; // rainfall, wind, etc.

        if (!categories[field]) {
          categories[field] = { field };
        }

        // Store value or color separately
        if (key.endsWith('_color')) {
          categories[field][`${severity}Color`] = data[key];
        } else {
          categories[field][severity] = data[key];
        }
      }
    });

    return categories;
  }

  getDateCurrentTo7Days = () => {
    const days = [];
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    for (let i = 0; i <= 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i); // add days
      const formattedDate = `${date.getDate()}-${
        monthNames[date.getMonth()]
      }-${date.getFullYear()}`;
      days.push(formattedDate);
    }
    return days;
  };
  getNext6Days() {
    const daysArr = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < 6; i++) {
      const dateObj = new Date();
      dateObj.setDate(dateObj.getDate() + i);

      daysArr.push({
        name: dayNames[dateObj.getDay()],
        date: dateObj.getDate(),
      });
    }

    return daysArr;
  }

  weatherKPIs: {
    label: string;
    icon: string;
    max: string;
    min: string;
  }[] = [];

  // #region Fetch Weather data
  fetchWeatherData = () => {
    this.loading = true;
    try {
      const payload = { circle: this.location };
      this.dataService
        .postRequest('get_circle_weather_min_max', payload)
        .subscribe({
          next: (res: any) => {
            if (res.status !== 'success' || !res.data?.length) {
              console.warn('No weather data found for circle:', location);
              this.loading = false;
              return;
            }
            const weather = res.data[0];
            this.location = res.circle;

            // 🔹 Compact KPI setup
            this.weatherKPIs = [
              {
                label: 'Temperature',
                icon: `<i class="fa-solid fa-temperature-half"></i>`,
                max: `${weather.temp_max} °C`,
                min: `${weather.temp_min} °C`,
              },
              {
                label: 'Humidity',
                icon: `<i class="fa-solid fa-droplet"></i>`,
                max: `${weather.humidity_max} %`,
                min: `${weather.humidity_min} %`,
              },
              {
                label: 'Rainfall',
                icon: `<i class="fas fa-cloud-showers-heavy"></i>`,
                max: `${weather.rain_max} mm`,
                min: `${weather.rain_min} mm`,
              },
              {
                label: 'Wind',
                icon: `<i class="fa-solid fa-compass"></i>`,
                max: `${weather.wind_max} km/h`,
                min: `${weather.wind_min} km/h`,
              },
              {
                label: 'Visibility',
                icon: `<i class="fa-solid fa-eye"></i>`,
                max: `${weather.visibility_max} km`,
                min: `${weather.visibility_min} km`,
              },
            ];

            // 🔹 Handle optional timestamps gracefully
            const currentTime = res?.location?.localtime;
            const lastUpdated = res?.current?.last_updated;
            this.currentTime = this.formatDateTime(currentTime);

            this.currentTime = currentTime
              ? new Date(currentTime).toLocaleString('en-IN', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })
              : '';
            this.lastUpdatedTime = lastUpdated
              ? new Date(lastUpdated).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })
              : '';

            this.cdr.detectChanges();
            this.loading = false;
          },

          error: (err: any) => {
            console.error('Weather API error:', err);
            this.loading = false;
          },
        });
    } catch (error) {
      console.error('fetchWeatherData error:', error);
      this.loading = false;
    }
  };

  // --- Helper: Determine UP or NE region tag
  getRegionTag(name: string, region: string): string | null {
    if (this.UP_West.includes(name) || this.UP_West.includes(region)) {
      return `${name}, UP West`;
    }
    if (this.UP_East.includes(name) || this.UP_East.includes(region)) {
      return `${name}, UP East`;
    }
    if (this.North_East.includes(name) || this.North_East.includes(region)) {
      return `${name}, North East`;
    }
    return null;
  }

  // --- Helper: Format datetime nicely
  formatDateTime(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  // --- Helper: Format forecast date
  formatForecastDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  }

  // .....Rainfall Prediction Table Data....................
  rainfallHeaders = {
    shortRange: [...this.getDateCurrentTo7Days().slice(0, 3)],
    longRange: [...this.getDateCurrentTo7Days().slice(3, 7)],
  };

  rainfallData = [
    {
      severity: 'Extreme',
      class: 'severity-extreme-1',
      shortRange: [
        'Pt. Deendayal Upadhyay, Chunar',
        'Pt. Deendayal Upadhyay, Kachhwa',
        'Kachhwa',
      ],
      longRange: [
        'Pt. Deendayal Upadhyay, Kachhwa',
        ' ',
        'Pt. Deendayal Upadhyay, Kachhwa',
        ' ',
      ],
    },
    {
      severity: 'High',
      class: 'severity-high-1',
      shortRange: [
        'Kachhwa, Baragaon, Varanasi',
        'Chunar, Baragaon, Varanasi, Chandrauti',
        'Chunar, Baragaon, Varanasi, Chandrauti',
      ],
      longRange: [
        'Chunar, Baragaon, Varanasi, Chandrauti, Pt. Deendayal Upadhyay',
        'Chunar',
        ' ',
        ' ',
      ],
    },
    {
      severity: 'Moderate',
      class: 'severity-moderate-1',
      shortRange: [
        'Chandwal, Chandrauti',
        'Chandwal',
        'Chandwal, Pt. Deendayal Upadhyay',
      ],
      longRange: [
        'Chandwal, Kachhwa',
        'Chandwal, Baragaon, Varanasi, Chandrauti',
        ' ',
        ' ',
      ],
    },
  ];

  // .............Temperature Prediction Table...........................
  temperatureDates = {
    shortRange: [...this.getDateCurrentTo7Days().slice(0, 3)],
    longRange: [...this.getDateCurrentTo7Days().slice(3, 7)],
  };

  temperatureSeverityData = [
    {
      severity: 'Extreme',
      class: 'severity-extreme-1',
      shortRange: [
        'Pt. Deendayal Upadhyay, Chandrauti',
        'Chunar, Kachhwa, Varanasi',
        ' ',
      ],
      longRange: [' ', ' ', ' ', ' '],
    },
    {
      severity: 'High',
      class: 'severity-high-1',
      shortRange: ['Kachhwa, Varanasi', ' ', ' '],
      longRange: [
        'Pt. Deendayal Upadhyay, Baragaon, Chandrauti',
        ' ',
        ' ',
        ' ',
      ],
    },
    {
      severity: 'Moderate',
      class: 'severity-moderate-1',
      shortRange: ['Chandwal, Chunar, Baragaon', 'Chandwal', ' '],
      longRange: [' ', ' ', ' ', ' '],
    },
  ];

  // ..........................Wind Prediction Table.........................

  windDates = {
    shortRange: [...this.getDateCurrentTo7Days().slice(0, 3)],
    longRange: [...this.getDateCurrentTo7Days().slice(3, 7)],
  };

  windSeverityData = [
    {
      severity: 'Extreme',
      class: 'severity-extreme-1',
      shortRange: [
        'Kachhwa, Pt. Deendayal Upadhyay, Chandrauti',
        'Chunar, Chandwal, Kachhwa',
        ' ',
      ],
      longRange: [' ', ' ', ' ', ' '],
    },
    {
      severity: 'High',
      class: 'severity-high-1',
      shortRange: ['Varanasi, Baragaon', ' ', ' '],
      longRange: ['Baragaon, Chandrauti', ' ', ' ', ' '],
    },
    {
      severity: 'Moderate',
      class: 'severity-moderate-1',
      shortRange: [
        'Chandwal, Chunar, Varanasi, Pt. Deendayal Upadhyay',
        ' ',
        ' ',
      ],
      longRange: [' ', ' ', ' ', ' '],
    },
  ];

  // .............Fog Prediction Table.................................
  fogDates = {
    shortRange: [...this.getDateCurrentTo7Days().slice(0, 3)],
    longRange: [...this.getDateCurrentTo7Days().slice(3, 7)],
  };
  fogSeverityData = [
    {
      severity: 'Extreme',
      class: 'severity-extreme-1',
      shortRange: ['Baragaon, Chandrauti', 'Chunar, Chandrauti', ' '],
      longRange: [' ', ' ', ' ', ' '],
    },
    {
      severity: 'High',
      class: 'severity-high-1',
      shortRange: ['Kachhwa, Varanasi, Pt. Deendayal Upadhyay', ' ', ' '],
      longRange: ['Pt. Deendayal Upadhyay, Baragaon', ' ', ' ', ' '],
    },
    {
      severity: 'Moderate',
      class: 'severity-moderate-1',
      shortRange: ['Chandwal, Chunar', ' ', ' '],
      longRange: ['Chandwal, Varanasi, Kachhwa', ' ', ' ', ' '],
    },
  ];

  // .............Humidity Prediction Table.................................
  humidityDates = {
    shortRange: [...this.getDateCurrentTo7Days().slice(0, 3)],
    longRange: [...this.getDateCurrentTo7Days().slice(3, 7)],
  };
  humiditySeverityData = [
    {
      severity: 'Extreme',
      class: 'severity-extreme-1',
      shortRange: ['Baragaon, Chandrauti', 'Chunar, Chandrauti', ' '],
      longRange: [' ', ' ', ' ', ' '],
    },
    {
      severity: 'High',
      class: 'severity-high-1',
      shortRange: ['Kachhwa, Varanasi, Pt. Deendayal Upadhyay', ' ', ' '],
      longRange: ['Pt. Deendayal Upadhyay, Baragaon', ' ', ' ', ' '],
    },
    {
      severity: 'Moderate',
      class: 'severity-moderate-1',
      shortRange: ['Chandwal', 'Chunar', ' '],
      longRange: ['Chandwal', 'Varanasi, Kachhwa', ' ', ' '],
    },
  ];
  // ----------------------------- Mapping the color to the Prediction Table ----------------------------------
  kpiToColorKey: any = {
    rainfall: 'rainfallColor',
    temperature: 'temperatureColor',
    wind: 'windColor',
    fog: 'visibilityColor',
    humidity: 'humidityColor',
  };

  addColorsToSeverityData(data: any[], kpi: string) {
    const colorKey = this.kpiToColorKey[kpi];
    return data.map((sev) => {
      const severityObj = this.severityColorBarChart.find(
        (s: any) => s.label === sev.severity
      );
      const color = severityObj ? severityObj[colorKey] : '#000000'; // fallback
      return {
        ...sev,
        color,
      };
    });
  }

  bind7DaysForecastWithColor = () => {
    this.temperatureSeverityData = this.addColorsToSeverityData(
      this.temperatureSeverityData,
      'temperature'
    );
    this.rainfallData = this.addColorsToSeverityData(
      this.rainfallData,
      'rainfall'
    );
    this.windSeverityData = this.addColorsToSeverityData(
      this.windSeverityData,
      'wind'
    );
    this.fogSeverityData = this.addColorsToSeverityData(
      this.fogSeverityData,
      'fog'
    );
    this.humiditySeverityData = this.addColorsToSeverityData(
      this.humiditySeverityData,
      'humidity'
    );
    this.cdr.detectChanges();
  };

  //  .............Tower Table Data...................

  days = this.getNext6Days();

  // ............... Bar Chart ............................................
  @HostListener('window:resize')
  onResize() {
    this.barThickness();

    //Changes By Sandeep
    this.fetchDistrictWiseKPIValues();
  }
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  barThickness = () => {
    const w = window.innerWidth;
    let thickness = 28;

    if (w < 360) thickness = 25;
    else if (w < 420) thickness = 28;
    else if (w < 512) thickness = 31;
    else if (w < 768) thickness = 35;
    else if (w < 1050) thickness = 40;
    else if (w < 1200) thickness = 45;
    else if (w < 1300) thickness = 55;
    else thickness = 60;

    //  Only update if datasets exist
    if (this.barChartData1?.datasets) {
      this.barChartData1.datasets.forEach(
        (d: any) => (d.barThickness = thickness)
      );
    }

    if (this.barChartData2?.datasets) {
      this.barChartData2.datasets.forEach(
        (d: any) => (d.barThickness = thickness)
      );
    }

    // Refresh chart only if chart exists
    this.chart?.update();
  };
  // Chart type
  public barChartType: 'bar' = 'bar';
  // Chart 1: Number of Weather Zone at Risk
  public barChartOptions1: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: {
          maxRotation: 0,
          font: {
            size:
              window.innerWidth < 425 ? 8 : window.innerWidth < 768 ? 9 : 12,
          }, // smaller font for tiny screens
        },
      },
      y: {
        min: 0,
        max: 7,
        stacked: true,
        title: {
          display: true,
          text: 'District Count',
          padding: { top: 0, bottom: 20 },
        },
        grid: { display: false },
        ticks: {
          font: {
            size:
              window.innerWidth < 425 ? 8 : window.innerWidth < 768 ? 9 : 12,
          },
        },
      },
    },
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        font: {
          weight: 'bold',
          size: window.innerWidth < 425 ? 9 : window.innerWidth < 768 ? 11 : 13,
        },
      },
      datalabels: {
        color: 'black',
        anchor: 'center',
        align: 'center',
        font: {
          weight: 'bold',
          size: window.innerWidth < 425 ? 9 : window.innerWidth < 768 ? 11 : 13,
        },
      },
    },
  };
  buildBarChartData() {
    if (!this.towerData || this.towerData.length === 0) {
      return;
    }
    const rawDay1 = this.towerData[0];
    const day1Data = [
      rawDay1.map((sev: any) => sev[2]),
      rawDay1.map((sev: any) => sev[1]),
      rawDay1.map((sev: any) => sev[0]),
    ];

    const allValues = [...day1Data[0], ...day1Data[1], ...day1Data[2]];
    const yAxisMax = Math.max(...allValues);

    this.barChartData1 = {
      labels: this.labels,
      datasets: this.severityColorBarChart
        .slice()
        .reverse()
        .map((severity: any) => {
          let data: number[] = [];
          if (severity.label === 'Moderate') {
            data = day1Data[0];
          } else if (severity.label === 'High') {
            data = day1Data[1];
          } else if (severity.label === 'Extreme') {
            data = day1Data[2];
          }

          return {
            label: severity.label,
            data: data.map((val) => (val > 0 ? val : null)), // hide zero values
            backgroundColor: this.labels.map((label: any, index: number) => {
              const key = this.labelToColorKey[label];
              return data[index] > 0
                ? severity[key] ?? '#000000'
                : 'transparent';
            }),
            categoryPercentage: 0.5,
            barPercentage: 0.5,
            barThickness: window.innerWidth < 425 ? 30 : 50,
          };
        }),
    };

    //  4. Dynamically update the chart options
    this.barChartOptions1 = {
      ...this.barChartOptions1,
      scales: {
        ...this.barChartOptions1.scales,
        y: {
          ...((this.barChartOptions1.scales &&
            this.barChartOptions1.scales['y']) ||
            {}),
          max: yAxisMax,
        },
      },
    };

    // BarChart2 can also bind to same data (example: if it's totals, you might use same mapping)
    this.barChartData2 = {
      labels: this.labels,
      datasets: this.severityColorBarChart
        .slice()
        .reverse()
        .map((severity: any) => ({
          label: severity.label,
          data:
            severity.label === 'Moderate'
              ? [168, 160, 126, 156, 246]
              : severity.label === 'High'
              ? [235, 321, 244, 235, 320]
              : [420, 342, 453, 432, 244],
          backgroundColor: this.labels.map((label: any) => {
            const key = this.labelToColorKey[label];
            return severity[key] ?? '#000000';
          }),
          categoryPercentage: 0.5,
          barPercentage: 0.5,
          barThickness: window.innerWidth < 425 ? 30 : 50,
        })),
    };

    this.cdr.detectChanges();
  }
  // Chart 2: Number of Towers at Risk
  public barChartOptions2: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: {
          maxRotation: 0,
          font: {
            size:
              window.innerWidth < 425 ? 8 : window.innerWidth < 768 ? 9 : 12,
          },
        },
      },
      y: {
        min: 0,
        max: 800,
        stacked: true,
        title: {
          display: true,
          text: 'Tower (Count)',
          padding: { top: 0, bottom: 20 },
        },
        grid: { display: false },
        ticks: {
          stepSize: 200,
          font: {
            size:
              window.innerWidth < 425 ? 8 : window.innerWidth < 768 ? 9 : 12,
          },
        },
      },
    },
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        font: {
          weight: 'bold',
          size: window.innerWidth < 425 ? 9 : window.innerWidth < 768 ? 11 : 13,
        },
      },
      datalabels: {
        color: 'black',
        anchor: 'center',
        align: 'center',
        font: {
          weight: 'bold',
          size: window.innerWidth < 425 ? 9 : window.innerWidth < 768 ? 11 : 13,
        },
      },
    },
  };
  // ----------------------------------------------------------------------------

  icons = [
    `<i class="fa-solid fa-temperature-half  "></i>`,
    `<i class="fas fa-cloud-showers-heavy"></i>`,
    `<i class="fas fa-wind">`,
    `<i class="fa-solid fa-droplet  "></i>`,
    `<i class="fa-solid fa-eye  "></i>`,
  ];

  // ------------------------ Map towerData to the required format ----------------------------------
  mappedTower = () => {
    const mappedTowerData = this.towerData.map((towerSet: any) => {
      let value: any = [];
      towerSet.map((values: any, index: any) => {
        let data = {
          value1: values[0],
          value1color: this.severityColorMap['Extreme'][this.labels[index]],
          value2: values[1],
          value2color: this.severityColorMap['High'][this.labels[index]],
          value3: values[2],
          value3color: this.severityColorMap['Moderate'][this.labels[index]],
        };
        value.push(data);
      });
      return value;
    });

    return mappedTowerData;
  };

  getSeverityClass(label: string): string {
    switch (label.toLowerCase()) {
      case 'extreme':
        return 'severity-extreme-1';
      case 'high':
        return 'severity-high-1';
      case 'moderate':
        return 'severity-moderate-1';
      default:
        return '';
    }
  }
  hazardToggleOff2 = (circle: any) => {
    let changedCircle = circle[0];
    if (changedCircle.toLowerCase() === 'UP East'.toLowerCase()) {
      this.location = 'Varanasi';
    } else if (changedCircle.toLowerCase() === 'UP West'.toLowerCase()) {
      this.location = 'Dehradun';
    } else if (changedCircle.toLowerCase() === 'North East'.toLowerCase()) {
      this.location = 'Meghalaya';
    } else {
      this.location = changedCircle;
    }
    this.location = changedCircle;
    this.fetch7daysForecastData();
  };
}
