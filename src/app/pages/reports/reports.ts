import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  AfterViewInit,
  ChangeDetectorRef,
  HostListener,
  ChangeDetectionStrategy,
  NgZone,
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
import { FormsModule } from '@angular/forms';

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
  imports: [CommonModule, NgIf, BaseChartDirective, MapWeather, FormsModule],
  templateUrl: './reports.html',
  styleUrls: ['./reports.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Reports implements OnInit {
  constructor(
    private locationService: CurrentLocationService,
    private dataService: DataService,
    private cdr: ChangeDetectorRef,
    private WeatherService: WeatherService,
    private dateTimeService: DateTimeService,
    private ngZone: NgZone
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
  responseDataHazardWise: any = {};
  selectedCircle: string = '';
  selectedCircleSeverityRange: any = {};

  legend: any;
  grouped: any = {};
  public barChartData1: any = {};
  public barChartData2: any = {};

  circleOptions: any = [];
  selectedPDFCircle: string = '';

  labels: any = [
    'Rain',
    'Wind',
    'Humidity',
    'Visibility',
    'Temp_Max',
    'Temp_Min',
  ];

  severityOrder: any = ['Extreme', 'High', 'Moderate'];
  severityColorMap: any = {};

  labelToColorKey: any = {
    Temp_Max: 'temperatureColor',
    Temp_Min: 'min_tempColor',
    Rain: 'rainfallColor',
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

  legendData: any[] = [];
  weatherData: DailyWeather[] = [];
  mappedTowerData: any;
  activeTab: string = 'rainfall';
  activeHazTab: string = 'Flood';
  hazardData: any[] = [];
  activeKPIUnit: string = ' °C';
  datesRange: string[] = [];
  datesRangeHaz: string[] = [];
  user: any = {};

  safeDetectChanges() {
    this.cdr.markForCheck();
  }

  /* Heading For 7 -dfc table */
  headingMap: Record<string, string> = {
    temperature: 'Temparture Departure - 7 Days (W.r.t to Normal) (°C)',
    rainfall: 'Rainfall Forecast - 7 Days (mm)',
    accu_rainfall: 'Accumulated Rainfall Forecast - 3 Days (mm)',
    humidity: 'Humidity Forecast - 7 Days (%)',
    wind: 'Wind Forecast - 7 Days (kmph)',
    visibility: 'Fog/Visibility Forecast - 7 Days (km)',
  };

  /* Heading For 7 -dHfc table */
  headingMapHaz: Record<string, string> = {
    Flood: 'Flood Forecast - 7 Days (Affected Area %)',
    Cyclone: 'Cyclone Forecast - 7 Days (Affected Area %)',
    Snowfall: 'Snowfall Forecast - 7 Days (Affected Area %)',
    Avalanche: 'Avalanche Forecast - 7 Days (Affected Area %)',
    Cloudburst: 'Cloudburst Forecast - 7 Days (Affected Area %)',
    Lightning: 'Lightning Forecast - 7 Days (Affected Area %)',
    Landslide: 'Landslide Forecast - 7 Days (Affected Area %)',
  };

  setActive(tab: string) {
    this.activeTab = tab;

    const unitMap: any = {
      temperature: ' °C',
      rainfall: ' mm',
      wind: ' kph',
      humidity: ' %',
      visibility: ' km',
      accu_rainfall: ' mm',
    };

    this.activeKPIUnit = unitMap[tab] ?? '';

    // Only call Accu API when needed
    if (tab === 'accu_rainfall') {
      this.fetchDistrictWiseAccu_Rainfall();
    } else {
      this.fetchDistrictWiseKPIValues();
    }

    // This always applies
    this.fetchDistrictNamesSeverityWise();
    this.getDateLabels();
  }

  setActiveHaz(tab: string) {
    this.activeHazTab = tab;
    this.fetchDistrictWiseHazardValues();
  }

  selectTab(tabNumber: number) {
    this.selectedTab = tabNumber;
  }

  ngOnInit(): void {
    const { formattedDate } = this.dateTimeService.getCurrentDateTime();
    this.currentDate = formattedDate;

    localStorage.removeItem('selectedCircle');

    let storedUser = localStorage.getItem('user');

    if (storedUser) {
      this.user = JSON.parse(storedUser);

      // Set default location
      if (
        this.user.indus_circle === 'Upper North (HP)' ||
        this.user.indus_circle === 'Upper North (JK)' ||
        this.user.indus_circle === 'Upper North (HAR)' ||
        this.user.indus_circle === 'Upper North (PUN)'
      ) {
        this.location = 'Upper North';
      } else if (this.user.indus_circle === 'All Circle') {
        this.location = 'M&G';
      } else {
        this.location = this.user.indus_circle;
      }

      // If user has no circle
      if (this.user.circle === '') {
        this.location = 'M&G';
        this.getUserCurrentLocation();
        this.safeDetectChanges();
      }
    }

    // Load dropdown (only once)
    this.loadCircleListForDropdown();

    // MAIN: Run all reports only when circle changes
    this.WeatherService.circleChangedIs$.subscribe((circle: string) => {
      if (!circle) return;

      if (
        circle === 'Upper North (HP)' ||
        circle === 'Upper North (JK)' ||
        circle === 'Upper North (HAR)' ||
        circle === 'Upper North (PUN)'
      ) {
        this.location = 'Upper North';
      } else if (circle === 'All Circle') {
        this.location = 'M&G';
      } else {
        this.location = circle;
      }

      // this.location = circle === 'All Circle' ? 'M&G' : circle;

      // All API calls ONCE
      this.fetchWeatherData();
      this.fetchSeverityKPIRanges();
      this.fetch7daysForecastData();
      this.fetchlegend_with_color();
      this.fetchDistrictNamesHazardWise();

      // Tabs refresh
      this.setActive(this.activeTab);
      this.setActiveHaz(this.activeHazTab);

      this.safeDetectChanges();
    });

    this.setActive('rainfall');
    this.setActiveHaz('Flood');
    this.fetchWeatherData();
    this.fetchSeverityKPIRanges();
    this.fetch7daysForecastData();
    this.fetchlegend_with_color();
    this.fetchDistrictNamesHazardWise();
    // this.getDateLabels();
  }

  towerData: any = [];
  // in Reports class
  fetch7daysForecastData() {
    const payload = {
      circle: this.location,
    };
    this.dataService
      .postRequest('fetch_circle_report', payload)
      // ... (omitted pipe and error handling) ...
      .subscribe((response: any) => {
        // Order of severity mapping must match your towerData order:
        const severityOrder = [
          'Rainfall',
          'Wind',
          'Humidity',
          'Visibility',
          'Temperature_Max',
          'Temperature_Min',
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

        // ➡️ CRITICAL ADDITION: If severity ranges are already loaded, run the chart/table logic now.
        if (this.selectedCircleSeverityRange) {
          this.populateSeverityTable();
          this.buildBarChartData();
          this.bind7DaysForecastWithColor();
        }
        // ⬅️ CRITICAL ADDITION END

        // after towerData is ready
        this.setActive(this.activeTab); // this calls fetchDistrictWiseKPIValues()
        this.fetchDistrictNamesSeverityWise();
        this.safeDetectChanges();
      });
  }

  /* Legend colour and range assign */
  fetchlegend_with_color() {
    const payload = { circle: this.location };
    this.dataService
      .postRequest('fetch_kpi_legend_with_color', payload)
      .subscribe({
        next: (res: any) => {
          if (res?.status === 'success') {
            this.legendData = res.data;
            const color = res.data.color;

            if (color) {
              document.documentElement.style.setProperty(
                '--extreme-color',
                color.extreme_color
              );
              document.documentElement.style.setProperty(
                '--high-color',
                color.high_color
              );
              document.documentElement.style.setProperty(
                '--moderate-color',
                color.moderate_color
              );
              document.documentElement.style.setProperty(
                '--low-color',
                color.low_color
              );

              /* For Putting Min Colours */
              document.documentElement.style.setProperty(
                '--min-extreme-color',
                color?.extreme_min_color ?? '#ff0000'
              );

              document.documentElement.style.setProperty(
                '--min-high-color',
                color?.high_min_color ?? '#FFA500'
              );

              document.documentElement.style.setProperty(
                '--min-moderate-color',
                color?.moderate_min_color ?? '#eeff00'
              );

              document.documentElement.style.setProperty(
                '--min-low-color',
                color?.low_min_color ?? '#edfdef'
              );
            } else {
              console.error('❌ Color object missing in API response');
            }

            this.safeDetectChanges();
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
      const payload = { circle: this.location };

      // 🚀 Run API + mapping outside Angular to avoid UI blocking
      this.ngZone.runOutsideAngular(() => {
        this.dataService
          .postRequest('/fetch_district_wise_KPI_values', payload)
          .pipe(
            catchError((error: any) => {
              console.error(error?.error?.message || 'Internal Server Error');
              return throwError(() => error);
            })
          )
          .subscribe({
            next: (response: any) => {
              if (!response) return;

              const kpidata = response[0]?.district_wise_kpi_values ?? [];

              // ⭐ Config for mapping fields based on active tab
              const config: any = {
                temperature: {
                  value: 'temp_max',
                  severity: 'temp_max_severity',
                  minValue: 'temp_min',
                  minSeverity: 'temp_min_severity',
                  includeMin: true,
                },
                rainfall: { value: 'rain_precip', severity: 'rain_severity' },
                humidity: { value: 'humidity', severity: 'humidity_severity' },
                visibility: {
                  value: 'visibility',
                  severity: 'visibility_severity',
                },
                wind: { value: 'wind', severity: 'wind_severity' },
              };

              const cfg = config[this.activeTab];
              if (!cfg) return;

              // ⭐ Fast severity-color lookup (no DOM, lightweight)
              const severityColors: any = {
                Extreme: getComputedStyle(document.documentElement)
                  .getPropertyValue('--extreme-color')
                  .trim(),
                High: getComputedStyle(document.documentElement)
                  .getPropertyValue('--high-color')
                  .trim(),
                Moderate: getComputedStyle(document.documentElement)
                  .getPropertyValue('--moderate-color')
                  .trim(),
                Low: getComputedStyle(document.documentElement)
                  .getPropertyValue('--low-color')
                  .trim(),
              };

              // 🚀 Heavy data mapping (completely outside Angular)
              const result = kpidata.map((ele: any) => {
                const row: any = { district: ele.district };

                for (let i = 1; i <= 7; i++) {
                  const day = `day${i}`;

                  // Max/Primary KPI
                  row[`day${i}`] = ele[day][cfg.value];
                  row[`day${i}_severity`] = ele[day][cfg.severity];
                  row[`day${i}_color`] = severityColors[ele[day][cfg.severity]];

                  // Min KPI (Temperature only)
                  if (cfg.includeMin) {
                    row[`min${i}`] = ele[day][cfg.minValue];
                    row[`min${i}_severity`] = ele[day][cfg.minSeverity];
                    row[`min${i}_color`] =
                      severityColors[ele[day][cfg.minSeverity]];
                  }
                }
                return row;
              });

              // 🟢 Only now update Angular UI
              this.ngZone.run(() => {
                this.responseDataDistrictWise = result;
                this.safeDetectChanges(); // markForCheck
              });
            },

            error: (err) => {
              this.ngZone.run(() => console.error(err));
            },
          });
      });
    } catch (error) {
      console.error(error);
    }
  };

  fetchDistrictWiseAccu_Rainfall = () => {
    // if (this.activeTab !== 'accu_rainfall') return;

    const payload = { circle: this.location };

    this.dataService
      .postRequest('/fetch_accumulated_rainfall', payload)
      .pipe(
        catchError((error: any) => {
          console.error(error?.error?.message || 'Internal Server Error');
          return throwError(() => error);
        })
      )
      .subscribe({
        next: (response: any) => {
          const kpidata = response?.data || [];
          this.responseDataDistrictWise = [];
          this.responseDataDistrictWise = kpidata.map((ele: any) => ({
            district: ele.district,
            day1: ele.acc_1_to_3,
            day2: ele.acc_2_to_4,
            day3: ele.acc_3_to_5,
            day1_severity: ele.acc_1_to_3_severity,
            day2_severity: ele.acc_2_to_4_severity,
            day3_severity: ele.acc_3_to_5_severity,
          }));

          this.safeDetectChanges();
        },

        error: (err: any) => {
          console.error('Error fetching accumulated rainfall', err);
        },
      });
  };

  fetchDistrictNamesSeverityWise = () => {
    try {
      const payload = { circle: this.location };

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
            if (response) {
              this.responseDataSeverityWise = {
                Rainfall: response.Rainfall?.day1,
                Temperature_Max: response.Temperature_Max?.day1,
                Temperature_Min: response.Temperature_Min?.day1,
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

  fetchDistrictNamesHazardWise = () => {
    try {
      const payload = { circle: this.location };

      this.dataService
        .postData('get-hazard-affected-district', payload)
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
            if (response?.data) {
              const d = response.data[0];

              this.responseDataHazardWise = {
                Avalanche: {
                  extreme: d.Avalanche?.Extreme || [],
                  high: d.Avalanche?.High || [],
                  moderate: d.Avalanche?.Moderate || [],
                  low: d.Avalanche?.Low || [],
                },
                Cloudburst: {
                  extreme: d.Cloudburst?.Extreme || [],
                  high: d.Cloudburst?.High || [],
                  moderate: d.Cloudburst?.Moderate || [],
                  low: d.Cloudburst?.Low || [],
                },
                Cyclone: {
                  extreme: d.Cyclone?.Extreme || [],
                  high: d.Cyclone?.High || [],
                  moderate: d.Cyclone?.Moderate || [],
                  low: d.Cyclone?.Low || [],
                },
                Flood: {
                  extreme: d.Flood?.Extreme || [],
                  high: d.Flood?.High || [],
                  moderate: d.Flood?.Moderate || [],
                  low: d.Flood?.Low || [],
                },
                Lightning: {
                  extreme: d.Lightning?.Extreme || [],
                  high: d.Lightning?.High || [],
                  moderate: d.Lightning?.Moderate || [],
                  low: d.Lightning?.Low || [],
                },
                Snowfall: {
                  extreme: d.Snowfall?.Extreme || [],
                  high: d.Snowfall?.High || [],
                  moderate: d.Snowfall?.Moderate || [],
                  low: d.Snowfall?.Low || [],
                },
              };

              // console.log(
              //   'Final hazard-wise severity:',
              //   this.responseDataHazardWise
              // );
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

  /* Load Circle list dropdown */
  async loadCircleListForDropdown() {
    try {
      const userRole = this.user.userrole;
      const userCircle = this.user.indus_circle;

      // If normal user → show only their circle, skip API
      if (!['Admin', 'MLAdmin'].includes(userRole)) {
        this.circleOptions = [
          {
            value: userCircle,
            label: userCircle,
          },
        ];
        this.safeDetectChanges();
        return;
      }

      // Admin / MLAdmin → fetch full list
      const apiPayload = { circle: 'All Circle' };

      const res: any = await this.dataService
        .postData('get_circle_list', apiPayload)
        .toPromise();

      if (res?.status && Array.isArray(res?.data)) {
        this.circleOptions = res.data
          .filter((item: any) => item.circle !== 'All Circle')
          .map((item: any) => ({
            value: item.location,
            label: item.circle,
          }))
          .sort((a: any, b: any) => a.label.localeCompare(b.label));
      } else {
        console.error('Invalid API response for circle list');
        this.circleOptions = [];
      }

      this.safeDetectChanges();
    } catch (error) {
      console.error('❌ Failed to load circle list:', error);
      this.circleOptions = [];
    }
  }

  /* pdf download */
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
      .subscribe((res: any) => {
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
      const kpiData = this.grouped[key];
      const kpiColors =
        key === 'min_temp' ? this.grouped['min_color'] : this.grouped['color'];

      this.severityTable[0][key] = kpiData.extreme;
      this.severityTable[0][`${key}Color`] = kpiColors?.extremeColor;
      this.severityColorBarChart[0][`${key}Color`] = kpiColors?.extremeColor;

      this.severityTable[1][key] = kpiData.high;
      this.severityTable[1][`${key}Color`] = kpiColors?.highColor;
      this.severityColorBarChart[1][`${key}Color`] = kpiColors?.highColor;

      this.severityTable[2][key] = kpiData.moderate;
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
    this.mappedTowerData = towerData;
    this.safeDetectChanges();
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
      date.setDate(date.getDate() + i + 1);
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

    for (let i = 0; i < 6; i++) {
      const dateObj = new Date();
      dateObj.setDate(dateObj.getDate() + i + 1);

      const day = dayNames[dateObj.getDay()];
      const date = dateObj.getDate();
      const month = monthNames[dateObj.getMonth()];
      const year = dateObj.getFullYear();

      daysArr.push({
        name: day,
        date: `${date} ${month}, ${year}`, // ← formatted here
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

            this.safeDetectChanges();
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

  // -- Functions for getting date  in array
  getDateLabels(): string[] {
    const today = new Date();
    this.datesRange = [];

    if (this.activeTab === 'accu_rainfall') {
      for (let i = 0; i < 3; i++) {
        const start = new Date(today);
        const end = new Date(today);

        start.setDate(today.getDate() + i);
        end.setDate(today.getDate() + i + 2);
        this.datesRange.push(
          `${this.formatShortDate(start)} to ${this.formatShortDate(end)}`
        );
      }
    } else {
      // Normal single dates
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        this.datesRange.push(this.formatShortDate(d));
      }
    }

    return this.datesRange;
  }

  formatShortDate(d: Date): string {
    const day = d.getDate();
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.toLocaleDateString('en-Us', { year: 'numeric' });
    return `${day} ${month}, ${year}`;
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
    this.safeDetectChanges();
  };

  //  .............Tower Table Data...................

  days = this.getNext6Days();

  // ............... Bar Chart ............................................
  @HostListener('window:resize')
  onResize() {
    this.fetchDistrictWiseKPIValues();
    this.barThickness();
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
    const labelsData = [
      'Rainfall',
      'Wind',
      'Humidity',
      'Visibility',
      'Temp (max)',
      'Temp (min)',
    ];
    if (!this.towerData || this.towerData.length === 0) {
      return;
    }
    const rawDay1 = this.towerData[0];
    const day1Data = [
      rawDay1.map((sev: any) => sev[2]),
      rawDay1.map((sev: any) => sev[1]),
      rawDay1.map((sev: any) => sev[0]),
    ];

    const columnsSum = new Array(day1Data[0].length).fill(0);
    day1Data.forEach((row) => {
      row.forEach((value: number, index: number) => {
        columnsSum[index] += value;
      });
    });
    const yAxisMax = Math.max(...columnsSum);

    this.barChartData1 = {
      labels: labelsData,
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
    // this.barChartData2 = {
    //   labels: this.labels,
    //   datasets: this.severityColorBarChart
    //     .slice()
    //     .reverse()
    //     .map((severity: any) => ({
    //       label: severity.label,
    //       data:
    //         severity.label === 'Moderate'
    //           ? [168, 160, 126, 156, 246]
    //           : severity.label === 'High'
    //           ? [235, 321, 244, 235, 320]
    //           : [420, 342, 453, 432, 244],
    //       backgroundColor: this.labels.map((label: any) => {
    //         const key = this.labelToColorKey[label];
    //         return severity[key] ?? '#000000';
    //       }),
    //       categoryPercentage: 0.5,
    //       barPercentage: 0.5,
    //       barThickness: window.innerWidth < 425 ? 30 : 50,
    //     })),
    // };
    // this.safeDetectChanges();
  }

  // Chart 2: Number of Towers at Risk
  // public barChartOptions2: ChartOptions<'bar'> = {
  //   responsive: true,
  //   maintainAspectRatio: false,
  //   scales: {
  //     x: {
  //       stacked: true,
  //       grid: { display: false },
  //       ticks: {
  //         maxRotation: 0,
  //         font: {
  //           size:
  //             window.innerWidth < 425 ? 8 : window.innerWidth < 768 ? 9 : 12,
  //         },
  //       },
  //     },
  //     y: {
  //       min: 0,
  //       max: 800,
  //       stacked: true,
  //       title: {
  //         display: true,
  //         text: 'Tower (Count)',
  //         padding: { top: 0, bottom: 20 },
  //       },
  //       grid: { display: false },
  //       ticks: {
  //         stepSize: 200,
  //         font: {
  //           size:
  //             window.innerWidth < 425 ? 8 : window.innerWidth < 768 ? 9 : 12,
  //         },
  //       },
  //     },
  //   },
  //   plugins: {
  //     legend: { display: false },
  //     title: {
  //       display: true,
  //       font: {
  //         weight: 'bold',
  //         size: window.innerWidth < 425 ? 9 : window.innerWidth < 768 ? 11 : 13,
  //       },
  //     },
  //     datalabels: {
  //       color: 'black',
  //       anchor: 'center',
  //       align: 'center',
  //       font: {
  //         weight: 'bold',
  //         size: window.innerWidth < 425 ? 9 : window.innerWidth < 768 ? 11 : 13,
  //       },
  //     },
  //   },
  // };
  // ----------------------------------------------------------------------------

  icons = [
    `<i class="fas fa-cloud-showers-heavy"></i>`,
    `<i class="fas fa-wind">`,
    `<i class="fa-solid fa-droplet  "></i>`,
    `<i class="fa-solid fa-eye  "></i>`,
    `<i class="fa-solid fa-temperature-half  "></i>`,
    `<i class="fa-solid fa-temperature-half  "></i>`,
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

  //.....................get-district-wise-hazards..................................................

  fetchDistrictWiseHazardValues = () => {
    const payload = { circle: this.location, hazardType: this.activeHazTab };
    this.dataService
      .postRequest('/get-district-wise-hazards', payload)
      .subscribe({
        next: (res: any) => {
          if (res?.status === 'success') {
            this.hazardData = res.data;
            this.safeDetectChanges();
          }
        },
        error: (err) => console.error('Hazard load failed:', err),
      });
  };
}
