import {
  Component,
  AfterViewInit,
  ChangeDetectorRef,
  EventEmitter,
  Output,
  Input,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
  NgZone,
} from '@angular/core';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import { Extent } from 'ol/extent';
import { fromLonLat } from 'ol/proj';
import { Geometry } from 'ol/geom';
import Feature, { FeatureLike } from 'ol/Feature';
import { Draw } from 'ol/interaction';
import GeoJSON from 'ol/format/GeoJSON';
import Point from 'ol/geom/Point';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Style, Fill, Stroke, Text, Icon } from 'ol/style';
import Overlay from 'ol/Overlay';
import { HttpClient } from '@angular/common/http';
import { DataService } from '../../data-service/data-service';
import { CommonModule } from '@angular/common';
import html2canvas from 'html2canvas';
import { WeatherService } from '../../services/weather';
import { FullScreen, Zoom } from 'ol/control';
import { defaults as olDefaultControls } from 'ol/control/defaults';
import { transform } from 'ol/proj';
import * as turf from '@turf/turf';
import { firstValueFrom } from 'rxjs';
import LayerGroup from 'ol/layer/Group';
import { WindGridService } from '../../services/wind-grid';
import { WindOverlay } from '../../services/wind-overlay';
import { CacheService } from '../../services/cache.service';

declare const ol: any;
declare var bootstrap: any;

