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

declare const ol: any;
class LayerToggleControl extends Control {
  constructor(layer: VectorLayer<any>) {
    const button = document.createElement('button');

    const img = document.createElement('img');
    img.src = 'assets/icons/ToggleTowerWhite.svg'; // path to your icon
    img.alt = 'Tower';
    img.style.width = '20px';
    img.style.height = '20px';
    img.style.filter = 'invert(1)';
    button.appendChild(img);

    // Initial background color based on visibility
    button.style.backgroundColor = layer.getVisible() ? '#157347' : 'red';

    button.title = 'Tower On/Off ';

    const element = document.createElement('div');
    element.className = 'layer-toggle ol-unselectable ol-control';
    element.appendChild(button);
    button.style.display = 'None';

    super({ element });

    // Toggle event
    button.addEventListener('click', () => {
      const visible = layer.getVisible();
      layer.setVisible(!visible);

      // Update button background based on new visibility
      button.style.backgroundColor = !visible ? 'green' : 'red';
    });
  }
}

@Component({
  selector: 'app-map-weather',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './map-weather.html',
  styleUrl: './map-weather.css',
})
export class MapWeather implements AfterViewInit {
  @ViewChild('screenshotContainer', { static: false })
  screenshotContainer!: ElementRef;
  @ViewChild('towerListRef') towerListRef!: ElementRef;
  @Output() callParentFun = new EventEmitter<void>();
  @Output() callParentFun2 = new EventEmitter<void>();
  callParentFunction() {
    this.callParentFun.emit();
  }
  callParentFunction2(circle: any) {
    this.callParentFun2.emit(circle);
  }

  logo_path: string = '../../../assets';
  indiaExtent3857 = [
    ...fromLonLat([68.1766451354, 6.5546079]), // [minX, minY]
    ...fromLonLat([97.4025614766, 37.097]), // [maxX, maxY]
  ];
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
  // hours: string[] = Array.from({ length: 24 }, (_, i) =>(i === 0 || i === 23) ? `${i}hr` : `${i}`);
  hours: number[] = Array.from({ length: 24 }, (_, i) => i);
  selectedHour: number = new Date().getHours();
  selectedWetherAPISource: string = '';
  isRainIDWLayer: boolean = false;

