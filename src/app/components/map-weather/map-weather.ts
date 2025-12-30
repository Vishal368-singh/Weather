import {
  Component,
  AfterViewInit,
  ChangeDetectorRef,
  EventEmitter,
  Output,
  Input,
  SimpleChanges,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
  NgZone,
} from '@angular/core';
import Map from 'ol/Map';
import { containsCoordinate } from 'ol/extent';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import { Extent, createEmpty, extend as olExtend } from 'ol/extent';
import { fromLonLat, transformExtent } from 'ol/proj';
import { Feature as OlFeature } from 'ol';
import { Geometry } from 'ol/geom';
import Feature from 'ol/Feature';
import { Draw } from 'ol/interaction';
import OSM from 'ol/source/OSM';
import GeoJSON from 'ol/format/GeoJSON';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import VectorSource, { VectorSourceEvent } from 'ol/source/Vector';
import { FormsModule } from '@angular/forms';
import VectorLayer from 'ol/layer/Vector';
import { Style, Circle, Fill, Stroke, Text, Icon } from 'ol/style';
import Overlay from 'ol/Overlay';
import Cluster from 'ol/source/Cluster';
import { HttpClient } from '@angular/common/http';
import { point as turfPoint, distance as turfDistance } from '@turf/turf';
import { DataService } from '../../data-service/data-service';
import jsPDF from 'jspdf';
import { CommonModule } from '@angular/common';
import html2canvas from 'html2canvas';
import { MapExportService } from '../../shared/map-export.service';
import { WeatherService } from '../../services/weather';
import { Control, FullScreen, Zoom } from 'ol/control';
import { defaults as olDefaultControls } from 'ol/control/defaults';
import { transform } from 'ol/proj';
import { Severity } from '../severity/severity';
import { Circle as CircleStyle } from 'ol/style';
import { Circle as CircleGeom } from 'ol/geom';
import * as turf from '@turf/turf';
import { catchError, throwError } from 'rxjs';
import { CurrentLocationService } from '../../services/current-location-service';
import { visibility } from 'html2canvas/dist/types/css/property-descriptors/visibility';

declare const ol: any;