@Component({
  selector: 'app-map-weather',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './map-weather.html',
  styleUrl: './map-weather.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapWeather implements AfterViewInit {
  //#region Component Contract
  @ViewChild('screenshotContainer', { static: false })
  screenshotContainer!: ElementRef;
  @ViewChild('towerListRef') towerListRef!: ElementRef;
  @ViewChild('dropdownBtn') dropdownBtn!: ElementRef;
  @Output() callParentFun = new EventEmitter<void>();
  @Output() callParentFun2 = new EventEmitter<void>();
  @Input() disableZoomOnIDW: boolean = false;
  //#endregion

  callParentFunction() {
    this.callParentFun.emit();
  }

  callParentFunction2(circleName: any) {
    this.callParentFun2.emit(circleName);
  }

  //#region Component Setup And State
  public selectedCircle: string = '';
  isServicesCall: boolean = true;
  isProcessing: boolean = false;
  logo_path: string = '../../../assets';
  screenshotData: any[] = [];
  currentDate: string = '';
  currentTime: string = '';
  currentDistrict: string = '';
  isTowersSelected: boolean = false;
  userGroupedRoleWise: any = [];
  groupedTowerArray: any[] = [];
  towerGroupedByDistrict: { [district: string]: any[] } = {};
  lassoDraw: Draw | null = null;
  popupElement!: HTMLElement;
  popupContent!: HTMLElement;
  popupCloser!: HTMLElement;
  popupOverlay!: any;
  map!: Map;
  isSearchLoading: boolean = false;
  currentCropFilter: any = null;
  timelineSpeed: number = 3000;

  public riskData: any = {
    Rain: {
      VeryHeavy: { Name: 0, State: 0 },
      Heavy: { Name: 0, State: 0 },
      Moderate: { Name: 0, State: 0 },
    },

    Temperature: {
      VeryHeavy: { Name: 0, State: 0 },
      Heavy: { Name: 0, State: 0 },
      Moderate: { Name: 0, State: 0 },
    },

    Wind: {
      VeryHeavy: { Name: 0, State: 0 },
      Heavy: { Name: 0, State: 0 },
      Moderate: { Name: 0, State: 0 },
    },
  };

  currentData: any = null;
  nextData: any = null;
  isPreparing = false;

  isIDWSelected: boolean = false;
  hours: number[] = Array.from({ length: 24 }, (_, i) => i);
  selectedHour: number = new Date().getHours();
  selectedWetherAPISource: string = '';
  isRainIDWLayer: boolean = false;

  indusBNDGeoJSON: any = null; //For Crop feature
  selectedCircleBND: any = null; // For Crop feature

  // radio options
  days = [
    { label: 'Today', value: 'today' },
    { label: 'Tomorrow', value: 'tomorrow' },
  ];

  // Change Detection Safe
  safeDetectChanges() {
    this.cdr.markForCheck();
  }

  // default selection
  selectedDay: string = 'today';

  isCircleLabelClicked: boolean = false;
  selectedHourIndex = 0;
  async selectHour(hour: number) {
    this.selectedHourIndex = this.hours.indexOf(hour);
    this.selectedHour = hour;
    await this.generateRegionWiseWeatherIDW();
  }

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
    private readonly dataService: DataService,
    private readonly WeatherService: WeatherService,
    private readonly ngZone: NgZone,
    private readonly windGridService: WindGridService,
    private readonly cacheService: CacheService,
  ) {
    // Listen for source load completion
  }

  get logId(): string | null {
    return localStorage.getItem('logId');
  }
  weatherApiData: any = {};
  isShowLegend: boolean = true;
  newtowerSource = new VectorSource();
  highlightedFeature: any = null;

  autoPlayInterval: any;
  isPaused: boolean = false;

  showZoneListDropdown: boolean = false;
  towerWeatherInfo: {
    [key: string]: {
      name: string;
      state: string;
      lat: string;
      lon: string;
      dewPoint: string;
      feelsLikeTemp: string;
      gust: string;
      heatIndex: string;
      humidity: string;
      precip: string;
      pressure: string;
      temp: string;
      uv: string;
      visibility: string;
      windDir: string;
      windSpeed: string;
      windChill: string;
      cloud: string;
      condition: string;
      dataTimeStamp: string;
    };
  } = {};

  zoneArray: any[] = ['All', 'East', 'West', 'North', 'South'];
  selectedZoneArray: any[] = [];
  //#endregion

  //#region Map Sources And Layers
  // Source of Indus Boundary
  indusBNDVectorSource: any = new VectorSource();

  // Source of District
  districtVectorSource: any = new VectorSource();

  // Source of Circle
  circleVectorSource: any = new VectorSource();

  //Source of Hazard
  hazardVectorSource: any = new VectorSource();

  // Source of Weather_location
  Weather_LocationsVectorSource: any = new VectorSource({
    url: 'https://mlinfomap.org/geoserver/Indus_Tower/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Indus_Tower%3Aweather_locations&outputFormat=application%2Fjson&maxFeatures=10000',
    format: new GeoJSON(),
  });

  //Layer of BND of Circle AT India Level
  indusBNDVectorLayer: any = new VectorLayer({
    properties: {
      title: 'Indus Boundary',
      legendFixed: true,
    },
    style: (feature) => this.styleFunctionBoundaryLayer(feature),
    source: this.indusBNDVectorSource,
  });

  //Layer of District
  districtVectorLayer: any = new VectorLayer({
    properties: {
      title: 'Districts',
      legendFixed: true,
    },
    style: (feature) => this.styleFunctionDistrictLayer(feature),
    source: this.districtVectorSource,
  });

  //Layer of hazard
  hazardVectorLayer: any = new VectorLayer({
    source: this.hazardVectorSource,
    properties: {
      title: 'Hazard Prop Layer',
    },
    style: (feature) => this.styleFunction(feature),
  });

  hazardGroupLayer: any = new LayerGroup({
    layers: [],
    properties: {
      title: 'Hazard Layer',
    },
  });

  //Layer of Circle
  circleVectorLayer = new VectorLayer({
    source: this.circleVectorSource,
    style: (feature) => this.styleFunctionCircleLayer(feature),
    properties: {
      title: 'Circles',
      legendFixed: true,
    },
  });

  //Layer of Weather_Locations
  Weather_LocationsVectorLayer = new VectorLayer({
    source: this.Weather_LocationsVectorSource,
    // visible: false,
    style: (feature) => this.styleFunctionWeather_LocationsLayer(feature),
    properties: {
      title: 'Weather Locations',
      legendFixed: true,
    },
  });
  //#endregion

  //#region Map Styles
  styleFunctionCircleLayer = (feature: any) => {
    const circleName = feature.get('indus_circle') || '';
    const zoom: any = this.map.getView().getZoom();

    const baseStyle = new Style({
      stroke: new Stroke({ color: '#0507abff', width: 1.25 }),
    });

    if (zoom >= 8) {
      return baseStyle;
    }

    // Show label only once
    const all = this.circleVectorSource.getFeatures();

    const firstFeature = all.find(
      (f: any) => f.get('indus_circle') === circleName,
    );

    if (!firstFeature || feature.getId() !== firstFeature.getId()) {
      return baseStyle;
    }

    const geom = feature.getGeometry();
    let center;

    if (geom.getType() === 'Polygon') {
      center = geom.getInteriorPoint().getCoordinates();
    } else if (geom.getType() === 'MultiPolygon') {
      const polys = geom.getPolygons();
      let largest = polys[0];
      let maxArea = polys[0].getArea();

      polys.forEach((p: any) => {
        const area = p.getArea();
        if (area > maxArea) {
          largest = p;
          maxArea = area;
        }
      });

      center = largest.getInteriorPoint().getCoordinates();
    } else {
      center = geom.getExtent();
    }

    const fontSize = Math.max(8, zoom * 3);

    const textStyle = new Style({
      geometry: new Point(center),
      text: new Text({
        text: circleName.toUpperCase(),
        font: `900 ${fontSize}px Calibri, sans-serif`,
        fill: new Fill({ color: '#000' }),
        stroke: new Stroke({ color: '#fff', width: Math.max(1, fontSize / 5) }),
        overflow: true,
      }),
    });

    return [baseStyle, textStyle];
  };

  styleFunctionDistrictLayer = (feature: any) => {
    const districtName =
      feature.get('district') || feature.get('SITE_NAME') || 'Unknown';

    const zoom: any = this.map.getView().getZoom();

    const baseStyle = new Style({
      stroke: new Stroke({ color: '#10623bff', width: 0.6 }),
      fill: new Fill({ color: 'rgba(255, 255, 255, 0.01)' }),
    });

    if (zoom <= 8) {
      return baseStyle;
    }

    const allFeatures = this.districtVectorSource.getFeatures();
    const firstFeature = allFeatures.find(
      (f: any) => (f.get('district') || f.get('SITE_NAME')) === districtName,
    );

    if (!firstFeature || firstFeature.getId() !== feature.getId()) {
      return baseStyle;
    }

    const geom = feature.getGeometry();
    let center: number[];

    if (!geom) return baseStyle;

    const type = geom.getType();

    if (type === 'Polygon') {
      center = geom.getInteriorPoint().getCoordinates();
    } else if (type === 'MultiPolygon') {
      const polys = geom.getPolygons();
      let largest = polys[0];
      let maxArea = polys[0].getArea();

      polys.forEach((p: any) => {
        const area = p.getArea();
        if (area > maxArea) {
          largest = p;
          maxArea = area;
        }
      });

      center = largest.getInteriorPoint().getCoordinates();
    } else {
      return baseStyle;
    }

    let rain: number | undefined = undefined;
    if (this.isRainIDWLayer) {
      rain = this.districtTempMap[districtName.toLowerCase().trim()];
    }
    const label =
      rain !== undefined ? `${districtName}\n${rain} mm` : districtName;

    const textStyle = new Style({
      geometry: new Point(center),
      text: new Text({
        text: `${label}`,
        font: `600 14px "Segoe UI", Arial, sans-serif`,
        textAlign: 'center',
        overflow: true,
        fill: new Fill({ color: '#000000' }),
        stroke: new Stroke({
          color: '#ffffff',
          width: 6,
        }),
        offsetY: -1,
      }),
    });

    return [baseStyle, textStyle];
  };

  styleFunctionWeather_LocationsLayer = (feature: any) => {
    return new Style({
      image: new Icon({
        src: 'assets/icons/Weather_Locations.png',
        scale: 0.02,
        anchor: [0.5, 1],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
      }),
    });
  };

  styleFunctionBoundaryLayer = (feature: any) => {
    const style: any = new Style({
      stroke: new Stroke({ color: '#af10eeff', width: 1.5 }),
    });

    return style;
  };

  // Style of Vector layer
  styleFunction(feature: any) {
    const severity = feature.get('severity');

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

    return new Style({
      fill: new Fill({ color: `${fillColor}90` }),
      stroke: new Stroke({ color: '#10623bff', width: 1 }),
    });
  }

  clearDistrictHighlight() {
    if (this.highlightedFeature) {
      try {
        this.highlightedFeature.setStyle(null); // remove highlight style
      } catch (e) {}

      this.highlightedFeature = null;
    }

    // Force redraw
    try {
      this.districtVectorLayer.changed();
      this.map.render();
    } catch {}
  }
  //#endregion

  //#region Filter State And Weather Assets
  circleOptions: { value: string; label: string }[] = [];
  allCircleFeatures: any[] = [];
  allDistrictFeatures: Feature<Geometry>[] = [];
  allWeather_LocationsFeatures: Feature<Geometry>[] = [];
  showCircleListDropdown: boolean = false;
  zoneWiseState: { [zone: string]: string[] } = {
    East: ['Kolkata', 'Bhubaneswar', 'Patna', 'Guwahati'],
    West: ['Mumbai', 'Ahmedabad', 'Pune', 'Jaipur'],
    North: ['Delhi', 'Chandigarh', 'Lucknow', 'Dehradun'],
    South: ['Chennai', 'Bangalore', 'Hyderabad', 'Thiruvananthapuram'],
  };

  isIDWLayer: boolean = false;
  circleArray: any[] = [];
  selectedCircleArray: any[] = [];

  // Changes
  indiaExtent: any = [
    7582002.800582195, 901766.9151203264, 9739224.237484924, 4446120.279604534,
  ];
  initialCenter = fromLonLat([80.8320187, 22.4463565]);
  initialZoom = 4;

  minTemp: any;
  minRain: any;
  minWind: any;
  minHumidity: any;
  minFog: any;

  maxTemp: any;
  maxRain: any;
  maxWind: any;
  maxHumidity: any;
  maxFog: any;

  minRange: any;
  maxRange: any;

  isHazardlayer: boolean = false;
  isPanIndiaClicked: boolean = false;
  private windOverlay: any;

  loading = false; // Loader flag

  towerIconUrl = 'assets/icons/tower.svg'; // or your own SVG

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

  features: any = [];

  vectorSourceTemp = new ol.source.Vector({});
  vectorSourceRain = new ol.source.Vector({});
  vectorSourceWind = new ol.source.Vector({});
  vectorSourceHumidity = new ol.source.Vector({});
  vectorSourceFog = new ol.source.Vector({});

  user: any = {};

  imgIDWTempLayer = new ol.layer.Image({
    title: 'Temperature',
    id: 'TempIDW',
    // source: this.idw,
    opacity: 0.6,
    visible: false,
  });

  imgIDWRainFallLayer = new ol.layer.Image({
    title: 'Rainfall',
    id: 'RainIDW',
    opacity: 0.6,
    visible: false,
  });

  imgIDWWindLayer = new ol.layer.Image({
    title: 'Wind',
    id: 'WindIDW',
    //source: this.idw,
    opacity: 0.6,
    visible: false,
  });

  imgIDWHumidityLayer = new ol.layer.Image({
    title: 'Humidity',
    id: 'HumidityIDW',
    //source: this.idw,
    opacity: 0.6,
    visible: false,
  });

  imgIDWFogLayer = new ol.layer.Image({
    title: 'Visibility',
    id: 'FogIDW',
    //source: this.idw,
    opacity: 0.6,
    visible: false,
  });

  imgIDWLayers = [
    {
      layer: this.imgIDWTempLayer,
      source: this.vectorSourceTemp,
      label: 'Temp ',
    },
    {
      layer: this.imgIDWRainFallLayer,
      source: this.vectorSourceRain,
      label: 'Rain ',
    },
    {
      layer: this.imgIDWHumidityLayer,
      source: this.vectorSourceHumidity,
      label: 'Humidity ',
    },
    { layer: this.imgIDWFogLayer, source: this.vectorSourceFog, label: 'Fog ' },
    {
      layer: this.imgIDWWindLayer,
      source: this.vectorSourceWind,
      label: 'Wind ',
    },
  ];

  hazardMapIcon = [
    { label: 'Flood', icon: 'assets/icons/flood.svg' },
    { label: 'Thunderstorm', icon: 'assets/icons/thunderstorm.svg' },
    { label: 'Rain', icon: 'assets/icons/rainfall.svg' },
    { label: 'Lightning', icon: 'assets/icons/lightning.svg' },
    { label: 'Landslide', icon: 'assets/icons/landslide.svg' },
    { label: 'Avalanche', icon: 'assets/icons/landslide.svg' },
    { label: 'Fog', icon: 'assets/icons/fog.svg' },
    { label: 'Snowfall', icon: 'assets/icons/snowfall.svg' },
    { label: 'Heat Wave', icon: 'assets/icons/heat-wave.svg' },
    { label: 'Cold Wave', icon: 'assets/icons/cold-wave.svg' },
    { label: 'Earthquake', icon: 'assets/icons/earthquake.svg' },
  ];

  getHazardIcon(category: string): string {
    const found = this.hazardMapIcon.find((h) => h.label === category);
    return found ? found.icon : '';
  }
  //#endregion

  //#region Lifecycle
  async ngAfterViewInit(): Promise<void> {
    this.filterCircleData();
    this.popupElement = document.getElementById('popup') as HTMLElement;
    this.popupContent = document.getElementById('popup-content') as HTMLElement;
    this.popupCloser = document.getElementById('popup-closer') as HTMLElement;

    this.popupOverlay = new Overlay({
      element: this.popupElement,
      autoPan: { animation: { duration: 250 } },
    });
    // this.map.addOverlay(this.popupOverlay);

    this.popupCloser.onclick = () => {
      this.popupOverlay.setPosition(undefined);
      this.popupCloser.blur();
      return false;
    };

    this.map.addOverlay(this.popupOverlay);

    // Handle close button click
    this.popupCloser?.addEventListener('click', () => {
      this.popupOverlay.setPosition(undefined);
    });

    this.safeDetectChanges();
  }

  async ngOnInit(): Promise<void> {
    const storedUser = localStorage.getItem('user');

    if (storedUser) {
      this.user = JSON.parse(storedUser);
      this.selectedCircle = this.user.indus_circle;
      await this.initializeMap();
      await this.loadCircleListForDropdown();
    }

    const circleClicked = localStorage.getItem('circleClicked');
    if (circleClicked) {
      const clicked = JSON.parse(circleClicked);
      this.WeatherService.setCircleLabelClicked(clicked);
    }

    this.WeatherService.circleChangedIs$.subscribe(async (circleArray: any) => {
      if (circleArray.length === 0) {
        return;
      }
      this.isServicesCall = false;
      this.selectedCircle = circleArray[0]?.label;
      await this.callGeoJSONAPI();
      // await this.cropHeatMapByBoundary();
      await this.generateRegionWiseWeatherIDW();
    });

    this.WeatherService.circleLabelClicked$.subscribe((clicked: boolean) => {
      this.isCircleLabelClicked = clicked;
      this.clearSearchMarker();
      this.safeDetectChanges();
    });

    this.WeatherService.panIndia$.subscribe((location: string) => {
      if (!location || this.selectedCircle) {
        return;
      }
      if (location) {
        this.isPanIndiaClicked = true;
        const existing = this.map
          .getLayers()
          .getArray()
          .find((l: any) => l.id === 'circle-layer');
        if (existing) {
          this.map.removeLayer(existing);
        }
        this.zoomOnLocationSearch(location);
      } else {
        // this.showSelectedDistrictOnMap([`${this.user.circle}`]);
        this.isPanIndiaClicked = false;
      }
    });

    this.WeatherService.searchLocation$.subscribe((location: string) => {
      if (location) {
        this.zoomOnLocationSearch(location);
      }
    });
    this.clearSearchMarker();

    this.WeatherService.selectedSource$.subscribe((source: string) => {
      if (source) {
        this.selectedWetherAPISource = source;
      } else {
        this.selectedWetherAPISource = 'weather_api';
      }
    });

    this.WeatherService.districtHighlight$.subscribe((district) => {
      if (district) {
        this.highlightDistrict(district);
      }
    });

    this.circleVectorLayer.setStyle(this.styleFunctionCircleLayer);
    if (this.isServicesCall) {
      await this.callGeoJSONAPI();
    }

    // For prepare the wind overlay faster
    await this.generateRegionWiseWeatherIDW();

    this.safeDetectChanges();
  }

  ngOnDestroy() {
    if (this.autoPlayInterval) {
      clearInterval(this.autoPlayInterval);
    }
    this.windOverlay?.destroy();
    this.windOverlay = null as any; // important: allow recreate path
  }
  //#endregion

  //#region Search And Selection
  highlightDistrict(districtName: string) {
    if (!districtName) {
      return;
    }

    const normalize = (s: any) =>
      (s || '')
        .toString()
        .normalize('NFKD') // remove accents if any
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    const tryHighlight = () => {
      const source = this.districtVectorLayer.getSource();
      if (!source) {
        console.warn('districtVectorLayer source not ready');
        return;
      }

      const features = source.getFeatures();
      if (!features || features.length === 0) {
        console.warn('No district features available yet');
        return;
      }

      // Clear old highlight
      if (this.highlightedFeature) {
        try {
          this.highlightedFeature.setStyle(null);
        } catch (e) {
          // ignore
        }
        this.highlightedFeature = null;
      }

      const needle = normalize(districtName);
      let matched: any = null;
      // Collect some debug info to help if no match found
      const debugList: string[] = [];

      for (const f of features) {
        const candidates = [
          f.get('DIST_NAME'),
          f.get('district'),
          f.get('SITE_NAME'),
          f.get('name'),
          f.get('district_name'),
          f.get('DISTRICT'),
        ];
        const combined = candidates.filter(Boolean).join(' | ');
        debugList.push(combined);

        // Check each candidate field for normalized substring match
        for (const c of candidates) {
          if (!c) continue;
          if (
            normalize(c) === needle ||
            normalize(c).includes(needle) ||
            needle.includes(normalize(c))
          ) {
            matched = f;
            break;
          }
        }
        if (matched) break;
      }

      if (!matched) {
        console.warn(
          `highlightDistrict: no matching district found for "${districtName}".\n` +
            `Tryable names (sample first 10):\n` +
            debugList
              .slice(0, 10)
              .map((d, i) => `${i + 1}. ${d}`)
              .join('\n'),
        );
        return;
      }

      const lat = matched.get('yy');
      const lon = matched.get('xx');
      if (lat && lon) {
        this.WeatherService.setLocation(`${lat},${lon}`);
      }

      // Apply highlight style to matched feature
      matched.setStyle(
        new Style({
          stroke: new Stroke({
            color: '#ff1493',
            width: 3,
          }),
          fill: new Fill({
            // subtle fill so overlay text / other styles remain readable
            color: 'rgba(255,20,147,0.15)',
          }),
        }),
      );

      this.highlightedFeature = matched;

      // zoom to feature with padding and maxZoom guard
      try {
        const geom = matched.getGeometry();
        if (geom) {
          const extent = geom.getExtent();
          this.map.getView().fit(extent, {
            duration: 600,
            padding: [70, 70, 70, 70],
            maxZoom: 12,
          });
        }
      } catch (e) {
        console.error('highlightDistrict: error while fitting view', e);
      }

      // Force render/update
      try {
        this.districtVectorLayer.changed();
        this.map.render();
      } catch (e) {
        // ignore if map not ready
      }
    }; // end tryHighlight

    // If features not yet loaded, wait for a one-time featuresloadend and retry
    const src =
      this.districtVectorLayer?.getSource() || this.districtVectorSource;
    if (!src) {
      console.warn('highlightDistrict: no district source available');
      return;
    }

    const featuresNow = src.getFeatures ? src.getFeatures() : [];
    if (!featuresNow || featuresNow.length === 0) {
      // One-time listener for async load
      const onLoad = () => {
        try {
          // remove listener (if removeEventListener available)
          if (src.un) {
            // ol v6 style
            src.un('featuresloadend', onLoad);
          } else if ((src as any).removeEventListener) {
            (src as any).removeEventListener('featuresloadend', onLoad);
          }
        } catch (e) {
          // ignore
        }
        setTimeout(tryHighlight, 50); // small delay to ensure features are available
      };

      // Attach one-time listener depending on OL version
      if (src.on) {
        src.once
          ? (src.once('featuresloadend', onLoad) as void)
          : src.on('featuresloadend', onLoad);
      } else if ((src as any).addEventListener) {
        (src as any).addEventListener('featuresloadend', onLoad);
      } else {
        // fallback: try again after short timeout
        setTimeout(tryHighlight, 200);
      }
      return;
    }

    // features already present
    tryHighlight();
  }

  async loadCircleListForDropdown() {
    try {
      let apiPayload: { circle: string };
      if (['Admin', 'MLAdmin'].includes(this.user.userrole)) {
        apiPayload = { circle: 'All Circle' };
      } else {
        apiPayload = { circle: this.user.indus_circle };
      }

      const res: any = await this.dataService
        .postRequest('get_circle_list', apiPayload)
        .toPromise();

      if (res && res.status && Array.isArray(res.data)) {
        this.circleOptions = res.data;
        if (
          this.user?.userrole === 'User' &&
          this.user?.indus_circle !== 'All Circle'
        ) {
          this.circleOptions = this.circleOptions.filter(
            (item: any) => item.label !== 'All Circle',
          );
        }
      } else {
        console.error(
          'Failed to load circle list: Invalid API response format',
        );
        this.circleOptions = [];
      }
      this.safeDetectChanges();
    } catch (error) {
      console.error('❌ Failed to load circle list from API:', error);
      this.circleOptions = [];
    }
  }

  zoomOnLocationSearch = (location: string) => {
    const existing = this.map
      .getLayers()
      .getArray()
      .find((l: any) => l.id === 'search-point-marker');

    if (existing) {
      this.map.removeLayer(existing);
    }

    if (location === 'India') {
      this.map.getView().fit(this.indiaExtent as Extent, {
        padding: [50, 50, 50, 50],
        duration: 500,
      });
      return;
    }

    if (location) {
      const loc = location.split(',');
      const lat = parseFloat(loc[0]);
      const lon = parseFloat(loc[1]);
      const pointCoords = fromLonLat([lon, lat]); // lon, lat
      const pointMarker = new Feature({
        geometry: new Point(pointCoords),
      });

      pointMarker.setStyle(
        new Style({
          image: new Icon({
            src: 'https://cdn-icons-png.flaticon.com/512/684/684908.png', // any icon you want
            scale: 0.05,
          }),
        }),
      );
      const markerLayer = new VectorLayer({
        source: new VectorSource({
          features: [pointMarker],
        }),
        properties: {
          title: 'Location Layer',
        },
      });
      (markerLayer as any).id = 'search-point-marker';

      this.map.addLayer(markerLayer);
      this.map.getView().setCenter(pointCoords);
      this.map.getView().setZoom(10);
    } else {
      this.map.getView().fit(this.indiaExtent as Extent, {
        padding: [50, 50, 50, 50],
        duration: 500,
      });
    }
  };

  clearSearchMarker() {
    const existing = this.map
      .getLayers()
      .getArray()
      .find((l: any) => l.id === 'search-point-marker');

    if (existing) {
      this.map.removeLayer(existing);
      this.WeatherService.setSearchLocation('');
    }
  }

  loadNewTowerData(geoJsonDataURL: string) {
    this.http.get(geoJsonDataURL).subscribe((geojson: any) => {
      const features = new GeoJSON().readFeatures(geojson, {
        featureProjection: 'EPSG:3857',
      });
      this.newtowerSource.addFeatures(features);
    });
  }

  onCircleLevelChange(event: Event): void {
    const selectEl = event.target as HTMLSelectElement;
    const selectedValues = Array.from(selectEl.selectedOptions).map(
      (opt) => opt.label,
    );
    const filterCircle: any = this.circleOptions.filter(
      (option) => option.label == selectedValues[0],
    );

    this.selectedCircle = filterCircle[0]?.label;
    const selectedCircleLocation = filterCircle[0]?.value;

    this.clearDistrictHighlight();

    this.WeatherService.setCircleChange(filterCircle);

    this.WeatherService.setCircleLocationChange(selectedCircleLocation);
    this.loadIndusCircleGeoJSON();
    this.loadIndusDistrictGeoJSON();
    this.WeatherService.setDistrictCircle(selectedCircleLocation);
    this.WeatherService.setDashboardCircleLocation(selectedCircleLocation);

    // Close dropdown on selection (Bootstrap 5)
    const dropdownInstance = bootstrap.Dropdown.getInstance(
      this.dropdownBtn.nativeElement,
    );

    if (dropdownInstance) {
      dropdownInstance.hide();
    }
  }
  //#endregion

  //#region Filters, Weather, And Popup Helpers
  convertToGeoJSON(apiData: any): GeoJSON.FeatureCollection {
    const features = apiData[0].map((record: any) => {
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [record.Longitude, record.Latitude],
        },
        properties: {
          ...record,
        },
      };
    });

    return {
      type: 'FeatureCollection',
      features: features,
    };
  }

  showHideZoneList() {
    this.showZoneListDropdown = !this.showZoneListDropdown;
    this.showCircleListDropdown = false;
  }

  showHideCircleList() {
    this.showCircleListDropdown = !this.showCircleListDropdown;
    this.showZoneListDropdown = false;
  }

  filterCircleData() {
    let filteredStates: string[] = [];

    if (this.selectedZoneArray.length > 0) {
      this.selectedZoneArray.forEach((zone: string) => {
        if (this.zoneWiseState[zone]) {
          const truncatedStates = this.zoneWiseState[zone].map((state) =>
            state.slice(0, 12),
          );
          filteredStates = filteredStates.concat(truncatedStates);
        }
      });
    } else {
      Object.values(this.zoneWiseState).forEach((states: string[]) => {
        const truncatedStates = states.map((state) => state.slice(0, 12));
        filteredStates = filteredStates.concat(truncatedStates);
      });
    }
    this.circleArray = ['All', ...filteredStates];
  }

  // when user clicks radio
  onDayChange(value: string) {
    this.selectedDay = value;
    this.selectedHour = new Date().getHours();
    this.generateRegionWiseWeatherIDW();
    // if (this.isIDWSelected) {
    //   this.zoomToIndiaExtent();
    // }
    this.closePopup();
    this.WeatherService.setSelectedDays(value);
    let payload = {};
    if (this.selectedDay === 'today') {
      payload = {
        type: 'update',
        id: this.logId,
        data: {
          today_btn_clicked: 'true',
        },
      };
    } else {
      payload = {
        type: 'update',
        id: this.logId,
        data: {
          tomorrow_btn_clicked: 'true',
        },
      };
    }
    this.updateWeatherLogTable(payload);
  }

  onChangeCheckboxZone(event: any): void {
    const inputElement = event.target as HTMLInputElement;
    const value = inputElement.value;
    const checked = inputElement.checked;
    const nonAllYears = this.zoneArray.filter((y: string) => y !== 'All');
    if (value === 'All') {
      if (checked) {
        this.selectedZoneArray = [...nonAllYears, 'All'];
      } else {
        this.selectedZoneArray = [];
      }
    } else {
      if (checked) {
        if (!this.selectedZoneArray.includes(value)) {
          this.selectedZoneArray.push(value);
        }
        const allSelected = nonAllYears.every((year: any) =>
          this.selectedZoneArray.includes(year),
        );
        if (allSelected && !this.selectedZoneArray.includes('All')) {
          this.selectedZoneArray.push('All');
        }
      } else {
        this.selectedZoneArray = this.selectedZoneArray.filter(
          (year: string) => year !== value,
        );
        this.selectedZoneArray = this.selectedZoneArray.filter(
          (year: string) => year !== 'All',
        );
      }
    }
    this.filterCircleData();
  }

  onChangeCheckboxCircle(event: any): void {
    const inputElement = event.target as HTMLInputElement;
    const value = inputElement.value;
    const checked = inputElement.checked;
    const nonAllYears = this.circleArray.filter((y: string) => y !== 'All');
    if (value === 'All') {
      if (checked) {
        this.selectedCircleArray = [...nonAllYears, 'All'];
      } else {
        this.selectedCircleArray = [];
      }
    } else {
      if (checked) {
        if (!this.selectedCircleArray.includes(value)) {
          this.selectedCircleArray.push(value);
        }
        const allSelected = nonAllYears.every((year: any) =>
          this.selectedCircleArray.includes(year),
        );
        if (allSelected && !this.selectedCircleArray.includes('All')) {
          this.selectedCircleArray.push('All');
        }
      } else {
        this.selectedCircleArray = this.selectedCircleArray.filter(
          (year: string) => year !== value,
        );
        this.selectedCircleArray = this.selectedCircleArray.filter(
          (year: string) => year !== 'All',
        );
      }
    }
  }

  getWeatherIconUrl(condition: string, time?: string): string {
    const iconMatch = this.uniqueConditionsWithIcons.find(
      (entry: any) => entry.name === condition,
    );
    return iconMatch.dayUrl;
  }

  hourlyRainfallIMD: any = [];
  async getRainfallFactore(location: string): Promise<number> {
    const [latitude, longitude] = location.split(',').map(Number);

    const payload = {
      longitude: longitude,
      latitude: latitude,
      selectedDay: this.selectedDay?.toUpperCase(),
    };

    const response: any = await firstValueFrom(
      this.dataService.get_rainfall_factor(payload),
    );
    this.hourlyRainfallIMD = response?.hourly_district_rainfall;
    return response?.day_district_rainfall?.[0]?.imd_rainfall;
  }

  calculateRainFactor(imd_rainfall_str: any, api_rainfall: any): number {
    const imd_rainfall = Number(imd_rainfall_str);
    if (api_rainfall === 0 && imd_rainfall === 0) {
      return 0;
    } else if (api_rainfall === 0 && imd_rainfall !== 0) {
      return imd_rainfall / 1;
    } else if (api_rainfall >= imd_rainfall) {
      return 1;
    } else {
      return imd_rainfall / api_rainfall;
    }
  }

  async getWeatherFromLatLong(lat: number, lon: number): Promise<any> {
    try {
      const location = `${lat},${lon}`;

      const data: any = await firstValueFrom(
        this.dataService.getWeatherForecast(location),
      );

      this.WeatherService.setWeatherDataCache(data);

      if (!data) {
        throw new Error('HTTP error: Failed to load data');
      }

      const now = new Date();
      const currentHour = now.getHours();
      const isToday = this.selectedDay === 'today';

      const forecastDayIndex = isToday ? 0 : 1;

      const forecastDay = data?.forecast?.forecastday?.[forecastDayIndex];

      // Calculate rain factor based on API rainfall and IMD rainfall
      const apiRainfall = forecastDay.day.totalprecip_mm;
      const imdRainfall = await this.getRainfallFactore(location);
      const rainfactor = this.calculateRainFactor(imdRainfall, apiRainfall);

      if (!forecastDay) {
        throw new Error('Forecast data not available');
      }

      const currentHourData = forecastDay.hour?.[currentHour];
      const currentIMDData = this.hourlyRainfallIMD?.find(
        (item: any) =>
          item.hour === `${String(currentHour).padStart(2, '0')}:00`,
      );

      const currentWeather = isToday ? data?.current : currentHourData;

      const rain6Dyas = [];

      for (let i = 1; i <= 6; i++) {
        const nextHourData = forecastDay.hour?.[currentHour + i];
        if (!nextHourData) break;

        const hourKey = `${String(currentHour + i).padStart(2, '0')}:00`;

        // find matching IMD data
        const imdData = this.hourlyRainfallIMD?.find(
          (item: any) => item.hour === hourKey,
        );

        rain6Dyas.push({
          time: hourKey,
          rainPer: imdData ? 100 : (nextHourData?.chance_of_rain ?? 'NA'),

          rainMM: imdData
            ? Number(imdData.rain_value) // override
            : Number((nextHourData?.precip_mm * rainfactor).toFixed(2)),

          icon: imdData ? imdData.icon : nextHourData?.condition.icon,
        });
      }

      return {
        time: `${currentHour}:00`,
        temp: currentWeather?.temp_c,
        rainPercent: currentIMDData ? 100 : currentHourData?.chance_of_rain,
        rainMM: currentIMDData
          ? Number(currentIMDData.rain_value)
          : Number(((currentHourData?.precip_mm ?? 0) * rainfactor).toFixed(2)),
        condition_text: currentIMDData
          ? currentIMDData.condition_text
          : currentWeather?.condition?.text,
        icon: currentIMDData
          ? currentIMDData.icon
          : (currentWeather?.condition?.icon ?? ''),
        rain6Dyas,
        location_name: data?.location?.name,
      };
    } catch (error: any) {
      console.error('Error fetching weather data:', error);
      throw error;
    }
  }

  closePopup() {
    if (this.popupContent && this.popupOverlay) {
      this.popupContent.innerHTML = '';
      this.popupOverlay.setPosition(undefined);
    }
  }
  //#endregion

  //#region Map Initialization
  private async initializeMap(): Promise<void> {
    // Define base map layer
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

    // Map setup
    this.map = new Map({
      target: 'map',
      layers: [
        baseMap,
        // this.Weather_LocationsVectorLayer,
        this.imgIDWTempLayer,
        this.imgIDWRainFallLayer,
        this.imgIDWWindLayer,
        this.imgIDWHumidityLayer,
        this.imgIDWFogLayer,
        this.districtVectorLayer,
        // this.hazardVectorLayer,
        this.circleVectorLayer,
        this.indusBNDVectorLayer,
      ],

      // ...
      view: new View({
        projection: 'EPSG:3857',

        // Center of India [lon, lat] and a zoom level to see the country on load
        center: this.initialCenter,
        zoom: this.initialZoom,
        minZoom: 4,
        maxZoom: 11,
      }),
      // ...

      controls: olDefaultControls({ zoom: false }).extend([
        new FullScreen({ source: 'map-component-container' }),
        new Zoom(),
      ]),
    });

    const mapContainer = document.getElementById('map');
    const idwTooltip = document.createElement('div');

    idwTooltip.className = 'idw-tooltip';

    idwTooltip.style.position = 'absolute';
    idwTooltip.style.background = 'rgba(0,0,0,0.7)';
    idwTooltip.style.color = '#fff';
    idwTooltip.style.padding = '4px 8px';
    idwTooltip.style.borderRadius = '4px';
    idwTooltip.style.fontSize = '12px';
    idwTooltip.style.pointerEvents = 'none';
    idwTooltip.style.whiteSpace = 'nowrap';
    idwTooltip.style.display = 'none';

    mapContainer?.appendChild(idwTooltip);

    // Handle fullscreen change to adjust zoom level
    document.addEventListener('fullscreenchange', () => {
      const extent = this.circleVectorSource.getExtent();

      // Zoom To Circle Chane When Fullscreen Toggled
      this.map
        .getView()
        .fit(extent, { duration: 500, padding: [15, 85, 30, 20] });
    });

    // --- Popup element
    // const container = document.getElementById('popup') as HTMLElement;
    const closer = document.getElementById('popup-closer') as HTMLElement;

    // --- Overlay for popup
    const overlay = new Overlay({
      element: this.popupElement,
      offset: [0, -15],
      autoPan: {
        animation: {
          duration: 250,
        },
      },
    });

    this.map.addOverlay(overlay);

    // Call function to render legend
    this.renderLegend(this.map);

    // --- Close popup handler

    closer.onclick = function () {
      overlay.setPosition(undefined);
      closer.blur();
      return false;
    };

    // Map click handling
    this.map.on('click', async (evt) => {
      this.closePopup();
      var pixel = this.map.getEventPixel(evt.originalEvent);
      const coord = evt.coordinate;
      const coord4326 = transform(coord, 'EPSG:3857', 'EPSG:4326');
      this.map.forEachFeatureAtPixel(pixel, async (feature: any, layer) => {
        if (layer && layer.get('title') === 'Hazard Prop Layer') {
          let html = this.hazardDataBindPopup(feature.values_);
          this.popupContent.innerHTML = html;
          this.popupOverlay.setPosition(coord);
        } else if (layer && layer.get('title') === 'Districts') {
          if (feature) {
            const payload = {
              type: 'update',
              id: this.logId,
              data: {
                tower_clicked: 'true',
              },
            };
            this.updateWeatherLogTable(payload);
            if (feature.values_) {
              if (!this.popupOverlay) {
                return;
              }

              let Lat = coord4326[1];
              let Lon = coord4326[0];
              let siteName = '';
              let district = feature.values_.district;
              let circle = feature.values_.state_ut;
              // if (Lat && Lon) {
              //   this.WeatherService.setLocation(`${Lat},${Lon}`);
              // }

              const resultData = await this.getWeatherFromLatLong(Lat, Lon);

              if (!resultData) return;

              const weatherIconUrl = `${resultData.icon}`;

              const html = `
                <div style="font-family: 'Segoe UI', sans-serif; font-size: 12px; line-height: 1.4; border-radius: 6px; padding: 6px; background: #fff;">

                  <!-- Site Information -->
                  <div style="border-bottom: 1px solid #ddd; padding-bottom: 6px; margin-bottom: 8px;">
                    <div><i class="fas fa-map-marker-alt" style="color:#007bff;"></i> <strong>Location:</strong> ${
                      resultData.location_name
                    }</div>
                    <div><i class="fas fa-map-marker-alt" style="color:#28a745;"></i> <strong>State/UT:</strong> ${circle}</div>
                    <div><i class="fas fa-map-marker-alt" style="color:#dc3545;"></i> <strong>District:</strong> ${district}</div>
                  </div>

                  <!-- Current Weather -->

                  <div style="display: flex; align-items: center; gap: 8px;">
                    <!-- Left Column: Icon + 0% -->
                    <div style="display: flex; flex-direction: column; align-items: center; border-right: 1px solid #bbb; padding-right: 8px;">
                      <img src="${weatherIconUrl}" alt="Weather Icon" style="width: 36px; height: 36px; margin-bottom: 4px;" />
                      <h3 style="margin: 0; font-size: 18px; font-weight: bold; color: #000;">${
                        resultData.rainPercent
                      }%</h3>
                    </div>

                    <!-- Right Column: Rain Probability & mm -->
                    <div style="display: flex; flex-direction: column; font-size: 11px; padding-left: 8px;">
                      <span style="font-weight: bold; color: #333;">${
                        resultData.time
                      }</span>
                      <span style="color: #666;">Rain Probability</span>
                      <span style="font-weight: 600;">${
                        resultData.rainMM
                      } mm</span>
                    </div>
                  </div>

                  <!-- Condition -->
                  <div style="margin-top: 4px;margin-bottom: 8px; font-size: 11px; color: #555;">
                    <span>${resultData.condition_text}</span>
                  </div>

                  <!-- Rain Probability Timeline -->
                  <div style="display: flex; align-items: center;">

                    <!-- Vertical label -->
                    <div style="writing-mode: vertical-rl; transform: rotate(180deg); font-size: 11px; color: #555; margin-right: 6px;">
                      Rain Probability
                    </div>

                    <!-- Compact Table -->
                    <table style="border-collapse: collapse; font-size: 11px; text-align: center; width: 100px;">
                      <thead>
                        <tr style="background-color: #f77f00; color: #fff;">
                          <th style="padding: 3px 6px;">Hours</th>
                          <th style="padding: 3px 6px;">%</th>
                          <th style="padding: 3px 6px;">mm</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${resultData.rain6Dyas
                          .map(
                            (row: any, i: any) => `
                          <tr style="background-color: ${
                            i % 2 === 0 ? '#fde2d2' : '#fdece5'
                          };">
                            <td style="padding: 3px;">${row.time}</td>
                            <td style="padding: 3px; font-weight: 600; color: ${
                              parseInt(row.rainPer) > 0 ? '#d9534f' : '#28a745'
                            };">
                              ${row.rainPer}
                            </td>
                            <td style="padding: 3px; font-weight: 600; color: ${
                              parseInt(row.rainMM) > 0 ? '#d9534f' : '#28a745'
                            };">
                              ${row.rainMM}
                            </td>
                          </tr>
                        `,
                          )
                          .join('')}
                      </tbody>
                    </table>
                  </div>

                </div>
                `;
              // const coord = evt.coordinate;
              this.popupContent.innerHTML = html;
              this.popupOverlay.setPosition(coord);
            }
          }
        } else {
          this.popupContent.innerHTML = '';
          this.popupOverlay.setPosition(undefined);
        }
      });
    });

    this.safeDetectChanges();
  }

  //intialize the animation
  initializeAnimation(MultiPolygon: any) {
    if (!this.windOverlay) {
      const mapEl = document.getElementById('map');
      this.windOverlay = new WindOverlay(
        this.map,
        mapEl!,
        this.windGridService,
        MultiPolygon,
      );
    }
  }

  //#endregion

  //#region Logging And Legend Helpers
  updateWeatherLogTable(payload: Object) {
    this.dataService.sendWeatherUserLog(payload).subscribe((res) => {
      if (res?.status === 'success') {
      }
    });
  }

  getIDWValueAtCoord(coord3857: any, vectorSource: any, power = 2) {
    const features = vectorSource.getFeatures();
    let numerator = 0;
    let denominator = 0;

    features.forEach((f: any) => {
      const pt = f.getGeometry().getCoordinates();
      const value = f.get('total');
      const dx = coord3857[0] - pt[0];
      const dy = coord3857[1] - pt[1];
      const dist = Math.sqrt(dx * dx + dy * dy) || 1; // avoid /0

      const weight = 1 / Math.pow(dist, power);
      numerator += weight * value;
      denominator += weight;
    });

    return denominator > 0 ? numerator / denominator : null;
  }

  // Legend rendering
  renderLegend(map: Map): void {
    const legendContainer = document.getElementById('legend-list');
    if (!legendContainer) return;

    legendContainer.innerHTML = ''; // Clear legend

    const layers = map.getLayers().getArray();
    layers.forEach((layer, index) => {
      const layerId = `layer-${index}`;
      layer.set('layerId', layerId);

      // Listen for visibility changes
      layer.on('change:visible', () => {
        this.updateLegendItem(layer, index, legendContainer);
      });

      // Add to legend if visible
      if (layer.getVisible()) {
        this.renderLegendItem(layer, index, legendContainer);
      }
    });

    // Listen for new layers
    map.getLayers().on('add', (event) => {
      const newLayer = event.element;
      const layerIndex = map.getLayers().getArray().indexOf(newLayer);
      const newId = `layer-${layerIndex}`;
      newLayer.set('layerId', newId);
      newLayer.on('change:visible', () => {
        this.updateLegendItem(newLayer, layerIndex, legendContainer);
      });

      if (newLayer.getVisible()) {
        this.renderLegendItem(newLayer, layerIndex, legendContainer);
      }
    });

    // Listen for layer removal
    map.getLayers().on('remove', (event) => {
      const removedLayer = event.element;
      const removedId = removedLayer.get('layerId');

      const isFixed =
        removedLayer.get('fixed') === true ||
        removedLayer.get('legendFixed') === true;

      // const isFixed = removedLayer.get('fixed') === true;

      if (removedLayer.get('title') === 'Wind') {
        this.removeWindAnimationLegendItem();
      }

      if (!isFixed) {
        const item = document.getElementById(removedId);
        if (item) {
          item.remove();
        }
      }
    });
  }

  renderLegendItem(
    layer: any,
    index: number,
    legendContainer: HTMLElement,
  ): void {
    const layerName = layer.get('title') || `Layer ${index + 1}`;
    const layerId = layer.get('layerId') || `layer-${index}`;
    if (document.getElementById(layerId)) {
      return;
    }

    const listItem = document.createElement('li');
    listItem.id = layerId;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;

    checkbox.style.appearance = 'auto'; // use browser default
    checkbox.style.webkitAppearance = 'auto';

    // Keep your custom size + border + cursor
    checkbox.style.width = '14px';
    checkbox.style.height = '14px';
    checkbox.style.border = '2px solid #157347';
    checkbox.style.borderRadius = '4px';
    checkbox.style.cursor = 'pointer';

    // Make the tick green
    checkbox.style.accentColor = '#157347';

    checkbox.addEventListener('change', () => {
      this.closePopup();
      layer.setVisible(checkbox.checked);
      if (layer.get('title') === 'Hazard Layer') {
        this.callParentFunction();
      }

      if (layer.get('title') === 'Wind') {
        if (checkbox.checked) {
          this.windOverlay?.start();
          this.renderWindAnimationLegendItem(legendContainer);
        } else {
          this.removeWindAnimationLegendItem();
        }
      }
    });

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.innerText = layerName;
    label.style.marginLeft = '4px';
    label.classList.add('layer-label');

    listItem.appendChild(checkbox);
    listItem.appendChild(label);
    legendContainer.appendChild(listItem);
    if (layer.get('title') === 'Wind') {
      this.renderWindAnimationLegendItem(legendContainer);
    }
  }

  updateLegendItem(
    layer: any,
    index: number,
    legendContainer: HTMLElement,
  ): void {
    const visible = layer.getVisible();
    const layerId = layer.get('layerId') || `layer-${index}`;
    const layerTitle = layer.get('title');
    const existingItem = document.getElementById(layerId);
    // const isFixed = layer.get('fixed') === true;
    const isFixed =
      layer.get('fixed') === true || layer.get('legendFixed') === true;

    // Only custom handling for IDW-type layers
    const idwLayers = [
      'Humidity',
      'Wind',
      'Rainfall',
      'Temperature',
      'Visibility',
    ];

    if (visible && !existingItem) {
      this.renderLegendItem(layer, index, legendContainer);
    } else if (!visible && existingItem && !isFixed) {
      if (layerTitle === 'Wind') {
        this.removeWindAnimationLegendItem();
      }

      if (idwLayers.includes(layerTitle)) {
        // Get all layers from the map
        const mapLayers = this.map.getLayers().getArray();

        // Check if any of the IDW layers are still visible
        const anyIDWVisible = mapLayers.some(
          (l) => idwLayers.includes(l.get('title')) && l.getVisible(),
        );

        if (!anyIDWVisible) {
          existingItem.remove();
          // Set all IDW layers to visible false (just to be safe)
          mapLayers.forEach((l) => {
            if (idwLayers.includes(l.get('title'))) {
              l.setVisible(false);
            }
          });

          // Reset your flag
          this.WeatherService.clearSelectedLayer();
          this.isIDWLayer = false;
          this.safeDetectChanges();
        } else {
          // Some other IDW layer is still visible – just remove this one from legend
          existingItem.remove();
        }
      } else {
        // Non-IDW layer – just remove from legend
        existingItem.remove();
      }
    }
  }
  //#endregion

  //#region IDW

  zoomToIndiaExtent = () => {
    const view = this.map.getView();
    view.animate({
      center: this.initialCenter,
      zoom: this.initialZoom,
      duration: 300,
    });
  };

  toggleTempIDW = async () => {
    this.toggleOffAnimation();
    this.isSearchLoading = true;
    this.isRainIDWLayer = false;
    this.selectedHour = new Date().getHours();
    this.selectedHourIndex = this.hours.indexOf(this.selectedHour); // update the time line
    await this.generateRegionWiseWeatherIDW();
    this.minRange = `${this.minTemp} (°C)`;
    this.maxRange = `${this.maxTemp} (°C)`;
    this.isIDWLayer = true;
    this.isIDWSelected = true;
    this.imgIDWTempLayer.setVisible(true);
    this.imgIDWWindLayer.setVisible(false);
    this.imgIDWHumidityLayer.setVisible(false);
    this.imgIDWRainFallLayer.setVisible(false);
    this.imgIDWFogLayer.setVisible(false);
    this.closePopup();
    this.isSearchLoading = false;

    this.timelineSpeed = 3000;
    // Start auto timeline
    this.startAutoTimeline();
  };

  toggleRainIDW = async () => {
    this.toggleOffAnimation();
    this.isSearchLoading = true;
    this.isRainIDWLayer = true;
    this.selectedHour = new Date().getHours();
    this.selectedHourIndex = this.hours.indexOf(this.selectedHour); // update the time line
    await this.generateRegionWiseWeatherIDW();
    this.isIDWLayer = true;
    this.isIDWSelected = true;
    this.imgIDWRainFallLayer.setVisible(true);
    this.imgIDWTempLayer.setVisible(false);
    this.imgIDWWindLayer.setVisible(false);
    this.imgIDWHumidityLayer.setVisible(false);
    this.imgIDWFogLayer.setVisible(false);
    this.closePopup();
    this.isSearchLoading = false;

    this.timelineSpeed = 3000;
    // Start auto timeline
    this.startAutoTimeline();
  };

  toggleWindIDW = async () => {
    this.isSearchLoading = true;
    this.isRainIDWLayer = false;
    this.selectedHour = new Date().getHours();
    this.selectedHourIndex = this.hours.indexOf(this.selectedHour); // update the time line
    await this.generateRegionWiseWeatherIDW();
    this.minRange = `${this.minWind} (kph)`;
    this.maxRange = `${this.maxWind} (kph)`;
    this.isIDWLayer = true;
    this.isIDWSelected = true;
    this.imgIDWWindLayer.setVisible(true);
    this.imgIDWTempLayer.setVisible(false);
    this.imgIDWRainFallLayer.setVisible(false);
    this.imgIDWHumidityLayer.setVisible(false);
    this.imgIDWFogLayer.setVisible(false);
    this.windOverlay?.start();
    this.closePopup();
    this.isSearchLoading = false;

    this.timelineSpeed = 10000; // Faster speed for wind animation
    // Start auto timeline
    this.startAutoTimeline();
  };

  toggleHumidiyIDW = async () => {
    this.toggleOffAnimation();
    this.isSearchLoading = true;
    this.isRainIDWLayer = false;
    this.selectedHour = new Date().getHours();
    this.selectedHourIndex = this.hours.indexOf(this.selectedHour); // update the time line
    await this.generateRegionWiseWeatherIDW();

    this.minRange = `${this.minHumidity} (%)`;
    this.maxRange = `${this.maxHumidity} (%)`;
    this.isIDWLayer = true;
    this.isIDWSelected = true;
    this.imgIDWHumidityLayer.setVisible(true);
    this.imgIDWTempLayer.setVisible(false);
    this.imgIDWRainFallLayer.setVisible(false);
    this.imgIDWWindLayer.setVisible(false);
    this.imgIDWFogLayer.setVisible(false);
    this.closePopup();
    this.isSearchLoading = false;

    this.timelineSpeed = 3000;
    // Start auto timeline
    this.startAutoTimeline();
  };

  toggleFogIDW = async () => {
    this.toggleOffAnimation();
    this.isSearchLoading = true;
    this.isRainIDWLayer = false;
    this.selectedHour = new Date().getHours();
    this.selectedHourIndex = this.hours.indexOf(this.selectedHour); // update the time line
    await this.generateRegionWiseWeatherIDW();
    this.closePopup();
    this.minRange = `${this.maxFog} (Km)`; // Reverve value
    this.maxRange = `${this.minFog} (Km)`; // Reverve value
    this.imgIDWFogLayer.setVisible(true);
    this.imgIDWHumidityLayer.setVisible(false);
    this.imgIDWTempLayer.setVisible(false);
    this.imgIDWRainFallLayer.setVisible(false);
    this.imgIDWWindLayer.setVisible(false);
    this.isIDWLayer = true;
    this.isIDWSelected = true;
    this.isSearchLoading = false;

    this.timelineSpeed = 3000;
    // Start auto timeline
    this.startAutoTimeline();
  };

  districtTempMap: { [key: string]: number } = {};
  async generateRegionWiseWeatherLabel() {
    try {
      const selectedDate: any = this.getDatesWithHour(this.selectedHour);
      const params = { selectedDate: selectedDate[this.selectedDay] };

      const res: any = await this.dataService
        .postRequest('get-weather-label', { params })
        .toPromise();

      if (!res?.status || !Array.isArray(res.data)) {
        this.isPreparing = false;
        return;
      }

      const data = res.data;

      // -------------------------------------
      // Store district-wise temperature
      // -------------------------------------

      this.districtTempMap = {};

      data.forEach((item: any) => {
        const district = item.district || item.district_name || item.SITE_NAME;
        if (district) {
          this.districtTempMap[district.toLowerCase().trim()] =
            item.rain_precip;
        }
      });

      this.districtVectorLayer.changed();

      //  PREPARE in background
    } catch (err) {
      console.error(err);
    }
  }

  async generateRegionWiseWeatherIDW() {
    if (this.isPreparing) return;

    this.isPreparing = true;

    try {
      const selectedDate: any = this.getDatesWithHour(this.selectedHour);
      const params = { selectedDate: selectedDate[this.selectedDay] };

      const res: any = await this.dataService
        .postRequest('get-current-weather', { params })
        .toPromise();

      if (!res?.status || !Array.isArray(res.data)) {
        this.isPreparing = false;
        return;
      }

      const data = res.data;

      //  PREPARE in background
      const processed = this.processWeatherData(data);

      this.nextData = processed;

      //  SWAP ONLY AFTER READY
      this.applyProcessedData(this.nextData);

      this.currentData = this.nextData;
      this.nextData = null;
      if (this.isRainIDWLayer) {
        await this.generateRegionWiseWeatherLabel();
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.isPreparing = false;
    }
  }

  processWeatherData(data: any[]) {
    let idwSources: any = {};

    // ---- Utility functions ----
    const getMinMax = (arr: any[], key: string) => ({
      min: Math.min(...arr.map((x) => +x[key])),
      max: Math.max(...arr.map((x) => +x[key])),
    });

    const safePercent = (value: number, max: number) =>
      max === 0 ? 0 : Math.ceil((value / max) * 100);

    const createFeature = (coord: any, total: number, count: number) =>
      new ol.Feature({
        geometry: new ol.geom.Point(coord),
        total,
        count,
      });

    const createIDW = (vectorSource: any, min: number, max: number) =>
      new ol.source.IDW({
        source: vectorSource,

        weight: 'total',

        getColor: (val: number) => this.getHeatmapColor(val, min, max),
      });

    // ---- Min/Max calculations (OUTSIDE ngZone for return access) ----
    const temp = getMinMax(data, 'temp_c');
    const rain = getMinMax(data, 'chance_of_rain');
    const wind = getMinMax(data, 'wind_kph');
    const humidity = getMinMax(data, 'humidity');
    const fog = getMinMax(data, 'vis_km');

    const absTmin = Math.abs(temp.min);

    // ---- Heavy work outside Angular ----
    this.ngZone.runOutsideAngular(() => {
      // Clear sources
      [
        this.vectorSourceTemp,
        this.vectorSourceRain,
        this.vectorSourceWind,
        this.vectorSourceHumidity,
        this.vectorSourceFog,
      ].forEach((src) => src.clear());

      // Populate features
      data.forEach((item: any) => {
        const coord = transform(
          [item.longitude, item.latitude],
          'EPSG:4326',
          'EPSG:3857',
        );

        this.vectorSourceTemp.addFeature(
          createFeature(
            coord,
            item.temp_c + absTmin,
            safePercent(item.temp_c + absTmin, temp.max + absTmin),
          ),
        );

        this.vectorSourceRain.addFeature(
          createFeature(
            coord,
            item.chance_of_rain,
            safePercent(item.chance_of_rain, rain.max),
          ),
        );

        this.vectorSourceWind.addFeature(
          createFeature(
            coord,
            item.wind_kph,
            safePercent(item.wind_kph, wind.max),
          ),
        );

        this.vectorSourceHumidity.addFeature(
          createFeature(
            coord,
            item.humidity,
            safePercent(item.humidity, humidity.max),
          ),
        );

        this.vectorSourceFog.addFeature(
          createFeature(
            coord,
            item.vis_km,
            safePercent(fog.max - item.vis_km, fog.max),
          ),
        );
      });

      // ✅ Create IDW sources (ONLY here)
      idwSources = {
        temp: createIDW(
          this.vectorSourceTemp,
          temp.min + absTmin,
          temp.max + absTmin,
        ),

        rain: createIDW(this.vectorSourceRain, rain.min, rain.max),

        wind: createIDW(this.vectorSourceWind, wind.min, wind.max),

        humidity: createIDW(
          this.vectorSourceHumidity,
          humidity.min,
          humidity.max,
        ),

        fog: createIDW(this.vectorSourceFog, fog.max, fog.min),
      };
    });

    //  RETURN ONLY (NO UI update here)
    return {
      ...idwSources,
      windGrid: this.windGridService.setData(data),

      meta: {
        temp,
        rain,
        wind,
        humidity,
        fog,
      },
    };
  }

  private getHeatmapColor(
    val: number,
    minVal: number,
    maxVal: number,
  ): [number, number, number, number] {
    // Safety
    if (isNaN(val)) {
      return [0, 0, 0, 0];
    }

    // -----------------------------------
    // Normalize dynamically (0 → 1)
    // -----------------------------------
    const range = maxVal - minVal || 1;

    const v = (val - minVal) / range;

    const normalized = Math.max(0, Math.min(v, 1));

    // -----------------------------------
    // Transparency control
    // 0.20 = 20%
    // -----------------------------------
    const transparentUntil = 0.23;

    let alphaMultiplier = 1;

    // Smooth fade from 0% → 20%
    if (normalized <= transparentUntil) {
      alphaMultiplier = normalized / transparentUntil;
    }

    // -----------------------------------
    // Color stops
    // -----------------------------------
    const colorStops = [
      [0, 0, 255], // BLUE
      [0, 255, 255], // CYAN
      [0, 255, 0], // GREEN
      [255, 255, 0], // YELLOW
      [255, 0, 0], // RED
    ];

    const numStops = colorStops.length - 1;

    const index = Math.max(
      0,
      Math.min(Math.floor(normalized * numStops), numStops - 1),
    );

    const t = normalized * numStops - index;

    const start = colorStops[index];

    const end = colorStops[Math.min(index + 1, numStops)];

    // -----------------------------------
    // Smooth RGB interpolation
    // -----------------------------------
    const r = start[0] + (end[0] - start[0]) * t;

    const g = start[1] + (end[1] - start[1]) * t;

    const b = start[2] + (end[2] - start[2]) * t;

    // Full opacity
    const alpha = 255;

    // -----------------------------------
    // Apply transparency fade
    // -----------------------------------
    return [r, g, b, alpha * alphaMultiplier];
  }

  applyProcessedData(grid: any) {
    this.imgIDWTempLayer.setSource(grid.temp);
    this.imgIDWRainFallLayer.setSource(grid.rain);
    this.imgIDWWindLayer.setSource(grid.wind);
    this.imgIDWHumidityLayer.setSource(grid.humidity);
    this.imgIDWFogLayer.setSource(grid.fog);

    this.windOverlay?.setGrid(grid.windGrid);

    // Apply legend AFTER swap
    const meta = grid.meta;

    if (meta) {
      this.minTemp = meta.temp.min;
      this.maxTemp = meta.temp.max;

      this.minRain = meta.rain.min;
      this.maxRain = meta.rain.max;

      this.minWind = meta.wind.min;
      this.maxWind = meta.wind.max;

      this.minHumidity = meta.humidity.min;
      this.maxHumidity = meta.humidity.max;

      this.minFog = meta.fog.min;
      this.maxFog = meta.fog.max;
    }

    this.cropHeatMapByBoundary();

    this.safeDetectChanges();
  }

  startAutoTimeline() {
    if (this.autoPlayInterval) {
      clearInterval(this.autoPlayInterval);
    }

    this.autoPlayInterval = setInterval(() => {
      if (!this.isIDWLayer) {
        clearInterval(this.autoPlayInterval);
        this.districtTempMap = {};

        this.districtVectorLayer.setStyle(this.districtVectorLayer.getStyle());
        this.districtVectorLayer.changed();

        this.map.renderSync();
        return;
      }
      if (this.isPaused || this.isPreparing) return;
      this.selectedHour = (this.selectedHour + 1) % 24;

      this.selectHour(this.selectedHour);
    }, this.timelineSpeed);
  }

  togglePause() {
    this.isPaused = !this.isPaused;
  }

  toggleOffAnimation() {
    this.windOverlay?.stop();
    this.safeDetectChanges();
  }

  private readonly windAnimationLegendId = 'wind-animation-layer';

  private renderWindAnimationLegendItem(legendContainer: HTMLElement): void {
    if (document.getElementById(this.windAnimationLegendId)) {
      return;
    }

    const listItem = document.createElement('li');
    listItem.id = this.windAnimationLegendId;

    const checkbox = document.createElement('input');
    checkbox.id = `${this.windAnimationLegendId}-checkbox`;
    checkbox.type = 'checkbox';
    checkbox.checked = true;

    checkbox.style.appearance = 'auto';
    checkbox.style.webkitAppearance = 'auto';
    checkbox.style.width = '14px';
    checkbox.style.height = '14px';
    checkbox.style.border = '2px solid #157347';
    checkbox.style.borderRadius = '4px';
    checkbox.style.cursor = 'pointer';
    checkbox.style.accentColor = '#157347';

    checkbox.addEventListener('change', () => {
      this.closePopup();

      if (checkbox.checked && this.imgIDWWindLayer.getVisible()) {
        this.windOverlay?.start();
      } else {
        this.windOverlay?.stop();
      }
    });

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.innerText = 'Wind Animation';
    label.style.marginLeft = '4px';
    label.classList.add('layer-label');

    listItem.appendChild(checkbox);
    listItem.appendChild(label);
    legendContainer.appendChild(listItem);
  }

  private removeWindAnimationLegendItem(): void {
    const item = document.getElementById(this.windAnimationLegendId);

    if (item) {
      item.remove();
    }

    this.windOverlay?.stop();
  }

  //#endregion

  //#region Hazard, Utility, And Export Helpers
  hazardDataBindPopup(data: any) {
    return `
     <h6>Hazards / Bad Weather</h6>
    <table style="border-collapse: collapse; width: 100%; font-family: Arial; font-size: 11px;">
    <tr>
    <th style="text-align: left; padding: 4px;border: 1px solid #ccc;">District</th>
    <td style="padding: 4px;border: 1px solid #ccc;">${data.district}</td>
  </tr>
  <tr>
    <th style="text-align: left; padding: 4px;border: 1px solid #ccc;">State</th>
    <td style="padding: 4px;border: 1px solid #ccc;">${data.state_ut}</td>
  </tr>
  <tr>
    <th style="text-align: left; padding: 4px;border: 1px solid #ccc;">Circle</th>
    <td style="padding: 4px;border: 1px solid #ccc;">${data.indus_circle}</td>
  </tr>
      <tr>
          <th style="text-align: left; padding: 4px;border: 1px solid #ccc;">Type</th>
          <td style="padding: 4px;border: 1px solid #ccc;">${data.disaster_type}</td>
      </tr>

      <tr>
          <th style="text-align: left; padding: 4px;border: 1px solid #ccc;">Severity</th>
          <td style="padding: 4px;border: 1px solid #ccc;">${data.severity}</td>
      </tr>
      
      <tr>
        <th style="text-align: left; padding: 4px;border: 1px solid #ccc;">Affective</th>
        <td style="padding: 4px;border: 1px solid #ccc;">${data.effective_start_time}</td>
      </tr>
   
      <tr>
        <th style="text-align: left; padding: 4px;border: 1px solid #ccc;">Expires</th>
        <td style="padding: 4px;border: 1px solid #ccc;">${data.effective_end_time}</td>
      </tr>
     
    </table>
  `;
  }

  getCssVar(varName: string): string {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
  }

  addHazardsGeoJSONLayerOnMap = async (geojson: any) => {
    const features = new GeoJSON().readFeatures(geojson.features, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    });

    // ---------------------------
    // Update source
    // ---------------------------
    this.hazardVectorSource.clear(true);
    this.hazardVectorSource.addFeatures(features);

    // ---------------------------
    // Create centroid features
    // ---------------------------
    const centroidFeatures: Feature[] = [];

    features.forEach((feature: any) => {
      const geometry = feature.getGeometry();
      if (!geometry) return;

      const extent = geometry.getExtent();

      const centroid = [
        (extent[0] + extent[2]) / 2,
        (extent[1] + extent[3]) / 2,
      ];

      const disasterType = feature.get('disaster_type');

      const pointFeature = new Feature({
        geometry: new Point(centroid),
        icon: this.getHazardIcon(disasterType),
      });

      centroidFeatures.push(pointFeature);
    });

    // ---------------------------
    // Mobile handling
    // ---------------------------
    const isMobile = window.innerWidth < 768;

    let currentScale = isMobile ? 1 : 1.1;

    // ---------------------------
    // Shared style
    // ---------------------------
    const styleFunction = (feature: FeatureLike): Style => {
      return new Style({
        image: new Icon({
          src: feature.get('icon'),

          scale: currentScale,

          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',

          rotateWithView: false,

          crossOrigin: 'anonymous',

          color: '#10623bff',
        }),
      });
    };

    const centroidLayer = new VectorLayer({
      source: new VectorSource({
        features: centroidFeatures,
      }),

      style: styleFunction,

      properties: {
        title: 'Disaster Layer',
      },

      declutter: false,

      zIndex: 8,
    });

    // ---------------------------
    // Animation
    // ---------------------------
    let t = 0;

    const animate = () => {
      // disable animation on mobile

      t += 0.05;

      currentScale = Number((1.1 + Math.sin(t) * 0.14).toFixed(3));

      centroidLayer.changed();

      this.map.render();

      requestAnimationFrame(animate);
    };

    animate();

    // ---------------------------
    // GROUP LAYER
    // ---------------------------
    this.hazardGroupLayer.getLayers().clear();

    this.hazardGroupLayer.getLayers().push(this.hazardVectorLayer);

    this.hazardGroupLayer.getLayers().push(centroidLayer);

    // remove old group
    this.map.getLayers().forEach((layer) => {
      if (layer.get('title') === 'Hazard Layer') {
        this.map.removeLayer(layer);
      }
    });

    // add group
    this.map.addLayer(this.hazardGroupLayer);

    this.hazardGroupLayer.setZIndex(7);

    this.hazardGroupLayer.setVisible(true);

    // ---------------------------
    // Zoom to extent
    // ---------------------------
    const extent = this.hazardVectorSource.getExtent();

    if (extent && isFinite(extent[0])) {
      this.map.getView().fit(extent, {
        duration: 600,
        padding: [50, 50, 50, 50],
        maxZoom: 11,
      });
    }
  };

  // Add this as a class property to track animation

  // private hazardAnimFrameId: number | null = null;

  // addHazardsGeoJSONLayerOnMap = async (geojson: any) => {
  //   // ---------------------------
  //   // CANCEL PREVIOUS ANIMATION
  //   // ---------------------------
  //   if (this.hazardAnimFrameId !== null) {
  //     cancelAnimationFrame(this.hazardAnimFrameId);
  //     this.hazardAnimFrameId = null;
  //   }

  //   // ---------------------------
  //   // READ FEATURES  ← BUG 1 FIX
  //   // ---------------------------
  //   const features = new GeoJSON().readFeatures(geojson.features, {
  //     dataProjection: 'EPSG:4326',
  //     featureProjection: 'EPSG:3857',
  //   });

  //   this.hazardVectorSource.clear(true);
  //   this.hazardVectorSource.addFeatures(features);

  //   // ---------------------------
  //   // CREATE CENTROID FEATURES
  //   // ---------------------------
  //   const centroidFeatures: Feature[] = [];

  //   features.forEach((feature: any) => {
  //     const geometry: any = feature.getGeometry();
  //     if (!geometry) return;

  //     let centroid: number[];

  //     if (geometry.getType() === 'Polygon') {
  //       centroid = geometry.getInteriorPoint().getCoordinates();
  //     } else if (geometry.getType() === 'MultiPolygon') {
  //       centroid = geometry
  //         .getInteriorPoints()
  //         .getFlatCoordinates()
  //         .slice(0, 2);
  //     } else {
  //       const extent = geometry.getExtent();
  //       centroid = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
  //     }

  //     const pointFeature = new Feature({
  //       geometry: new Point(centroid),
  //       icon: this.getHazardIcon(feature.get('disaster_type')),
  //     });

  //     centroidFeatures.push(pointFeature);
  //   });

  //   // ---------------------------
  //   // MOBILE DETECTION
  //   // ---------------------------
  //   const isMobile = window.innerWidth < 768;
  //   const baseScale = isMobile ? 0.1 : 0.2;
  //   const pulseAmount = isMobile ? 0.01 : 0.015;
  //   let currentScale = baseScale;

  //   // ---------------------------
  //   // STYLE  ← BUG 2 FIX: center anchor, no displacement
  //   // ---------------------------
  //   const styleFunction = (feature: FeatureLike): Style => {
  //     return new Style({
  //       image: new Icon({
  //         src: feature.get('icon'),
  //         scale: currentScale,
  //         anchor: [0.5, 0.5], // ✅ center anchor for area centroids
  //         anchorXUnits: 'fraction',
  //         anchorYUnits: 'fraction',
  //         rotateWithView: false,
  //         color: '#10623bff',

  //         size: [512, 512],
  //       }),
  //     });
  //   };

  //   // ---------------------------
  //   // CENTROID LAYER
  //   // ---------------------------
  //   const centroidLayer = new VectorLayer({
  //     source: new VectorSource({ features: centroidFeatures }),
  //     style: styleFunction,
  //     properties: { title: 'Disaster Layer' },
  //     declutter: false,
  //     renderBuffer: 300,
  //     zIndex: 8,
  //   });

  //   // ---------------------------
  //   // ANIMATION  ← BUG 3 FIX: store handle, cancel on next call
  //   // ---------------------------
  //   let t = 0;
  //   const animate = () => {
  //     t += 0.05;
  //     currentScale = Number((baseScale + Math.sin(t) * pulseAmount).toFixed(3));
  //     centroidLayer.changed();
  //     this.hazardAnimFrameId = requestAnimationFrame(animate); // ✅ stored
  //   };
  //   animate();

  //   // ---------------------------
  //   // GROUP / MAP LAYERS
  //   // ---------------------------
  //   this.hazardGroupLayer.getLayers().clear();
  //   this.hazardGroupLayer.getLayers().push(this.hazardVectorLayer);
  //   this.hazardGroupLayer.getLayers().push(centroidLayer);

  //   this.map.getLayers().forEach((layer) => {
  //     if (layer.get('title') === 'Hazard Layer') {
  //       this.map.removeLayer(layer);
  //     }
  //   });

  //   this.map.addLayer(this.hazardGroupLayer);
  //   this.hazardGroupLayer.setZIndex(7);
  //   this.hazardGroupLayer.setVisible(true);

  //   // ---------------------------
  //   // FIT MAP
  //   // ---------------------------
  //   const extent = this.hazardVectorSource.getExtent();
  //   if (extent && isFinite(extent[0])) {
  //     this.map.getView().fit(extent, {
  //       duration: 600,
  //       padding: isMobile ? [60, 60, 120, 60] : [50, 50, 50, 50],
  //       maxZoom: isMobile ? 9 : 11,
  //     });
  //   }
  // };
  pointToCircularBuffer = (coods: any) => {
    transform([coods.longitude, coods.latitude], 'EPSG:4326', 'EPSG:3857');
    const point = turf.point([-90.54863, 14.616599]);
    const buffered = turf.buffer(point, 500, { units: 'miles' });
    return buffered;
  };

  getDatesWithHour = (hour: any) => {
    const today = new Date();
    const formatDate = (date: any, hour: any) => {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${String(hour).padStart(2, '0')}:00`;
    };

    // Today
    const todayStr = formatDate(today, hour);

    // Tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow, hour);

    return { today: todayStr, tomorrow: tomorrowStr };
  };

  cropHeatMapByBoundary = async () => {
    try {
      const cached: any = await this.cacheService.getCircle(
        this.selectedCircle,
      );

      const cropFeatureBND =
        this.selectedCircle === 'All Circle'
          ? this.indusBNDGeoJSON
          : {
              type: 'FeatureCollection',
              features: cached,
            };

      const features = new ol.format.GeoJSON().readFeatures(cropFeatureBND, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      });

      const polygons = features.map((f: any) => f.getGeometry());

      const multiPolygon = new ol.geom.MultiPolygon(
        polygons
          .map((poly: any) => {
            if (poly instanceof ol.geom.Polygon) {
              return [poly.getCoordinates()];
            } else if (poly instanceof ol.geom.MultiPolygon) {
              return poly.getCoordinates();
            }
            return [];
          })
          .flat(),
      );

      const existingGrid = this.currentData?.windGrid;

      if (this.windOverlay) {
        this.windOverlay.stop();

        // remove old canvas properly
        this.windOverlay.destroy();

        this.windOverlay = null;
      }

      // recreate overlay
      this.initializeAnimation(multiPolygon);

      // restore wind grid
      if (existingGrid) {
        this.windOverlay?.setGrid(existingGrid);
      }

      const cropFeature = new ol.Feature(multiPolygon);

      const crop = new ol.filter.Crop({
        feature: cropFeature,
        wrapX: true,
        inner: false,
      });

      const layers = [
        this.imgIDWTempLayer,
        this.imgIDWRainFallLayer,
        this.imgIDWWindLayer,
        this.imgIDWHumidityLayer,
        this.imgIDWFogLayer,
      ];

      // REMOVE OLD FILTER
      if (this.currentCropFilter) {
        layers.forEach((layer: any) => {
          try {
            layer.removeFilter(this.currentCropFilter);
          } catch (e) {}
        });
      }

      // ADD NEW FILTER
      layers.forEach((layer: any) => {
        layer.addFilter(crop);
      });

      this.currentCropFilter = crop;

      setTimeout(() => {
        if (this.imgIDWWindLayer.getVisible()) {
          this.windOverlay?.start();
        }
      }, 100);
      // IMPORTANT
      layers.forEach((layer: any) => {
        layer.changed();
      });

      this.map.render();
    } catch (error) {
      console.error('Error in cropHeatMapByBoundary:', error);
    }
  };
  onClearButtonClick = () => {
    this.WeatherService.clearSelectedLayer();
    this.isIDWSelected = false;
    this.isIDWLayer = false;
    this.imgIDWWindLayer.setVisible(false);
    this.imgIDWTempLayer.setVisible(false);
    this.imgIDWRainFallLayer.setVisible(false);
    this.imgIDWHumidityLayer.setVisible(false);
    this.imgIDWFogLayer.setVisible(false);
    this.map.getView().animate({
      center: this.initialCenter,
      zoom: this.initialZoom,
      duration: 500,
    });
  };

  onAlert(group: any, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      const userMail = group.users.map((u: any) => u.mail);
      const userMailId = userMail.join(',');
      if (!this.towerListRef) return;
      let data = [
        {
          siteCount: group.siteCount,
          districts: group.district,
          circle: group.circle,
          users: group.users,
        },
      ];
      this.screenshotData = data;

      html2canvas(this.towerListRef.nativeElement).then((canvas) => {
        canvas.toBlob((blob) => {
          if (blob) {
            const formData = new FormData();
            formData.append('file', blob, 'tower_report.png');
            formData.append('userMail', userMailId);
            this.dataService.sendSelectedTowerReport(formData).subscribe({
              next: (res: any) => {
                alert(JSON.stringify(res));
              },
              error: (error: any) => {
                alert(JSON.stringify(error));
              },
            });
          }
        });
      });
    }
  }
  //#endregion

  //#region GeoJSON Loaders
  loadIndusBoundaryGeoJSON = async () => {
    const ONE_HOUR = 60 * 60 * 1000;
    try {
      if (
        this.user?.userrole === 'User' &&
        this.user?.indus_circle !== 'All Circle'
      ) {
        // Remove Indus boundary from lengend

        const item = document.getElementById('layer-8');
        if (item) {
          item.remove();
        }
        return;
      }
      const cached: any = await this.cacheService.getBnd('boundary');
      if (Array.isArray(cached) && cached.length > 0) {
        this.indusBNDGeoJSON = cached;
        const features = new GeoJSON().readFeatures(cached, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        });
        this.indusBNDVectorSource.clear();
        this.indusBNDVectorSource.addFeatures(features);
        return;
      }

      const payload = { circle: this.selectedCircle };
      const res: any = await firstValueFrom(
        this.dataService.postRequest('get_indus_boundary', payload),
      );

      const data = res?.data;
      await this.cacheService.setBnd('boundary', data, ONE_HOUR);

      this.indusBNDGeoJSON = data;
      const features = new GeoJSON().readFeatures(data, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      });

      this.indusBNDVectorSource.clear();
      this.indusBNDVectorSource.addFeatures(features);
    } catch (error) {
      console.error('loadIndusBoundaryGeoJSON failed:', error);
    }
  };

  loadIndusCircleGeoJSON = async () => {
    const ONE_HOUR = 60 * 60 * 1000;
    const key = this.selectedCircle;
    try {
      //  Try cache first
      const cached: any = await this.cacheService.getCircle(key);
      if (Array.isArray(cached) && cached.length > 0) {
        const features = new GeoJSON().readFeatures(
          { type: 'FeatureCollection', features: cached },
          {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          },
        );

        this.circleVectorSource.clear();
        this.circleVectorSource.addFeatures(features);

        const extent = this.circleVectorSource.getExtent();
        this.map
          .getView()
          .fit(extent, { duration: 500, padding: [15, 85, 30, 20] });
        return;
      }

      const payload = { circle: this.selectedCircle };
      const res: any = await firstValueFrom(
        this.dataService.postRequest('get_indus_circle_boundary', payload),
      );

      const data = res?.data;
      if (!data?.features?.length) return;

      //  Group by circle
      const grouped: any = {};

      for (const f of data.features) {
        const circle = f.properties?.indus_circle;
        if (!circle) continue;

        if (!grouped[circle]) grouped[circle] = [];
        grouped[circle].push(f);
      }

      //  Store each group with TTL
      for (const circle in grouped) {
        await this.cacheService.setCircle(circle, grouped[circle], ONE_HOUR);
      }

      const features = new GeoJSON().readFeatures(data, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      });

      this.circleVectorSource.clear();
      this.circleVectorSource.addFeatures(features);

      const extent = this.circleVectorSource.getExtent();
      this.map
        .getView()
        .fit(extent, { duration: 500, padding: [15, 85, 30, 20] });
    } catch (error) {
      console.error('loadIndusCircleGeoJSON failed:', error);
    }
  };

  loadIndusDistrictGeoJSON = async () => {
    const ONE_HOUR = 60 * 60 * 1000;
    const key = this.selectedCircle;

    try {
      //  Try cache first
      const cached: any = await this.cacheService.getWithTTL(key);

      if (Array.isArray(cached) && cached.length > 0) {
        const features = new GeoJSON().readFeatures(
          { type: 'FeatureCollection', features: cached },
          {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          },
        );

        this.districtVectorSource.clear();
        this.districtVectorSource.addFeatures(features);
        return;
      }

      // API call
      const payload = { circle: this.selectedCircle };
      const res: any = await firstValueFrom(
        this.dataService.postRequest('get_district_boundary', payload),
      );

      const data = res?.data;
      if (!data?.features?.length) return;

      //  Group by circle
      const grouped: any = {};

      for (const f of data.features) {
        const circle = f.properties?.indus_circle;
        if (!circle) continue;

        if (!grouped[circle]) grouped[circle] = [];
        grouped[circle].push(f);
      }

      //  Store each group with TTL
      for (const circle in grouped) {
        await this.cacheService.setWithTTL(circle, grouped[circle], ONE_HOUR);
      }

      // 5 Render selected circle
      let selectedFeatures;
      if (this.selectedCircle === 'All Circle') {
        // merge all circles
        selectedFeatures = Object.values(grouped).flat();
      } else {
        selectedFeatures = grouped[this.selectedCircle];
      }

      if (!selectedFeatures) return;

      const features = new GeoJSON().readFeatures(
        { type: 'FeatureCollection', features: selectedFeatures },
        {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        },
      );

      this.districtVectorSource.clear();
      this.districtVectorSource.addFeatures(features);
    } catch (error) {
      console.error('loadIndusDistrictGeoJSON failed:', error);
    }
  };

  callGeoJSONAPI = async () => {
    await this.loadIndusBoundaryGeoJSON();
    await this.loadIndusCircleGeoJSON();
    await this.loadIndusDistrictGeoJSON();
  };

  //#endregion
}