  // radio options
  days = [
    { label: 'Today', value: 'today' },
    { label: 'Tomorrow', value: 'tomorrow' },
  ];

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
    private locationService: CurrentLocationService
  ) {}
  logId: String = '';
  weatherApiData: any = {};
  newTowerLayer!: VectorLayer<any>;
  newtowerSource = new VectorSource();

  hazardsSource = new VectorSource();

  teleconServicesSource = new VectorSource({
    format: new GeoJSON(),
    url: 'https://mlinfomap.org/geoserver/Telecom/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Telecom%3ARegions&outputFormat=application%2Fjson&maxFeatures=1000',
    // url: 'https://www.aajkabharatweb.com/geoserver/Telecom/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Telecom%3ARegions&maxFeatures=1000&outputFormat=application%2Fjson',
  });

  // teleconServices = new VectorLayer({
  //   source: this.teleconServicesSource,
  //   properties: {
  //     title: 'Weather Zone',
  //     fixed: true,
  //   },
  //   style: function (feature) {
  //     return new Style({
  //       text: new Text({
  //         text: feature.get('RegionName'), // Change 'name' to the attribute you want to label
  //         font: '15px Calibri,sans-serif',
  //         fill: new Fill({ color: '#fff' }),
  //         stroke: new Stroke({ color: '#000', width: 8 }),
  //         overflow: true,
  //       }),
  //       stroke: new Stroke({
  //         color: '#0f370dff',
  //         width: 2,
  //       }),
  //       fill: new Fill({
  //         color: 'rgba(200, 231, 255, 0)',
  //       }),
  //     });
  //   },
  // });

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
  // selectedCircleLayers: VectorLayer[] = [];
  // selectedDistrictLayers: VectorLayer[] = [];

  circleLayerSource = new VectorSource();
  districtLayerSource = new VectorSource();

  circleLayer = new VectorLayer({
    source: this.circleLayerSource,
    style: new Style({
      stroke: new Stroke({ color: '#157347', width: 2 }),
    }),
    properties: {
      title: 'Circle Layer',
      legendFixed: true, // From our last fix
    },
    visible: false, // Start hidden
  });

  districtLayer = new VectorLayer({
    source: this.districtLayerSource,
    style: new Style({
      stroke: new Stroke({ color: '#0ace72ff', width: 1 }),
    }),
    properties: {
      title: 'District Layer',
      legendFixed: true, // From our last fix
    },
    visible: false, // Start hidden
  });

  circleOptions: { value: string; label: string }[] = [];
  allCircleFeatures: any[] = [];
  allDistrictFeatures: any[] = [];
  //selectedCircleLayers: ol.layer.Vector[] = [];
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
  indiaExtent: any;
  initialCenter = fromLonLat([82.8320187, 25.4463565]);
  initialZoom = 10;

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
    title: 'Fog',
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
  }

  async ngOnInit(): Promise<void> {
    await this.initializeMap();
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      this.user = JSON.parse(storedUser);
      await this.loadCircleGeoJson();
      await this.loadDistrictGeoJson();
      const circles = [`${this.user.circle}`];
      if (circles.length > 0) {
        this.showSelectedDistrictOnMap(circles);
      }
    }

    const circleClicked = sessionStorage.getItem('circleClicked');
    if (circleClicked) {
      const clicked = JSON.parse(circleClicked);
      this.WeatherService.setCircleLabelClicked(clicked);
    }

    this.WeatherService.circleLabelClicked$.subscribe((clicked: boolean) => {
      this.isCircleLabelClicked = clicked;
      this.cdr.detectChanges();
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
        // console.log('Zooming to user circle:', this.user.circle);
        this.showSelectedDistrictOnMap([`${this.user.circle}`]);
        this.isPanIndiaClicked = false;
      }
    });

    this.WeatherService.searchLocation$.subscribe((location: string) => {
      if (location) {
        this.zoomOnLocationSearch(location);
      }
    });

    this.WeatherService.selectedSource$.subscribe((source: string) => {
      if (source) {
        this.selectedWetherAPISource = source;
      } else {
        this.selectedWetherAPISource = 'weather_api';
      }
    });

    this.WeatherService.weatherLogId$.subscribe((id) => {
      this.logId = id;
      this.cdr.detectChanges();
    });

    this.loadNewTowerData(
      'https://mlinfomap.org/geoserver/weather_postgres/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=weather_postgres%3Atower_locations&outputFormat=application%2Fjson&maxFeatures=10000'
    ),
      this.generateRegionWiseWeatherIDW();
    this.fetchUserList();
  }

  zoomOnLocationSearch = (location: string) => {
    const existing = this.map
      .getLayers()
      .getArray()
      .find((l: any) => l.id === 'search-point-marker');

    if (existing) {
      this.map.removeLayer(existing);
    }
    console.log(' Zooming to location:', location);
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

  loadNewTowerData(geoJsonDataURL: string) {
    this.http.get(geoJsonDataURL).subscribe((geojson: any) => {
      const features = new GeoJSON().readFeatures(geojson, {
        featureProjection: 'EPSG:3857',
      });
      this.newtowerSource.addFeatures(features);
    });
  }
  //#region circle Data
  toTitleCase(text: string): string {
    const exceptions = ['UP', 'UPE', 'UPW', 'NE', 'J&K']; // exceptions in full caps

    // If the whole string is an exception, return as is
    if (exceptions.includes(text.toUpperCase())) {
      return text.toUpperCase();
    }

    // Otherwise convert to Title Case
    return text
      .toLowerCase()
      .split(' ')
      .map((word) => {
        return exceptions.includes(word.toUpperCase())
          ? word.toUpperCase()
          : word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }
  async loadCircleGeoJson() {
    try {
      const response = await fetch('assets/geojson/Telecom_circle.geojson');
      if (!response.ok) throw new Error('Network response was not ok');

      const geojsonData = await response.json();
      const format = new ol.format.GeoJSON();
      const features = format.readFeatures(geojsonData, {
        featureProjection: 'EPSG:3857',
      });
      // console.log(' Features:', features);
      this.allCircleFeatures = features;
      this.circleOptions = features
        .map((f: any, i: number) => {
          const raw = f.get('indus_circ'); // extract telecom_ci from each feature
          // .filter((ci: string | null | undefined) => !!ci) //
          // const raw = f.get('Telecom N');
          // console.log(' Raw Circle Name:', raw);
          return {
            value: raw,
            label: raw || `Circle ${i + 1}`,
          };
        })
        .sort(
          (
            a: { label: string; value: string },
            b: { label: string; value: string }
          ) => a.label.localeCompare(b.label)
        );
      if (!['Admin', 'MLAdmin'].includes(this.user.userrole)) {
        this.circleOptions = this.circleOptions.filter(
          (circle: any) => circle.label === this.user.circle
        );
      }
      this.cdr.detectChanges();
    } catch (error) {
      console.error('❌ Failed to load geojson:', error);
      this.circleOptions = [];
    }
  }

  // ............Load District GeoJson............
  async loadDistrictGeoJson() {
    try {
      const response = await fetch('assets/geojson/IndusDistrict.geojson');
      if (!response.ok) throw new Error('Network response was not ok');

      const geojsonData = await response.json();
      const format = new ol.format.GeoJSON();
      const features = format.readFeatures(geojsonData, {
        featureProjection: 'EPSG:3857',
      });
      // console.log(' Features:', features);
      this.allDistrictFeatures = features;
    } catch (error) {
      console.error('❌ Failed to load geojson:', error);
      this.circleOptions = [];
    }
  }

  onCircleLevelChange(event: Event): void {
    const selectEl = event.target as HTMLSelectElement;
    const selectedValues = Array.from(selectEl.selectedOptions).map(
      (opt) => opt.value
    );

    this.WeatherService.setCircleChange(selectedValues[0]);
    this.showSelectedCirlceOnMap(selectedValues);
    // console.log(' Selected Circles:', selectedValues);
    this.callParentFunction2(selectedValues);
    sessionStorage.setItem('selectedCircle', JSON.stringify(selectedValues));
  }

  showSelectedCirlceOnMap(selectedValues: any) {
    // 🧹 Clear previous features from the single source
    this.circleLayerSource.clear();

    const allFeatures: OlFeature<Geometry>[] = []; // To calculate combined extent
    let allTelecomCis: string[] = []; // To pass to the district function

    selectedValues.forEach((circleName: any) => {
      const features = this.allCircleFeatures.filter(
        (f) =>
          f.get('indus_circ') === circleName ||
          f.get('telecom_ci') === circleName
      );
      // console.log(' Selected Circle Features:', features);

      if (features.length > 0) {
        allFeatures.push(...features); // Add features for extent calculation

        const telecom_ci = features[0].get('indus_circ');
        if (telecom_ci) {
          allTelecomCis.push(telecom_ci);
        }
        // console.log(' Telecom CI for Zooming:', telecom_ci);
      } else {
        console.warn(`⚠️ No feature found for: ${circleName}`);
      }
    });

    // Show districts for all selected circles
    if (allTelecomCis.length > 0) {
      this.showSelectedDistrictOnMap(allTelecomCis);
    } else {
      // No circles selected/found, hide district layer
      this.districtLayerSource.clear();
      this.districtLayer.setVisible(false);
    }

    // Add all found features to the source at once
    if (allFeatures.length > 0) {
      this.circleLayerSource.addFeatures(allFeatures);
      this.circleLayer.setVisible(true); // Make the layer visible

      // 🗺️ Zoom to feature extent
      const extent = this.circleLayerSource.getExtent();
      this.map
        .getView()
        .fit(extent, { padding: [50, 50, 50, 50], duration: 1000 });
    } else {
      this.circleLayer.setVisible(false); // Hide layer if no features
    }
  }

  showSelectedDistrictOnMap(selectedValues: any) {
    // 🧹 Clear previous features from the single source
    this.districtLayerSource.clear();

    const allFeatures: OlFeature<Geometry>[] = []; // To calculate combined extent
    // console.log(' Selected Districts:', this.allDistrictFeatures);

    selectedValues.forEach((circleName: any) => {
      const features = this.allDistrictFeatures.filter(
        (f) => f.get('indus_circ') === circleName
      );

      if (features.length > 0) {
        allFeatures.push(...features);
      } else {
        console.warn(`⚠️ No feature found for district: ${circleName}`);
      }
    });

    // Add all found features to the source at once
    if (allFeatures.length > 0) {
      this.districtLayerSource.addFeatures(allFeatures);
      this.districtLayer.setVisible(true); // Make the layer visible

      // 🗺️ Zoom to feature extent
      const extent = this.districtLayerSource.getExtent();
      this.map
        .getView()
        .fit(extent, { padding: [50, 50, 50, 50], duration: 1000 });
    } else {
      this.districtLayer.setVisible(false); // Hide if no features
    }
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
    if (this.isIDWSelected) {
      this.zoomToIndiaExtent();
    }
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

  // private async fetchWeatherData(): Promise<any[]> {
  //   try {
  //     const response = await fetch(
  //       'https://mlinfomap.biz/WeatherAPI/api/WeatherData'
  //     );
  //     if (!response.ok)
  //       throw new Error(`Error fetching weather data: ${response.status}`);
  //     const result = await response.json();
  //     if (result.message === 'Result found' && result.data?.recordsets?.[0]) {
  //       return result.data.recordsets[0].map((item: any) => ({
  //         latitude: item.Latitude,
  //         longitude: item.Longitude,
  //         temperature: parseFloat(item.CurrentTemp.replace('°C', '').trim()),
  //         location: item.Location,
  //       }));
  //     }
  //     return [];
  //   } catch (error) {
  //     console.error('Error fetching weather data:', error);
  //     return [];
  //   }
  // }

  private async fetchRiskData(): Promise<void> {
    try {
      const response = await fetch(
        'http://localhost:8083/api/WeatherDataPlaceName'
      );
      const result = await response.json();
      if (result.message === 'Result found') {
        const records = result.data.recordsets[0];
        records.forEach((item: any) => {
          const type = item.Data_Type;
          const cat = item.Category.replace(/\s/g, '');
          // this.riskData[type][cat] = { Name: item.Name_Count, State: item.State_Count };
        });
      }
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Failed to fetch risk data:', error);
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
          };
          return resultData;
        } else {
          const now = new Date();
          const currentHour = now.getHours();
          let rain6Dyas = [];
          const forecastweather =
            data.forecast.forecastday[1].hour[currentHour];
          let hoursGap = 23 - currentHour;
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

  // Assuming this.map is your OpenLayers map instance
  zoomToNewTowerLayerFeatures(layer: any): void {
    const varanasiCoordinates = fromLonLat([82.9739, 25.3176]); // [lon, lat]

    this.map.getView().setCenter(varanasiCoordinates);
    this.map.getView().setZoom(10);
  }

  closePopup() {
    if (this.popupContent && this.popupOverlay) {
      this.popupContent.innerHTML = '';
      this.popupOverlay.setPosition(undefined);
    }
  }

  //#region initialize map
  private async initializeMap(): Promise<void> {
    // this.dataPoints = await this.fetchWeatherData();

    const upBoundary = [77.0, 23.8, 84.6, 30.4];
    const upExtent = transformExtent(upBoundary, 'EPSG:4326', 'EPSG:3857');
    const upBoundaryGeometry = new Polygon([
      [
        [77.0, 23.8],
        [84.6, 23.8],
        [84.6, 30.4],
        [77.0, 30.4],
        [77.0, 23.8],
      ].map(([lon, lat]) => fromLonLat([lon, lat])),
    ]);

    const features = this.dataPoints.map(
      (dataPoint) =>
        new Feature({
          geometry: new Point(
            fromLonLat([dataPoint.longitude, dataPoint.latitude])
          ),
          value: dataPoint.temperature,
          location: dataPoint.location,
        })
    );

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
    const upLayer = new TileLayer({
      source: new TileWMS({
        url: 'http://mlinfomap.org/geoserver/weather/wms?',
        params: {
          LAYERS: 'weather:UP BND',
          FORMAT: 'image/png',
          TRANSPARENT: true,
        },
        serverType: 'geoserver',
        crossOrigin: 'anonymous',
      }),
      opacity: 0.8,
    });
    // const newTowerLayer = new VectorLayer({
    //   source: this.newtowerSource,
    //   properties: {
    //     title: 'Tower Layer',
    //     fixed: true,
    //   },
    //   style: new Style({
    //     image: new Icon({
    //       anchor: [0.5, 1],
    //       src: this.towerIconUrl,
    //       scale: 0.5,
    //     }),
    //   }),
    //   visible: true,
    //   // minZoom: 1,
    // });
    //#region Map tile
    this.map = new Map({
      target: 'map',
      layers: [
        baseMap,
        this.imgIDWTempLayer,
        this.imgIDWRainFallLayer,
        this.imgIDWWindLayer,
        this.imgIDWHumidityLayer,
        this.imgIDWFogLayer,
        // this.teleconServices,
        // newTowerLayer,
        this.circleLayer,
        this.districtLayer,
      ],
      view: new View({
        projection: 'EPSG:3857',
        center: fromLonLat([25.446356542436767, 82.83201876568786]),
        zoom: 5.5,
      }),
      controls: olDefaultControls({ zoom: false }).extend([
        new FullScreen({ source: 'map-component-container' }),
        new Zoom(),
        // new LayerToggleControl(newTowerLayer),
      ]),
    });

    // --- Popup element
    const container = document.getElementById('popup') as HTMLElement;
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

    // const colorStops = [
    //   { r: 0, g: 0, b: 255, value: 0 }, // blue
    //   { r: 0, g: 255, b: 255, value: 20 }, // cyan
    //   { r: 0, g: 255, b: 0, value: 40 }, // lime
    //   { r: 255, g: 255, b: 0, value: 60 }, // yellow
    //   { r: 255, g: 165, b: 0, value: 80 }, // orange
    //   { r: 255, g: 0, b: 0, value: 100 }, // red
    // ];

    // function colorDistance(c1: any, c2: any) {
    //   return Math.sqrt(
    //     Math.pow(c1.r - c2.r, 2) +
    //       Math.pow(c1.g - c2.g, 2) +
    //       Math.pow(c1.b - c2.b, 2)
    //   );
    // }

    // function getValueFromColor(r: any, g: any, b: any) {
    //   let input = { r, g, b };
    //   let nearest1: any = null,
    //     nearest2 = null;
    //   let minDist1: any = Infinity,
    //     minDist2 = Infinity;

    //   for (let stop of colorStops) {
    //     let dist = colorDistance(input, stop);
    //     if (dist < minDist1) {
    //       minDist2 = minDist1;
    //       nearest2 = nearest1;
    //       minDist1 = dist;
    //       nearest1 = stop;
    //     } else if (dist < minDist2) {
    //       minDist2 = dist;
    //       nearest2 = stop;
    //     }
    //   }

    //   if (minDist1 < 1) return nearest1.value;
    //   let totalDist = minDist1 + minDist2;
    //   let ratio = minDist1 / totalDist;

    //   let interpolatedValue =
    //     nearest1.value * (1 - ratio) + nearest2.value * ratio;
    //   return interpolatedValue;
    // }

    //#region Map OnClick
    this.map.on('click', async (evt) => {
      this.closePopup();
      var pixel = this.map.getEventPixel(evt.originalEvent);
      const coord = evt.coordinate;
      this.map.forEachFeatureAtPixel(pixel, async (feature: any, layer) => {
        if (layer && layer.get('title') === 'Hazard Layer') {
          let html = this.hazardDataBindPopup(feature.values_);
          this.popupContent.innerHTML = html;
          this.popupOverlay.setPosition(coord);
        } else if (layer && layer.get('title') === 'Tower Layer') {
          if (feature) {
            const payload = {
              type: 'update',
              id: this.logId,
              data: {
                tower_clicked: 'true',
              },
            };
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
            let id = feature.getId();
            if (id !== undefined && id !== null) {
              if (!this.popupOverlay) {
                return;
              }
              const targetFeature = this.newtowerSource.getFeatureById(id);
              let towerLat = targetFeature?.get('PRIORITY_LATITUDE');
              let towerLon = targetFeature?.get('PRIORITY_LONGITUDE');
              let siteName = (
                targetFeature?.get('SITE_NAME') || ''
              ).toUpperCase();
              let district = targetFeature?.get('DISTRICTNAME');
              let siteCategory = targetFeature?.get('SITECATEGORY');
              let dgStatus = targetFeature?.get('DG_STATUS');
              let circle = targetFeature?.get('CIRCLE');
              let strategic = targetFeature?.get('STRATEGIC');
              if (towerLat && towerLon) {
                this.WeatherService.setLocation(`${towerLat},${towerLon}`);
              }
              if (
                !towerLat ||
                !towerLon ||
                isNaN(towerLat) ||
                isNaN(towerLon)
              ) {
                console.warn(
                  '❌ Missing or invalid tower coordinates:',
                  towerLat,
                  towerLon
                );
                return;
              }

              const resultData = await this.getWeatherFromLatLong(
                towerLat,
                towerLon
              );
              if (!resultData) return;

              const weatherIconUrl = resultData?.icon
                ? `https:${resultData.icon}`
                : '';

              const html = `
                <div style="font-family: 'Segoe UI', sans-serif; font-size: 12px; line-height: 1.4; border-radius: 6px; padding: 6px; background: #fff;">

                  <!-- Site Information -->
                  <div style="border-bottom: 1px solid #ddd; padding-bottom: 6px; margin-bottom: 8px;">
                    <div><i class="fas fa-broadcast-tower" style="color:#007bff;"></i> <strong>SITE:</strong> ${siteName}</div>
                    <div><i class="fas fa-circle" style="color:#28a745;"></i> <strong>Circle:</strong> ${circle}</div>
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

    this.setupPointerCursor(this.map, upBoundaryGeometry);
    this.setupMapClick(this.map, upBoundaryGeometry, features);

    // this.zoomToNewTowerLayerFeatures(newTowerLayer);

    // Info of the imgIDWLayer
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
    // Mouse move event
    this.map.on('pointermove', (evt) => {
      const pointerEvt = evt.originalEvent as PointerEvent;
      const coord = evt.coordinate;
      if (!containsCoordinate(this.indiaExtent3857, coord)) {
        tooltip.style.display = 'none';
        return;
      }

      let tooltipContent: string[] = [];

      this.imgIDWLayers.forEach(({ layer, source, label }) => {
        if (layer.getVisible()) {
          const val = this.getIDWValueAtCoord(coord, source);
          if (val !== null) {
            tooltipContent.push(`${label}: ${Math.round(val)}`);
          }
        }
      });

      if (tooltipContent.length > 0) {
        tooltip.innerHTML = tooltipContent.join('<br>');
        tooltip.style.left = pointerEvt.pageX + 10 + 'px';
        tooltip.style.top = pointerEvt.pageY + 10 + 'px';
        tooltip.style.display = 'block';
      } else {
        tooltip.style.display = 'none';
      }
    });

    this.cdr.detectChanges();
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
    checkbox.checked = true; // only called when visible
    checkbox.style.width = '12px';
    checkbox.id = `layer-checkbox-${index}`;

    checkbox.addEventListener('change', () => {
      this.closePopup();
      layer.setVisible(checkbox.checked);
      if (layer.get('title') == 'Hazard Layer') {
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
    const idwLayers = ['Humidity', 'Wind', 'Rainfall', 'Temperature', 'Fog'];

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
          this.cdr.detectChanges();

          // Optional: Zoom out or re-center
          // this.map.getView().animate({
          //   center: this.initialCenter,
          //   zoom: this.initialZoom,
          //   duration: 500,
          // });
        } else {
          // Some other IDW layer is still visible – just remove this one from legend
          existingItem.remove();
          // Optional: Zoom out or re-center
        }
      } else {
        // Non-IDW layer – just remove from legend
        existingItem.remove();
        // Optional: Zoom out or re-center
        // this.map.getView().animate({
        //   center: this.initialCenter,
        //   zoom: this.initialZoom,
        //   duration: 500,
        // });
      }
    }
  }

  private setupPointerCursor(map: Map, boundary: Polygon): void {
    map.on('pointermove', (event) => {
      const hoveredCoordinate = event.coordinate;
      map.getTargetElement().style.cursor = boundary.intersectsCoordinate(
        hoveredCoordinate
      )
        ? 'pointer'
        : 'default';
    });
  }

  private setupMapClick(
    map: Map,
    boundary: Polygon,
    features: Feature[]
  ): void {
    let popupOverlay: Overlay | null = null;
  }

  //#region IDW Layer

  zoomToIndiaExtent = () => {
    this.map.getView().fit(this.indiaExtent, {
      padding: [20, 20, 20, 20],
      duration: 1000,
    });
  };

  toggleTempIDW = () => {
    this.isRainIDWLayer = false;
    this.selectedHour = new Date().getHours();
    this.generateRegionWiseWeatherIDW();
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
    this.zoomToIndiaExtent();
  };
  toggleRainIDW = () => {
    this.isRainIDWLayer = true;
    this.selectedHour = new Date().getHours();
    this.generateRegionWiseWeatherIDW();
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
    this.zoomToIndiaExtent();
  };
  toggleWindIDW = () => {
    this.isRainIDWLayer = false;
    this.selectedHour = new Date().getHours();
    this.generateRegionWiseWeatherIDW();
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
    this.zoomToIndiaExtent();
  };
  toggleHumidiyIDW = () => {
    this.isRainIDWLayer = false;
    this.selectedHour = new Date().getHours();
    this.generateRegionWiseWeatherIDW();
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
    this.zoomToIndiaExtent();
  };

  toggleFogIDW = async () => {
    this.isRainIDWLayer = false;
    this.selectedHour = new Date().getHours();
    this.generateRegionWiseWeatherIDW();
    this.zoomToIndiaExtent();
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
  };
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

  generateRegionWiseWeatherIDW = async () => {
    this.loading = true;
    const selectedDate: any = this.getDatesWithHour(this.selectedHour);
    let params = {
      selectedDate: selectedDate[this.selectedDay],
    };
    this.dataService
      .postRequest('get-current-weather', { params })
      .subscribe(async (res: any) => {
        const data = await res.data;
        if (!res.status) {
          throw new Error('Network response was not ok');
        }

        // let data = geojsonData.features;
        this.minTemp = Math.min.apply(
          null,
          data.map((item: any) => parseFloat(item.temp_c))
        );
        this.minRain = Math.min.apply(
          null,
          data.map((item: any) => parseFloat(item.chance_of_rain))
        );
        this.minWind = Math.min.apply(
          null,
          data.map((item: any) => parseFloat(item.wind_kph))
        );
        this.minHumidity = Math.min.apply(
          null,
          data.map((item: any) => parseFloat(item.humidity))
        );
        this.minFog = Math.min.apply(
          null,
          data.map((item: any) => parseFloat(item.vis_km))
        );

        this.maxTemp = Math.max.apply(
          null,
          data.map((item: any) => parseFloat(item.temp_c))
        );
        this.maxRain = Math.max.apply(
          null,
          data.map((item: any) => parseFloat(item.chance_of_rain))
        );
        this.maxWind = Math.max.apply(
          null,
          data.map((item: any) => parseFloat(item.wind_kph))
        );
        this.maxHumidity = Math.max.apply(
          null,
          data.map((item: any) => parseFloat(item.humidity))
        );
        this.maxFog = Math.max.apply(
          null,
          data.map((item: any) => parseFloat(item.vis_km))
        );

        data.forEach((item: any, index: any) => {
          // TEMP
          const coord3857 = transform(
            [item.longitude, item.latitude],
            'EPSG:4326',
            'EPSG:3857'
          );
          const featuresTemp = new ol.Feature({
            geometry: new ol.geom.Point(coord3857),
            total: item.temp_c,
            count: Math.ceil((item.temp_c / this.maxTemp) * 100),
          });
          // RAIN
          const featuresRain = new ol.Feature({
            geometry: new ol.geom.Point(coord3857),
            total: item.chance_of_rain,
            count: Math.ceil((item.chance_of_rain / this.maxRain) * 100),
          });
          // WIND
          const featureWind = new ol.Feature({
            geometry: new ol.geom.Point(coord3857),
            total: item.wind_kph,
            count: Math.ceil((item.wind_kph / this.maxWind) * 100),
          });
          // HUMIDITY
          const featureHumidity = new ol.Feature({
            geometry: new ol.geom.Point(coord3857),
            total: item.humidity,
            count: Math.ceil((item.humidity / this.maxHumidity) * 100),
          });

          // FOG
          const featureFog = new ol.Feature({
            geometry: new ol.geom.Point(coord3857),
            total: item.humidity,
            count: Math.ceil(((this.maxFog - item.vis_km) / this.maxFog) * 100),
          });
          this.vectorSourceTemp.addFeature(featuresTemp);
          this.vectorSourceRain.addFeature(featuresRain);
          this.vectorSourceWind.addFeature(featureWind);
          this.vectorSourceHumidity.addFeature(featureHumidity);
          this.vectorSourceFog.addFeature(featureFog);
        });

        let idwTemp = await new ol.source.IDW({
          source: this.vectorSourceTemp,
          weight: 'count',
        });
        let idwRain = await new ol.source.IDW({
          source: this.vectorSourceRain,
          weight: 'count',
        });
        let idwWind = await new ol.source.IDW({
          source: this.vectorSourceWind,
          weight: 'count',
        });
        let idwHumidity = await new ol.source.IDW({
          source: this.vectorSourceHumidity,
          weight: 'count',
        });
        let idwFog = await new ol.source.IDW({
          source: this.vectorSourceFog,
          weight: 'count',
        });
        await this.imgIDWTempLayer.setSource(idwTemp);
        await this.imgIDWRainFallLayer.setSource(idwRain);
        await this.imgIDWWindLayer.setSource(idwWind);
        await this.imgIDWHumidityLayer.setSource(idwHumidity);
        await this.imgIDWFogLayer.setSource(idwFog);

        await this.cropHeatMapByBoundary();

        // Convert to GeoJSON
        const geojson: any = {
          type: 'FeatureCollection',
          features: data.map((item: any) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: transform(
                [item.longitude, item.latitude],
                'EPSG:4326',
                'EPSG:3857'
              ),
            },
            properties: {
              temp_c: item.temp_c,
              chance_of_rain: item.chance_of_rain,
              wind_kph: item.wind_kph,
              humidity: item.humidity,
              vis_km: item.vis_km,
              city: item.city_name,
            },
          })),
        };

        // Vector source from GeoJSON
        const vectorSource = new VectorSource({
          features: new GeoJSON().readFeatures(geojson, {
            dataProjection: 'EPSG:3857', // your coords look like Web Mercator
            featureProjection: 'EPSG:3857',
          }),
        });

        // Style function based on temp or rain
        const styleFunction = (feature: any) => {
          const temp = feature.get('temp_c');
          const rain = feature.get('chance_of_rain');
          const city = feature.get('city');

          let color = 'blue';
          if (rain >= 80) {
            color = 'skyblue';
          } else if (temp > 33) {
            color = 'red';
          } else if (temp > 28) {
            color = 'orange';
          } else {
            color = 'green';
          }

          return new Style({
            image: new CircleStyle({
              radius: 4,
              fill: new Fill({ color }),
              stroke: new Stroke({ color: 'white', width: 2 }),
            }),
            // text: new Text({
            //   text: city,
            //   font: '12px Calibri,sans-serif',
            //   offsetY: -15,
            //   fill: new Fill({ color: '#000' }),
            //   stroke: new Stroke({ color: '#fff', width: 2 }),
            // }),
          });
        };

        // Vector layer
        const vectorLayer = new VectorLayer({
          source: vectorSource,
          style: styleFunction,
        });
      });
  };

  cropHeatMapByBoundary = async () => {
    const response = await fetch('assets/geojson/India_BND_Simplified.geojson');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const geojsonData = await response.json();

    const format = new ol.format.GeoJSON();
    const features = format.readFeatures(geojsonData, {
      featureProjection: 'EPSG:3857', // Adjust if your map uses a different projection
    });

    // Optional: collect all polygon geometries into one multipolygon
    const polygons = features.map((f: any) => f.getGeometry());

    // Merge all polygons into a single MultiPolygon
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
    this.indiaExtent = multiPolygon.getExtent();

    this.imgIDWTempLayer.addFilter(crop);
    this.imgIDWRainFallLayer.addFilter(crop);
    this.imgIDWWindLayer.addFilter(crop);
    this.imgIDWHumidityLayer.addFilter(crop);
    this.imgIDWFogLayer.addFilter(crop);
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

  // ------------- from here lasso tool function and it's dependent functionality ----------------------------

  getCurrentDateTime() {
    const now = new Date();

    // Format date → 27 Aug 2025
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    };
    const formattedDate = now.toLocaleDateString('en-GB', options);

    // Format time → 02:00 (24h format, zero-padded)
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const formattedTime = `${hours}:00`;

    return { formattedDate, formattedTime };
  }

  groupUsersByRole(data: any) {
    const grouped: {
      [role: string]: { username: string; mail: string | null; name: string }[];
    } = {};

    data.data.forEach((user: any) => {
      const role = user.role?.trim() || 'UNKNOWN'; // clean spaces & fallback
      if (!grouped[role]) {
        grouped[role] = [];
      }
      grouped[role].push({
        username: user.username?.trim(),
        mail: user.mail?.trim() || null,
        name: user.name?.trim(),
      });
    });

    // convert to array of { role, users }
    return Object.entries(grouped).map(([role, users]) => ({
      role,
      users,
    }));
  }

  lassoSource = new VectorSource();
  lassoLayer = new VectorLayer({
    source: this.lassoSource,
    style: new Style({
      stroke: new Stroke({ color: 'rgba(255,0,0,0.8)', width: 2 }),
      fill: new Fill({ color: 'rgba(255,0,0,0.2)' }),
    }),
    properties: {
      title: 'Lasso Layer',
    },
  });

  fetchUserList() {
    this.dataService
      .getWeatherUserList('get-user-list')
      .subscribe(async (res: any) => {
        this.userGroupedRoleWise = this.groupUsersByRole(res);
      });
  }

  enableLasso(): void {
    // Clear old polygons
    const { formattedDate, formattedTime } = this.getCurrentDateTime();
    this.currentDate = formattedDate;
    this.currentTime = formattedTime;
    this.lassoSource.clear();
    if (this.lassoDraw) {
      this.map.removeInteraction(this.lassoDraw);
    }
    this.lassoDraw = new Draw({
      source: this.lassoSource,
      type: 'Polygon',
      freehand: true,
    });
    this.map.addLayer(this.lassoLayer);
    this.lassoDraw.on('drawend', (event) => {
      const polygon = event.feature.getGeometry() as Polygon;
      const selected: Feature[] = [];
      this.newtowerSource.forEachFeature((f) => {
        const geom = f.getGeometry();
        if (geom && polygon.intersectsExtent(geom.getExtent())) {
          selected.push(f);
        }
      });
      const towerProps = selected.map((f) => f.getProperties());
      towerProps.forEach((props: any) => {
        const district = props.SITE_NAME || 'UNKNOWN'; // fallback if missing
        if (!this.towerGroupedByDistrict[district]) {
          this.towerGroupedByDistrict[district] = [];
        }
        this.towerGroupedByDistrict[district].push(props);
      });
      this.groupedTowerArray = Object.entries(this.towerGroupedByDistrict).map(
        ([circle, towers]) => {
          const districts = [...new Set(towers.map((t) => t.SITE_NAME))];
          const assignedUsers = districts.flatMap((district) => {
            const roleGroup = this.userGroupedRoleWise.find(
              (u: any) => u.role === district
            );
            return roleGroup
              ? roleGroup.users.map((u: any) => ({
                  name: u.name,
                  mail: u.mail,
                }))
              : [];
          });
          return {
            circle,
            siteCount: towers.length,
            districts,
            users: assignedUsers, //  array of names only
          };
        }
      );
      if (this.groupedTowerArray.length > 0) {
        this.isTowersSelected = true;
        this.cdr.detectChanges();
      }
      this.map.removeInteraction(this.lassoDraw!);
    });
    this.map.addInteraction(this.lassoDraw);
  }

  closeTowerList() {
    this.isTowersSelected = false;
    this.groupedTowerArray = [];
    if (this.lassoLayer && this.map) {
      this.map.removeLayer(this.lassoLayer);
    }
  }
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
}