@Component({
  selector: 'app-map-weather',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './map-weather.html',
  styleUrl: './map-weather.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapWeather implements AfterViewInit {
  @ViewChild('screenshotContainer', { static: false })
  screenshotContainer!: ElementRef;
  @ViewChild('towerListRef') towerListRef!: ElementRef;
  @Output() callParentFun = new EventEmitter<void>();
  @Output() callParentFun2 = new EventEmitter<void>();
  @Input() disableZoomOnIDW: boolean = false;

  callParentFunction() {
    this.callParentFun.emit();
  }

  callParentFunction2(circleName: any) {
    this.callParentFun2.emit(circleName);
  }

  public selectedCircle: string = '';
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

  // highlightedDistrictName: string = '';

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

  isIDWSelected: boolean = false;
  hours: number[] = Array.from({ length: 24 }, (_, i) => i);
  selectedHour: number = new Date().getHours();
  selectedWetherAPISource: string = '';
  isRainIDWLayer: boolean = false;

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

  selectHour(hour: number) {
    this.selectedHour = hour;
    this.generateRegionWiseWeatherIDW();
  }

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private mapExport: MapExportService,
    private dataService: DataService,
    private WeatherService: WeatherService,
    private locationService: CurrentLocationService,
    private ngZone: NgZone
  ) {
    // Listen for source load completion
  }

  get logId(): string | null {
    return localStorage.getItem('logId');
  }
  weatherApiData: any = {};
  newtowerSource = new VectorSource();
  highlightedFeature: any = null;

  hazardsSource = new VectorSource();

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

  // Source of Indus Boundary
  indusBNDVectorSource: any = new VectorSource();

  // Source of District
  districtVectorSource: any = new VectorSource();

  // Source of Circle
  circleVectorSource: any = new VectorSource();

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
      (f: any) => f.get('indus_circle') === circleName
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
      (f: any) => (f.get('district') || f.get('SITE_NAME')) === districtName
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

    const textStyle = new Style({
      geometry: new Point(center),
      text: new Text({
        text: districtName,
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
    const zoom: any = this.map.getView().getZoom();
    const style: any = new Style({
      stroke: new Stroke({ color: '#af10eeff', width: 1.5 }),
    });

    return style;
  };

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

  loading = false; // Loader flag
  private mapImage: string | null = null;

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

  private dataPoints: any[] = [];

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
      await this.callGeoJSONAPI();
      await this.loadCircleListForDropdown();
    }

    const circleClicked = localStorage.getItem('circleClicked');
    if (circleClicked) {
      const clicked = JSON.parse(circleClicked);
      this.WeatherService.setCircleLabelClicked(clicked);
    }

    this.WeatherService.circleLabelClicked$.subscribe((clicked: boolean) => {
      this.isCircleLabelClicked = clicked;
      this.clearSearchMarker();

      this.safeDetectChanges();
    });

    this.WeatherService.panIndia$.subscribe((location: string) => {
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

    // this.WeatherService.weatherLogId$.subscribe((id) => {
    //   this.logId = id;
    //   this.safeDetectChanges();
    // });

    this.WeatherService.districtHighlight$.subscribe((district) => {
      if (district) {
        this.highlightDistrict(district);
      }
    });

    this.circleVectorLayer.setStyle(this.styleFunctionCircleLayer);
  }
  // Add this new function inside your MapWeather class

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
              .join('\n')
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
        })
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

        if (this.user?.userrole === 'User') {
          this.circleOptions = this.circleOptions.filter(
            (item: any) => item.label !== 'All Circle'
          );
        }
      } else {
        console.error(
          'Failed to load circle list: Invalid API response format'
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
      const indiaExtent: Extent = [
        fromLonLat([68.176645, 6.747139]), // Southwest corner (approx. Gujarat/Kerala)
        fromLonLat([97.402561, 35.494009]), // Northeast corner (Arunachal Pradesh)
      ].flat() as Extent;

      this.map.getView().fit(indiaExtent, {
        padding: [50, 50, 50, 50],
        duration: 500,
      });
      return;
    }

    if (location) {
      let loc = location.split(',');
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
        })
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
      const indiaExtent: Extent = [
        fromLonLat([68.176645, 6.747139]), // Southwest corner (approx. Gujarat/Kerala)
        fromLonLat([97.402561, 35.494009]), // Northeast corner (Arunachal Pradesh)
      ].flat() as Extent;

      this.map.getView().fit(indiaExtent, {
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
      (opt) => opt.label
    );
    const filterCircle: any = this.circleOptions.filter(
      (option) => option.label == selectedValues[0]
    );

    this.selectedCircle = filterCircle[0]?.label;
    let selectedCircleLocation = filterCircle[0]?.value;

    this.clearDistrictHighlight();

    this.WeatherService.setCircleChange(filterCircle);

    this.WeatherService.setCircleLocationChange(selectedCircleLocation);
    this.loadIndusCircleGeoJSON();
    this.loadIndusDistrictGeoJSON();
    this.WeatherService.setDistrictCircle(selectedCircleLocation);
    this.WeatherService.setDashboardCircleLocation(selectedCircleLocation);
  }

  //#endregion
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
            state.slice(0, 12)
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
          this.selectedZoneArray.includes(year)
        );
        if (allSelected && !this.selectedZoneArray.includes('All')) {
          this.selectedZoneArray.push('All');
        }
      } else {
        this.selectedZoneArray = this.selectedZoneArray.filter(
          (year: string) => year !== value
        );
        this.selectedZoneArray = this.selectedZoneArray.filter(
          (year: string) => year !== 'All'
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
          this.selectedCircleArray.includes(year)
        );
        if (allSelected && !this.selectedCircleArray.includes('All')) {
          this.selectedCircleArray.push('All');
        }
      } else {
        this.selectedCircleArray = this.selectedCircleArray.filter(
          (year: string) => year !== value
        );
        this.selectedCircleArray = this.selectedCircleArray.filter(
          (year: string) => year !== 'All'
        );
      }
    }
  }

  getWeatherIconUrl(condition: string, time?: string): string {
    const iconMatch = this.uniqueConditionsWithIcons.find(
      (entry: any) => entry.name === condition
    );
    return iconMatch.dayUrl;
  }

  async getWeatherFromLatLong(lat: number, lon: number): Promise<any> {
    let apiUrl = '';
    const weatherApiKey = '76458ac302254ce6a1e44038253107';
    const WeatherApiUrl = `https://api.weatherapi.com/v1/forecast.json?key=${weatherApiKey}&q=${lat},${lon}&days=7&aqi=no&alerts=no`;

    const CrossVisualApiKey = 'U97UPL62GH9FWVHVX9Q8Y36QE';
    const CrossVisualApiUrl = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${lat},${lon}?unitGroup=metric&include=current,hours,days&key=${CrossVisualApiKey}`;

    if (this.selectedWetherAPISource === 'weather_api') {
      apiUrl = WeatherApiUrl;
    } else {
      apiUrl = CrossVisualApiUrl;
    }
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();

      if (this.selectedWetherAPISource === 'weather_api') {
        if (this.selectedDay === 'today') {
          const now = new Date();
          const currentHour = now.getHours();
          const currentWeather = data.current;
          let rain6Dyas = [];
          let location_name = data.location.name;
          const forecastweather =
            data.forecast.forecastday[0].hour[currentHour];
          let hoursGap = 23 - currentHour;
          for (let i: any = 1; i <= hoursGap; i++) {
            if (i > 6) break;
            const forecastweather =
              data.forecast.forecastday[0].hour[currentHour + i];
            const obj = {
              time: `${currentHour + i}:00`,
              rainPer: forecastweather.chance_of_rain,
              rainMM: forecastweather.precip_mm,
            };
            rain6Dyas.push(obj);
          }
          const resultData: any = {
            time: `${currentHour}:00`,
            temp: currentWeather.temp_c,
            rainPercent: forecastweather.chance_of_rain,
            rainMM: forecastweather.precip_mm,
            condition_text: currentWeather.condition.text,
            icon: currentWeather.condition.icon,
            rain6Dyas: rain6Dyas,
            location_name: location_name,
          };
          return resultData;
        } else {
          const now = new Date();
          const currentHour = now.getHours();
          let rain6Dyas = [];
          const forecastweather =
            data.forecast.forecastday[1].hour[currentHour];
          let hoursGap = 23 - currentHour;
          let location_name = data.location.name;
          for (let i: any = 1; i <= hoursGap; i++) {
            if (i > 6) break;
            const forecastweather =
              data.forecast.forecastday[1].hour[currentHour + i];
            const obj = {
              time: `${currentHour + i}:00`,
              rainPer: forecastweather.chance_of_rain,
              rainMM: forecastweather.precip_mm,
            };
            rain6Dyas.push(obj);
          }
          const resultData: any = {
            time: `${currentHour}:00`,
            temp: forecastweather.temp_c,
            rainPercent: forecastweather.chance_of_rain,
            rainMM: forecastweather.precip_mm,
            condition_text: forecastweather.condition.text,
            icon: forecastweather.condition.icon,
            rain6Dyas: rain6Dyas,
            location_name: location_name,
          };
          return resultData;
        }
      } else {
        const currentConditions = data.currentConditions;
        const resultData: any = {
          temp: currentConditions.temp,
          condition_text: currentConditions.conditions,
          icon: this.getWeatherIconUrl(currentConditions.conditions),
        };
        return resultData;
      }
    } catch (error) {
      console.error('Error fetching weather data:', error);
    }
  }

  closePopup() {
    if (this.popupContent && this.popupOverlay) {
      this.popupContent.innerHTML = '';
      this.popupOverlay.setPosition(undefined);
    }
  }

  //#region initialize map
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

    //#region Map tile
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

    //#region Map OnClick
    this.map.on('click', async (evt) => {
      this.closePopup();
      var pixel = this.map.getEventPixel(evt.originalEvent);
      const coord = evt.coordinate;
      const coord4326 = transform(coord, 'EPSG:3857', 'EPSG:4326');
      this.map.forEachFeatureAtPixel(pixel, async (feature: any, layer) => {
        if (layer && layer.get('title') === 'Hazard Layer') {
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
              if (Lat && Lon) {
                this.WeatherService.setLocation(`${Lat},${Lon}`);
              }

              const resultData = await this.getWeatherFromLatLong(Lat, Lon);
              if (!resultData) return;

              const weatherIconUrl = resultData?.icon
                ? `https:${resultData.icon}`
                : '';

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
                        `
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

    // Create a tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'map-tooltip';
    document.body.appendChild(tooltip);

    // Style tooltip via CSS
    tooltip.style.position = 'absolute';
    tooltip.style.background = 'rgba(0,0,0,0.7)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '4px 8px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.fontSize = '12px';

    this.safeDetectChanges();
  }

  updateWeatherLogTable(payload: Object) {
    this.dataService.sendWeatherUserLog(payload).subscribe((res) => {
      if (res?.status === 'success') {
        console.log('Weather user activity logged.');
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

  //#region layer-legend
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
    legendContainer: HTMLElement
  ): void {
    const layerName = layer.get('title') || `Layer ${index + 1}`;
    const layerId = layer.get('layerId') || `layer-${index}`;

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
    });

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.innerText = layerName;
    label.style.marginLeft = '4px';
    label.classList.add('layer-label');

    listItem.appendChild(checkbox);
    listItem.appendChild(label);
    legendContainer.appendChild(listItem);
  }

  updateLegendItem(
    layer: any,
    index: number,
    legendContainer: HTMLElement
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
      if (idwLayers.includes(layerTitle)) {
        // Get all layers from the map
        const mapLayers = this.map.getLayers().getArray();

        // Check if any of the IDW layers are still visible
        const anyIDWVisible = mapLayers.some(
          (l) => idwLayers.includes(l.get('title')) && l.getVisible()
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
  //#endregion layer-legend

  // private setupPointerCursor(map: Map, boundary: Polygon): void {
  //   map.on('pointermove', (event) => {
  //     const hoveredCoordinate = event.coordinate;
  //     map.getTargetElement().style.cursor = boundary.intersectsCoordinate(
  //       hoveredCoordinate
  //     )
  //       ? 'pointer'
  //       : 'default';
  //   });
  // }

  private setupMapClick(
    map: Map,
    boundary: Polygon,
    features: Feature[]
  ): void {
    let popupOverlay: Overlay | null = null;
  }

  //#region IDW Layer

  zoomToIndiaExtent = () => {
    const view = this.map.getView();
    view.animate({
      center: this.initialCenter,
      zoom: this.initialZoom,
      duration: 300,
    });
  };

  toggleTempIDW = async () => {
    this.isSearchLoading = true;
    this.isRainIDWLayer = false;
    this.selectedHour = new Date().getHours();
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
    // this.zoomToIndiaExtent();

    // if (!this.disableZoomOnIDW) {
    //   this.zoomToIndiaExtent();
    // }
  };

  toggleRainIDW = async () => {
    this.isSearchLoading = true;
    this.isRainIDWLayer = true;
    this.selectedHour = new Date().getHours();
    await this.generateRegionWiseWeatherIDW();
    // this.minRange = `${this.minRain} (%)`;
    // this.maxRange = `${this.maxRain} (%)`;
    this.isIDWLayer = true;
    this.isIDWSelected = true;
    this.imgIDWRainFallLayer.setVisible(true);
    this.imgIDWTempLayer.setVisible(false);
    this.imgIDWWindLayer.setVisible(false);
    this.imgIDWHumidityLayer.setVisible(false);
    this.imgIDWFogLayer.setVisible(false);
    this.closePopup();
    this.isSearchLoading = false;
    // this.zoomToIndiaExtent();
    // if (!this.disableZoomOnIDW) {
    //   this.zoomToIndiaExtent();
    // }
  };

  toggleWindIDW = async () => {
    this.isSearchLoading = true;
    this.isRainIDWLayer = false;
    this.selectedHour = new Date().getHours();
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
    this.closePopup();
    this.isSearchLoading = false;
    // this.zoomToIndiaExtent();
    // if (!this.disableZoomOnIDW) {
    //   this.zoomToIndiaExtent();
    // }
  };

  toggleHumidiyIDW = async () => {
    this.isSearchLoading = true;
    this.isRainIDWLayer = false;
    this.selectedHour = new Date().getHours();
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
    // this.zoomToIndiaExtent();
    // if (!this.disableZoomOnIDW) {
    //   this.zoomToIndiaExtent();
    // }
  };

  toggleFogIDW = async () => {
    this.isSearchLoading = true;
    this.isRainIDWLayer = false;
    this.selectedHour = new Date().getHours();
    this.generateRegionWiseWeatherIDW();
    // this.zoomToIndiaExtent();
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
  };

  async generateRegionWiseWeatherIDW() {
    this.loading = true;

    try {
      const selectedDate: any = this.getDatesWithHour(this.selectedHour);
      const params = { selectedDate: selectedDate[this.selectedDay] };

      // Fetch API data (this must stay inside Angular zone)
      const res: any = await this.dataService
        .postRequest('get-current-weather', { params })
        .toPromise();

      if (!res || !res.status || !Array.isArray(res.data)) {
        console.error('Invalid API response');
        this.loading = false;
        return;
      }

      const data = res.data;

      // ------------------------------
      //     HEAVY WORK OUTSIDE ZONE
      // ------------------------------
      await this.ngZone.runOutsideAngular(async () => {
        // ---- Compute min/max ----
        this.minTemp = Math.min(...data.map((x: any) => +x.temp_c));
        this.maxTemp = Math.max(...data.map((x: any) => +x.temp_c));

        this.minRain = Math.min(...data.map((x: any) => +x.chance_of_rain));
        this.maxRain = Math.max(...data.map((x: any) => +x.chance_of_rain));

        this.minWind = Math.min(...data.map((x: any) => +x.wind_kph));
        this.maxWind = Math.max(...data.map((x: any) => +x.wind_kph));

        this.minHumidity = Math.min(...data.map((x: any) => +x.humidity));
        this.maxHumidity = Math.max(...data.map((x: any) => +x.humidity));

        this.minFog = Math.min(...data.map((x: any) => +x.vis_km));
        this.maxFog = Math.max(...data.map((x: any) => +x.vis_km));

        // Clear old vector sources
        this.vectorSourceTemp.clear();
        this.vectorSourceRain.clear();
        this.vectorSourceWind.clear();
        this.vectorSourceHumidity.clear();
        this.vectorSourceFog.clear();

        // Add features
        data.forEach((item: any) => {
          const coord3857 = transform(
            [item.longitude, item.latitude],
            'EPSG:4326',
            'EPSG:3857'
          );

          this.vectorSourceTemp.addFeature(
            new ol.Feature({
              geometry: new ol.geom.Point(coord3857),
              total: item.temp_c,
              count: Math.ceil((item.temp_c / this.maxTemp) * 100),
            })
          );

          this.vectorSourceRain.addFeature(
            new ol.Feature({
              geometry: new ol.geom.Point(coord3857),
              total: item.chance_of_rain,
              count: Math.ceil((item.chance_of_rain / this.maxRain) * 100),
            })
          );

          this.vectorSourceWind.addFeature(
            new ol.Feature({
              geometry: new ol.geom.Point(coord3857),
              total: item.wind_kph,
              count: Math.ceil((item.wind_kph / this.maxWind) * 100),
            })
          );

          this.vectorSourceHumidity.addFeature(
            new ol.Feature({
              geometry: new ol.geom.Point(coord3857),
              total: item.humidity,
              count: Math.ceil((item.humidity / this.maxHumidity) * 100),
            })
          );

          this.vectorSourceFog.addFeature(
            new ol.Feature({
              geometry: new ol.geom.Point(coord3857),
              total: item.vis_km,
              count: Math.ceil(
                ((this.maxFog - item.vis_km) / this.maxFog) * 100
              ),
            })
          );
        });

        // Build IDW sources
        const idwTemp = new ol.source.IDW({
          source: this.vectorSourceTemp,
          weight: 'count',
        });
        const idwRain = new ol.source.IDW({
          source: this.vectorSourceRain,
          weight: 'count',
        });
        const idwWind = new ol.source.IDW({
          source: this.vectorSourceWind,
          weight: 'count',
        });
        const idwHumidity = new ol.source.IDW({
          source: this.vectorSourceHumidity,
          weight: 'count',
        });
        const idwFog = new ol.source.IDW({
          source: this.vectorSourceFog,
          weight: 'count',
        });

        this.imgIDWTempLayer.setSource(idwTemp);
        this.imgIDWRainFallLayer.setSource(idwRain);
        this.imgIDWWindLayer.setSource(idwWind);
        this.imgIDWHumidityLayer.setSource(idwHumidity);
        this.imgIDWFogLayer.setSource(idwFog);

        await this.cropHeatMapByBoundary();
      });
    } catch (err) {
      console.error('Weather IDW Error:', err);
    } finally {
      // ------------------------------
      //     UPDATE UI INSIDE ZONE
      // ------------------------------
      this.ngZone.run(() => {
        this.loading = false; // 🔥 NOW THIS ALWAYS UPDATES
      });
    }
  }

  /*#endregion idw */

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

  addHazardsGeoJSONLayerOnMap = async (geojson: any) => {
    this.closePopup();
    this.isHazardlayer = !this.isHazardlayer;
    const features = new GeoJSON().readFeatures(geojson, {
      featureProjection: 'EPSG:3857',
    });
    this.hazardsSource.clear();
    this.hazardsSource.addFeatures(features);

    // Style of Vector layer
    const styleFunction = (feature: any) => {
      const severity = feature.get('severity'); // change to your field name

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

      return new Style({
        fill: new Fill({
          color: fillColor,
        }),
        stroke: new Stroke({
          color: 'black',
          width: 1,
        }),
      });
    };

    this.map.getLayers().forEach((layer) => {
      if (layer.get('title') === 'Hazard Layer') {
        this.map.removeLayer(layer);
      }
    });

    // Create a vector layer
    const vectorLayer: any = new VectorLayer({
      source: this.hazardsSource,
      properties: {
        title: 'Hazard Layer',
      },
      style: styleFunction,
    });

    // this.zoomToIndiaExtent();
    const extent = vectorLayer.getSource().getExtent();
    this.map.getView().fit(extent, { duration: 1000 });
    this.map.addLayer(vectorLayer);
  };

  pointToCircularBuffer = (coods: any) => {
    transform([coods.longitude, coods.latitude], 'EPSG:4326', 'EPSG:3857');
    let point = turf.point([-90.54863, 14.616599]);
    let buffered = turf.buffer(point, 500, { units: 'miles' });
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
      const response = await fetch('assets/geojson/indus_boundary.geojson');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const geojsonData = await response.json();

      const format = new ol.format.GeoJSON();
      const features = format.readFeatures(geojsonData, {
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
          .flat()
      );

      const cropFeature = new ol.Feature(multiPolygon);

      const crop = new ol.filter.Crop({
        feature: cropFeature,
        wrapX: true,
        inner: false,
      });

      // THE IMPORTANT PART
      this.ngZone.run(() => {
        this.imgIDWTempLayer.addFilter(crop);
        this.imgIDWRainFallLayer.addFilter(crop);
        this.imgIDWWindLayer.addFilter(crop);
        this.imgIDWHumidityLayer.addFilter(crop);
        this.imgIDWFogLayer.addFilter(crop);
        this.cdr.markForCheck(); // (Only if using OnPush)
      });
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

  //#region API - Load GeoJSON of District, Indus Circle & Indus Boundary
  loadIndusBoundaryGeoJSON = async () => {
    const payload = { circle: this.selectedCircle };
    this.dataService
      .postRequest('get_indus_boundary', payload)
      .subscribe((res) => {
        const data = res.data;
        const features = new GeoJSON().readFeatures(data, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        });

        this.indusBNDVectorSource.clear();
        this.indusBNDVectorSource.addFeatures(features);
      });
  };

  loadIndusCircleGeoJSON = async () => {
    const payload = { circle: this.selectedCircle };
    this.dataService
      .postRequest('get_indus_circle_boundary', payload)
      .subscribe((res) => {
        const data = res.data;
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
      });
  };

  loadIndusDistrictGeoJSON = async () => {
    const payload = { circle: this.selectedCircle };
    this.dataService
      .postRequest('get_district_boundary', payload)
      .subscribe((res) => {
        const data = res.data;
        const features = new GeoJSON().readFeatures(data, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        });

        this.districtVectorSource.clear();
        this.districtVectorSource.addFeatures(features);

        // const extent = this.districtVectorSource.getExtent();
        // this.map.getView().fit(extent, { duration: 500 ,padding: [15, 20, 25, 20]});
      });
  };

  callGeoJSONAPI = async () => {
    await this.loadIndusBoundaryGeoJSON();
    await this.loadIndusCircleGeoJSON();
    await this.loadIndusDistrictGeoJSON();
  };

  //#endregion
}
