import { Severity } from './../../components/severity/severity';
import {
  Component,
  OnInit,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  NgZone,
  NgModule,
} from '@angular/core';
// import { MapWeather } from '../../components/map-weather/map-weather';
import { circle } from '@turf/turf';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapWeather } from '../../components/map-weather/map-weather';
import { DataService } from '../../data-service/data-service';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import shp from 'shpjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import GeoJSON from 'ol/format/GeoJSON';
import { fromLonLat, transformExtent, transform } from 'ol/proj';
import { Control, FullScreen, Zoom } from 'ol/control';
import Overlay from 'ol/Overlay';
import { Geometry, LineString } from 'ol/geom';
import { defaults as olDefaultControls } from 'ol/control/defaults';
import VectorSource, { VectorSourceEvent } from 'ol/source/Vector';
import { Style, Circle, Fill, Stroke, Text, Icon } from 'ol/style';
import { Feature as OlFeature } from 'ol';
import * as turf from '@turf/turf';
import * as olProj from 'ol/proj';
import * as olGeom from 'ol/geom';
import { Feature } from 'ol';
import { circular } from 'ol/geom/Polygon';
import { Circle as CircleGeom, Polygon, Point, MultiPolygon } from 'ol/geom';
import { getDistance } from 'ol/sphere';
import buffer from '@turf/buffer';
import union from '@turf/union';
import CircleStyle from 'ol/style/Circle';
import { Extent } from 'ol/extent';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
declare const ol: any;

@Component({
  selector: 'app-hazards-feed , map-weather',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  districtSearch: string = '';
  filteredDistrictList: any = [];
  circleList: any = [];
  insertedCircleList: any = [];
  districtList: any = [];

  severityList = ['Extreme', 'High', 'Moderate', 'Low'];
  days = ['Day1', 'Day2', 'Day3', 'Day4', 'Day5', 'Day6', 'Day7'];

  selectedCircle: any = '';
  selectedSeverity: any = '';
  selectedDay: any = '';

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

  popupElement!: HTMLElement;
  popupContent!: HTMLElement;
  popupCloser!: HTMLElement;
  popupOverlay!: any;
  map!: Map;
  initialCenter = fromLonLat([82.8320187, 25.4463565]);

  phenomenalDistricts: any[] = [];
  veryHighSeasDistricts: any[] = [];
  highToVeryHighRoughSeasDistricts: any[] = [];
  veryRoughSeasDistricts: any[] = [];

  selectedDate: string = '';
  cycloneDate: any = [];

  groupedPointData: any[] = [];
  uploadedFiles: any = {
    point: null,
    line: null,
    cone: null,
    buffer: null,
  };

  vectorLayers: any = {};
  // Source of Circle
  circleVectorSource: any = new VectorSource({
    url: 'https://mlinfomap.org/geoserver/Indus_Tower/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Indus_Tower%3ATelecom_Circle&outputFormat=application%2Fjson&maxFeatures=100',
    format: new GeoJSON(),
  });

  format = new GeoJSON();

  indiaExtent: Extent = [
    fromLonLat([68.176645, 6.747139]), // Southwest corner (approx. Gujarat/Kerala)
    fromLonLat([97.402561, 35.494009]), // Northeast corner (Arunachal Pradesh)
  ].flat() as Extent;

  isIDWLayer: boolean = false;
  isRainIDWLayer: boolean = false;

  minRange: any;
  maxRange: any;

  minRain: any;
  maxRain: any;

  minWind: any;
  maxWind: any;

  vectorSourceRain = new ol.source.Vector({});
  vectorSourceWind = new ol.source.Vector({});

  severityDistrictsList: number = 0;

  imgIDWRainFallLayer = new ol.layer.Image({
    title: 'Rainfall',
    id: 'RainIDW',
    opacity: 0.6,
    visible: true,
  });

  imgIDWWindLayer = new ol.layer.Image({
    title: 'Wind',
    id: 'WindIDW',
    opacity: 0.6,
    visible: true,
  });
  imgIDWLayers = [
    {
      layer: this.imgIDWRainFallLayer,
      source: this.vectorSourceRain,
      label: 'Rain ',
    },

    {
      layer: this.imgIDWWindLayer,
      source: this.vectorSourceWind,
      label: 'Wind ',
    },
  ];

  // url: 'assets/geojson/WarningBaseLayerIndianDistrict.json',
  indianDistrictLayer = new VectorLayer({
    source: new VectorSource(),
    properties: {
      title: 'Districts Layer',
    },
  });

  showSeverityPanel = false;

  districtColorsDayWise: {
    id: string;
    [key: string]: string;
    color: string;
  }[] = [
    { id: '1', name: 'Warning (Take Action)', color: '#ff00b3ff' },
    { id: '2', name: 'Alert (Be Prepared)', color: '#c46200ff' },
    { id: '3', name: 'Watch (Be Updated)', color: '#ffff00ff' },
    { id: '4', name: 'No Warning (No Action)', color: '#00ff00ff' },
  ];

  isRainLayerVisible: boolean = false;
  isWindLayerVisible: boolean = false;

  indiaDistrictsDataGeoJsonData: any;
  indiaDistrictsVectorSource = new VectorSource();

  selectedHour: number = new Date().getHours();

  constructor(
    private dataService: DataService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.loadCircleListForDropdown();
    // this.getSelectedtHazardData();
    this.loadIndiaDistrictsData();
  }

  generateRegionWiseWeatherIDW = async () => {
    const selectedDate: any = this.getDatesWithHour(this.selectedHour);
    let params = {
      selectedDate: selectedDate['today'],
    };
    this.dataService
      .postRequest('get-current-weather', { params })
      .subscribe(async (res: any) => {
        const data = await res.data;
        if (!res.status) {
          throw new Error('Network response was not ok');
        }

        // let data = geojsonData.features;

        this.minRain = Math.min.apply(
          null,
          data.map((item: any) => parseFloat(item.chance_of_rain))
        );
        this.minWind = Math.min.apply(
          null,
          data.map((item: any) => parseFloat(item.wind_kph))
        );

        this.maxRain = Math.max.apply(
          null,
          data.map((item: any) => parseFloat(item.chance_of_rain))
        );
        this.maxWind = Math.max.apply(
          null,
          data.map((item: any) => parseFloat(item.wind_kph))
        );

        data.forEach((item: any, index: any) => {
          // TEMP
          const coord3857 = [item.longitude, item.latitude];

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

          this.vectorSourceRain.addFeature(featuresRain);
          this.vectorSourceWind.addFeature(featureWind);
        });

        let idwRain = await new ol.source.IDW({
          source: this.vectorSourceRain,
          weight: 'count',
        });
        let idwWind = await new ol.source.IDW({
          source: this.vectorSourceWind,
          weight: 'count',
        });

        await this.imgIDWRainFallLayer.setSource(idwRain);
        await this.imgIDWWindLayer.setSource(idwWind);
        await this.cropHeatMapByBoundary();

        // Convert to GeoJSON
        const geojson: any = {
          type: 'FeatureCollection',
          features: data.map((item: any) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [item.longitude, item.latitude],
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
          features: new GeoJSON().readFeatures(geojson),
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
          });
        };
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
      featureProjection: 'EPSG:4326',
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

    this.imgIDWRainFallLayer.addFilter(crop);
    this.imgIDWWindLayer.addFilter(crop);
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

  loadIndiaDistrictsData() {
    this.dataService
      .postData('get_india_districts')
      .pipe(
        catchError((error) => {
          console.error('API Error: ', error);
          return throwError(() => error);
        })
      )
      .subscribe((response) => {
        if (response.status === 'success') {
          this.indiaDistrictsDataGeoJsonData = response.data; // MUST be valid GeoJSON
         
          if (this.indiaDistrictsDataGeoJsonData) {
            this.addDistrictSourceToLayer();
            this.generateRegionWiseWeatherIDW();
          }
        }
      });
  }

  addDistrictSourceToLayer() {
    // Convert GeoJSON data to OL features
    const features = new GeoJSON().readFeatures(
      this.indiaDistrictsDataGeoJsonData,
      {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:4326',
      }
    );

    // Create vector source with these features
    this.indiaDistrictsVectorSource = new VectorSource({
      features: features,
    });

    this.indianDistrictLayer.setSource(this.indiaDistrictsVectorSource);
    this.indianDistrictLayer.setStyle((feature: any) =>
      this.getDistrictStyle(feature)
    );
  }

  private getDistrictStyle(feature: any): Style {
    const featureDateStr = feature.get('Date');
    const dayColors = [
      feature.get('day1_color'),
      feature.get('day2_color'),
      feature.get('day3_color'),
      feature.get('day4_color'),
      feature.get('day5_color'),
    ];

    const featureDate = new Date(featureDateStr);
    const currentDate = new Date();
    featureDate.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor(
      (currentDate.getTime() - featureDate.getTime()) / (1000 * 3600 * 24)
    );

    let selectedDayIdx = Math.min(Math.max(diffDays, 0), 4);

    const colorId = dayColors[selectedDayIdx];
    const matchingColor =
      this.districtColorsDayWise.find((item) => item.id == colorId)?.color ||
      '#eb1c1cff';

    return new Style({
      fill: new Fill({
        color: this.hexToRgba(matchingColor, 0.4),
      }),
      stroke: new Stroke({
        color: '452829',
        width: 0.3,
      }),
    });
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

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
        this.circleVectorLayer,
        this.indianDistrictLayer,
        this.imgIDWRainFallLayer,
        this.imgIDWWindLayer,
      ],

      view: new View({
        projection: 'EPSG:4326',

        center: this.initialCenter,
        zoom: 4,
        minZoom: 0,
        maxZoom: 11,
      }),

      controls: olDefaultControls({ zoom: false }).extend([new Zoom()]),
    });

    this.popupElement = document.getElementById('popup') as HTMLElement;
    this.popupOverlay = new Overlay({
      element: this.popupElement,
      positioning: 'bottom-center',
      stopEvent: true,
      autoPan: {
        margin: 20,
        animation: {
          duration: 250,
        },
      },
    });
    this.map.addOverlay(this.popupOverlay);
    //   this.map.on('singleclick', (event) => {
    //
    //     const feature = this.map.forEachFeatureAtPixel(event.pixel, (ft) => ft);

    //     if (!feature) {
    //       this.popupOverlay.setPosition(undefined);
    //       return;
    //     }

    //     const geometry: any = feature.getGeometry();
    //     const coordinate = geometry.getCoordinates(); // 👈 Correct anchor point

    //     const props = feature.getProperties();

    //     const message = `
    //   <b>Category:</b>  ${props['category']}<br>
    //   <b>Point Type:</b> ${props['PointType']} <br>
    //   <b>Date:</b> ${props['date_time_utc']} <br>
    //   <b>Wind:</b> ${props['max_sustained_wind_kmph']} <br>
    // `;

    //     this.popupElement.innerHTML = message;
    //     this.popupOverlay.setPosition(coordinate);
    //   });

    // --- Set initial Z-Index for all layers map is created ---

    this.map.on('singleclick', (event) => {
      let clickedFeature: any = null;
      let clickedLayer: any = null;

      this.map.forEachFeatureAtPixel(
        event.pixel,
        (feature, layer) => {
          clickedFeature = feature;
          clickedLayer = layer;
          return true; // stop after the first match
        },
        {
          hitTolerance: 5, // Optional: makes clicking easier
        }
      );

      if (!clickedFeature) {
        this.popupOverlay.setPosition(undefined);
        return;
      }
      const layerName = clickedLayer?.get('title') || 'Unknown Layer';
      const props = clickedFeature.getProperties();

      let message = '';
      if (layerName === 'Buffer Layer') {
        message = `
        <b>Layer:</b> ${layerName}<br> 
        <b>Severity:</b> ${props['severity']}<br> 
        `;
      } else if (layerName === 'Point Layer') {
        message = `
                  <b>Layer:</b> ${layerName}<br>
                  <b>Category:</b> ${props['category']}<br>
                  <b>Point Type:</b> ${props['PointType']}<br>
                  <b>Date:</b> ${props['date_time_utc']}<br>
                  <b>Wind:</b> ${props['max_sustained_wind_kmph']}<br>
                `;
      }

      this.popupElement.innerHTML = message;
      this.popupOverlay.setPosition(event.coordinate);
    });

    this.circleVectorLayer.setZIndex(1);
    this.map.getView().fit([68.17665, 6.55461, 97.39536, 35.67454], {
      padding: [20, 20, 20, 20],
      duration: 800,
    });
    this.renderLegend(this.map);
  }

  waitForLayerLoad(layer: any): Promise<void> {
    return new Promise((resolve) => {
      const source = layer.getSource();

      if (source.getFeatures().length > 0) {
        resolve();
        return;
      }

      source.on('featuresloadend', () => {
        resolve();
      });

      source.on('change', () => {
        if (source.getState() === 'ready' && source.getFeatures().length > 0) {
          resolve();
        }
      });
    });
  }

  //#region layer-legend
  renderLegend(map: Map): void {
    const legendContainer: any = document.getElementById('hazard-legend-list');
    if (!legendContainer) return;

    legendContainer.innerHTML = ''; // Clear existing legend

    const autoUncheckedLayers = ['Rainfall', 'Wind'];
    const layers = map.getLayers().getArray();

    layers.forEach((layer, index) => {
      const layerId = `layer-${index}`;
      layer.set('layerId', layerId);

      // Add visibility change listener only once
      if (!layer.get('legendListenerAdded')) {
        layer.on('change:visible', () => {
          this.updateLegendItem(layer, index);
        });
        layer.set('legendListenerAdded', true);
      }

      // Auto hide rainfall/wind but do not trigger legend twice
      const layerName = layer.get('title');
      if (autoUncheckedLayers.includes(layerName)) {
        setTimeout(() => layer.setVisible(false));
      }

      // Only add to legend once
      if (!document.getElementById(layerId)) {
        this.renderLegendItem(layer, index, legendContainer);
      }
    });

    // Handle new layer addition
    map.getLayers().on('add', (event) => {
      const newLayer = event.element;
      const index = layers.indexOf(newLayer);
      const id = `layer-${index}`;
      newLayer.set('layerId', id);

      const name = newLayer.get('title');
      if (autoUncheckedLayers.includes(name)) {
        setTimeout(() => newLayer.setVisible(false));
      }

      if (!document.getElementById(id)) {
        this.renderLegendItem(newLayer, index, legendContainer);
      }

      if (!newLayer.get('legendListenerAdded')) {
        newLayer.on('change:visible', () => {
          this.updateLegendItem(newLayer, index);
        });
        newLayer.set('legendListenerAdded', true);
      }
    });

    // Handle layer removal
    map.getLayers().on('remove', (event) => {
      const removedLayer = event.element;
      const id = removedLayer.get('layerId');
      const fixed =
        removedLayer.get('fixed') || removedLayer.get('legendFixed');
      if (fixed) return;

      document.getElementById(id)?.remove();
    });
  }

  renderLegendItem(
    layer: any,
    index: number,
    legendContainer: HTMLElement
  ): void {
    const layerName = layer.get('title') || `Layer ${index + 1}`;
    const layerId = layer.get('layerId') || `layer-${index}`;

    if (document.getElementById(layerId)) return;

    const autoUncheckedLayers = ['Rainfall', 'Wind'];

    const listItem = document.createElement('li');
    listItem.id = layerId;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.style.width = '12px';
    checkbox.id = `layer-checkbox-${index}`;
    checkbox.checked = !autoUncheckedLayers.includes(layerName);

    checkbox.addEventListener('change', () => {
      layer.setVisible(checkbox.checked);
    });

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.innerText = layerName;
    label.style.marginLeft = '4px';
    label.classList.add('layer-label');

    listItem.appendChild(checkbox);
    listItem.appendChild(label);
    legendContainer.appendChild(listItem);

    checkbox.addEventListener('change', () => {
      const layerName = layer.get('title');
      const checked = checkbox.checked;

      layer.setVisible(checked);

      if (layerName === 'Rainfall') {
        this.isRainLayerVisible = checked;
      }

      if (layerName === 'Wind') {
        this.minRange = `${this.minWind} (kph)`;
        this.maxRange = `${this.maxWind} (kph)`;
        this.isWindLayerVisible = checked;
      }

      this.updateIDWLegend();
    });
  }

  updateIDWLegend() {
    if (!this.isRainLayerVisible && !this.isWindLayerVisible) {
      this.isIDWLayer = false;
      this.cdr.detectChanges();
      return;
    }

    this.isIDWLayer = true;

    if (this.isRainLayerVisible) {
      this.isRainIDWLayer = true;
    } else if (this.isWindLayerVisible) {
      this.isRainIDWLayer = false;
    }
    this.cdr.detectChanges();
  }

  updateLegendItem(layer: any, index: number): void {
    const layerId = layer.get('layerId') || `layer-${index}`;
    const existingItem = document.getElementById(layerId);
    if (!existingItem) return;

    const checkbox = existingItem.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = layer.getVisible();
    }
  }

  //Layer of Circle

  getDistrictsBySeverity(severityBufferLayer: any, indianDistrictLayer: any) {
    const severityFeatures = severityBufferLayer.getSource().getFeatures();
    const districtFeatures = indianDistrictLayer.getSource().getFeatures();

    // Output buckets (new categories)
    const Phenomenal: any = [];
    const VeryHighSeas: any = [];
    const HighToVeryHighRoughSeas: any = [];
    const VeryRoughSeas: any = [];

    const usedDistricts = new Set();

    const toGeoJSON = (feature: any) =>
      new GeoJSON().writeFeatureObject(feature);

    // Group severity features
    const severityGroups: any = {
      Phenomenal: [],
      VeryHighSeas: [],
      HighToVeryHighRoughSeas: [],
      VeryRoughSeas: [],
    };

    severityFeatures.forEach((f: any) => {
      const s = f.get('severity')?.trim();
      if (!s) return;

      if (s === 'Phenomenal') severityGroups.Phenomenal.push(f);
      else if (s === 'Very high seas') severityGroups.VeryHighSeas.push(f);
      else if (s === 'High to very high rough seas')
        severityGroups.HighToVeryHighRoughSeas.push(f);
      else if (s === 'Very rough seas') severityGroups.VeryRoughSeas.push(f);
    });

    // Priority order (highest → lowest)
    const priority = [
      'Phenomenal',
      'VeryHighSeas',
      'HighToVeryHighRoughSeas',
      'VeryRoughSeas',
    ];

    priority.forEach((level) => {
      severityGroups[level].forEach((sevFeature: any) => {
        const sevGeo = toGeoJSON(sevFeature);

        districtFeatures.forEach((dist: any) => {
          const districtId = dist.get('DISTRICT_ID') || dist.getId();

          if (usedDistricts.has(districtId)) return;

          const distGeo = toGeoJSON(dist);
          const intersects = turf.booleanIntersects(distGeo, sevGeo);

          if (intersects) {
            const name = dist.get('District');

            if (level === 'Phenomenal') Phenomenal.push(name);
            else if (level === 'VeryHighSeas') VeryHighSeas.push(name);
            else if (level === 'HighToVeryHighRoughSeas')
              HighToVeryHighRoughSeas.push(name);
            else VeryRoughSeas.push(name);

            usedDistricts.add(districtId);
          }
        });
      });
    });

    return {
      Phenomenal,
      VeryHighSeas,
      HighToVeryHighRoughSeas,
      VeryRoughSeas,
    };
  }

  circleVectorLayer = new VectorLayer({
    source: this.circleVectorSource,
    style: (feature) => this.styleFunctionCircleLayer(feature),
    properties: {
      title: 'Circles',
      legendFixed: true,
    },
  });

  styleFunctionCircleLayer = (feature: any) => {
    const circleName = feature.get('indus_circ') || 'Unnamed Circle';
    const zoom: any = this.map.getView().getZoom();

    const style: any = new Style({
      stroke: new Stroke({ color: '#1518d6ff', width: 1.25 }),
      fill: new Fill({ color: 'rgba(2, 32, 18, 0.05)' }),
    });

    if (zoom < 8) {
      const fontSize = Math.max(4, zoom * 3);

      style.setText(
        new Text({
          text: circleName.toUpperCase(),
          font: `900 ${fontSize}px Calibri, sans-serif`,
          textAlign: 'center',
          placement: 'point',
          overflow: true,
          fill: new Fill({ color: '#000000' }),
          stroke: new Stroke({
            color: '#ffffff',
            width: Math.max(1, fontSize / 5),
          }),
        })
      );

      const allFeatures = this.circleVectorSource.getFeatures();
      const firstFeature = allFeatures.find(
        (f: any) => f.get('indus_circ') === circleName
      );

      if (firstFeature) {
        if (feature.getId() !== firstFeature.getId()) {
          style.setText(null);
        }
      }
    } else {
      style.setText(null);
    }

    return style;
  };

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
    this.tableData = [];
    this.loadCircleListForDropdown();
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
    // console.log('Final Submitted Data:', this.finalSubmittedData);
    const hasAllDays = this.days.every((day) =>
      this.finalSubmittedData.some((item) => item.day === day)
    );

    if (!hasAllDays) {
      alert('Please add all days in the table!');
    } else {
      this.insertHazards(this.finalSubmittedData);
      this.form = {
        circle: '',
        districts: [],
        severity: '',
        day: '',
        date: '',
        hazardValue: '',
        description: '',
      };
      this.tableData = [];
      this.districtList = [];
    }
  }

  showmap() {
    this.showMapFull = true;
    setTimeout(() => {
      this.initializeMap();
    }, 100);
  }

  closeMap() {
    this.showMapFull = false;
  }
  deleteSelectedRow(index: number) {
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

  editTableRecords(index: number) {
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
    this.selectedSeverity = row.severity;
    this.selectedDay = row.day;
    this.addDistrictInDropdownList(row);
  }

  // Submit / Update
  addNewRecord() {
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
    this.selectedSeverity = this.form.severity;
    this.selectedDay = this.form.day;
    this.getAvailableSeverities(this.selectedDay);
    this.removeDistrictsForDropodwn(this.tableData);

    // Reset form
    this.form = {
      circle: this.selectedCircle,
      districts: [],
      severity: '',
      day: this.selectedDay,
      date: '',
      hazardValue: '',
      description: '',
    };
  }

  getAvailableSeverities = (day: any) => {
    const record = this.tableData.filter((item) => item.day === day);
    let alreadySelectedSeverity: any = record.map((item) => item.severity);
    if (alreadySelectedSeverity.length > 0) {
      const setSeverity = new Set(alreadySelectedSeverity);
      this.severityList = this.severityList.filter(
        (s: any) => !setSeverity.has(s)
      );
      this.severityList.sort();
    } else {
      this.severityList = ['Extreme', 'High', 'Moderate', 'Low'];
    }
  };

  getAvailableDistricts = (day: any) => {
    this.form.districts = [];
    const filterTableData = this.tableData.filter((item) => item.day === day);
    const alreadySelectedDistrict = new Set(
      filterTableData.flatMap((item: any) => item.districts)
    );
    // let alreadySelectedDistrict: any = record.map((item) => item.districts);
    if (alreadySelectedDistrict.size > 0) {
      this.districtList = this.districtList.filter(
        (d: any) => !alreadySelectedDistrict.has(d.district)
      );
      this.districtList.sort((a: any, b: any) =>
        a.district.localeCompare(b.district)
      );

      this.filteredDistrictList = this.filteredDistrictList.filter(
        (d: any) => !alreadySelectedDistrict.has(d.district)
      );
      this.filteredDistrictList.sort((a: any, b: any) =>
        a.district.localeCompare(b.district)
      );
    } else {
      this.loadDistrictListForDropdown();
    }
  };

  getDateFromSelectedDay = (day: any) => {
    this.selectedDay = day;
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
    this.getAvailableSeverities(day);
    this.getAvailableDistricts(day);
    // console.log(this.tableData);
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

  onCircleChange = () => {
    this.selectedCircle = this.form.circle;
    // this.loadDistrictListForDropdown();
  };

  onDistrictSearch() {
    const search = this.districtSearch.toLowerCase();
    this.filteredDistrictList = this.districtList.filter((d: any) =>
      d.district.toLowerCase().includes(search)
    );
  }

  removeDistrictsForDropodwn = (tableData: any) => {
    // District
    const usedDistricts = new Set(
      tableData.flatMap((item: any) => item.districts)
    );
    this.districtList = this.districtList.filter(
      (d: any) => !usedDistricts.has(d.district)
    );
    this.districtList.sort((a: any, b: any) =>
      a.district.localeCompare(b.district)
    );

    this.filteredDistrictList = this.filteredDistrictList.filter(
      (d: any) => !usedDistricts.has(d.district)
    );
    this.filteredDistrictList.sort((a: any, b: any) =>
      a.district.localeCompare(b.district)
    );
    // Severity
    // this.severityList = this.severityList.filter(
    //   (d) => d !== this.selectedSeverity
    // );
    // this.severityList.sort();

    // D-ays
    // this.days = this.days.filter((d) => d !== this.selectedDay);
    // this.days.sort();
  };

  addDistrictInDropdownList = (row: any) => {
    row.districts.forEach((dist: string) => {
      // Add only if district not already present
      if (!this.districtList.some((d: any) => d.district === dist)) {
        this.districtList.push({ district: dist });
      }
      if (!this.filteredDistrictList.some((d: any) => d.district === dist)) {
        this.filteredDistrictList.push({ district: dist });
      }
    });
    this.districtList.sort((a: any, b: any) =>
      a.district.localeCompare(b.district)
    );
    this.filteredDistrictList.sort((a: any, b: any) =>
      a.district.localeCompare(b.district)
    );

    // Severity
    this.getAvailableSeverities(row.day);
    if (row.severity !== '' && !this.severityList.includes(row.severity)) {
      this.severityList.push(row.severity);
      this.severityList.sort();
    }

    // D-ays
    // if (row.day !== '') {
    //   this.days.push(row.day);
    //   this.days.sort();
    // }
  };

  //#region API CaLL
  loadCircleListForDropdown = () => {
    this.circleList = [];
    this.dataService
      .postData('get_circle_list', { circle: 'All Circle' })
      .subscribe((res: any) => {
        this.ngZone.run(async () => {
          if (res && res.status && Array.isArray(res.data)) {
            let circles = res.data.filter(
              (c: any) => c.circle !== 'All Circle'
            );

            // Remove already inserted circle
            const insertedCircleList: any =
              await this.insertedHazardCirclesList();
            const usedCircle = insertedCircleList.map(
              (item: any) => item.indus_circle
            );
            const filterCircles = circles.filter(
              (c: any) => !usedCircle.includes(c.circle)
            );

            const mapped = filterCircles
              .map((circleName: { circle: string; location: string }) => ({
                value: circleName.location,
                label: circleName.circle,
              }))
              .sort((a: any, b: any) => a.label.localeCompare(b.label));
            this.circleList = [...mapped]; // <-- new reference
            // If using OnPush:
            this.cdr.markForCheck();
          } else {
            this.circleList = [];
            this.cdr.markForCheck();
          }
        });
      });
  };

  async insertedHazardCirclesList() {
    try {
      this.insertedCircleList = [];
      const res: any = await this.dataService
        .postData('inserted_hazard_circle_list', {
          hazard: this.activeHazardTab,
        })
        .toPromise();

      if (res && res.status && Array.isArray(res.data)) {
        this.insertedCircleList = [...res.data]; // new array reference
      } else {
        console.error('Invalid API response format');
        this.insertedCircleList = [];
      }
    } catch (error) {
      console.error('API error:', error);
      this.insertedCircleList = [];
    }

    return this.insertedCircleList;
  }

  async loadDistrictListForDropdown() {
    try {
      this.districtList = [];
      this.filteredDistrictList = [];
      const res: any = await this.dataService
        .postData('get_district_list', { circle: this.selectedCircle })
        .toPromise();

      this.ngZone.run(() => {
        if (res && res.status && Array.isArray(res.data)) {
          // ALWAYS create new array reference
          this.districtList = [...res.data];
          this.filteredDistrictList = [...this.districtList];
          // If using ChangeDetectionStrategy.OnPush
          this.cdr.markForCheck();
        } else {
          console.error(
            'Failed to load district list: Invalid API response format'
          );
          this.districtList = [];
          this.filteredDistrictList = [];
          this.cdr.markForCheck();
        }
      });
    } catch (error) {
      console.error('Failed to load district list from API:', error);
      this.ngZone.run(() => {
        this.districtList = [];
        this.filteredDistrictList = [];
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

          // FIX: flat array, not nested array
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

  //#region File Handle

  onFileSelected(event: Event, type: string): void {
    const input = event.target as HTMLInputElement;
    if (!input || !input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (!['json', 'geojson', 'shp'].includes(ext)) {
      alert('Only JSON, GeoJSON, or SHP files are allowed.');
      input.value = '';
      return;
    }

    if (ext === 'shp') {
      this.handleShapefile(file, type);
    } else {
      this.handleJsonFile(file, type);
    }
  }

  //  JSON / GEOJSON handling
  handleJsonFile(file: File, type: string): void {
    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (!e.target || typeof e.target.result !== 'string') return;

      try {
        const jsonData = JSON.parse(e.target.result);
        this.uploadedFiles[type] = jsonData;
        // this.createVectorLayer(type, jsonData);
      } catch (err) {
        console.error('Invalid JSON/GeoJSON file');
        alert('Invalid JSON or GeoJSON file.');
      }
    };

    reader.readAsText(file);
  }

  //  SHP handling using shpjs
  async handleShapefile(file: File, type: string): Promise<void> {
    try {
      const arrayBuffer = await file.arrayBuffer();

      const geojson = await shp(arrayBuffer); // shpjs auto-detects SHP/ZIP
      this.uploadedFiles[type] = geojson;

      // this.createVectorLayer(type, geojson);
    } catch (error) {
      console.error('Error reading SHP:', error);
      alert('Failed to read shapefile. Ensure it is a valid SHP or ZIP.');
    }
  }

  AddLayerToMap() {
    for (const type of Object.keys(this.uploadedFiles)) {
      if (this.uploadedFiles[type]) {
        this.createVectorLayer(type, this.uploadedFiles[type]);
      }
    }

    Promise.all([
      this.waitForLayerLoad(this.vectorLayers['buffer']),
      this.waitForLayerLoad(this.indianDistrictLayer),
    ])
      .then(() => {
        const result = this.getDistrictsBySeverity(
          this.vectorLayers['buffer'],
          this.indianDistrictLayer
        );

        this.phenomenalDistricts = [...result['Phenomenal']];
        this.veryHighSeasDistricts = [...result['VeryHighSeas']];
        this.highToVeryHighRoughSeasDistricts = [
          ...result['HighToVeryHighRoughSeas'],
        ];
        this.veryRoughSeasDistricts = [...result['VeryRoughSeas']];

        // console.log('Severity result:', result);
        this.severityDistrictsList = Math.max(
          ...[
            this.phenomenalDistricts.length,
            this.veryHighSeasDistricts.length,
            this.highToVeryHighRoughSeasDistricts.length,
            this.veryRoughSeasDistricts.length,
          ]
        );
      })
      .catch((error) => {
        console.log(`Error while taking out the features : ${error}`);
      });
  }

  //  Create vector layer for uploaded file
  createVectorLayer(type: string, geojsonData: any): void {
    try {
      const format = new GeoJSON();
      const vectorSource = new VectorSource({
        features: format.readFeatures(geojsonData, {
          featureProjection: 'EPSG:4326',
        }),
      });

      let layerName = '';
      let layerTitle = '';
      let layerStyle: any;

      // POINT LAYER STYLE
      if (type === 'point') {
        layerName = 'pointLayer';
        layerTitle = 'Point Layer';

        layerStyle = (feature: any) => {
          const category = feature.get('category');
          const pointType = feature.get('PointType'); // "Forcast" or "Observed"

          const isForecast = pointType === 'Forcast';

          // 🔹 Cyclonic Storm (Icon style)
          if (category === 'Cyclonic Storm') {
            const iconSrc = isForecast
              ? 'assets/icons/whirlwind.svg'
              : 'assets/icons/whirlwind_black.svg';

            return new Style({
              image: new Icon({
                src: iconSrc,
                scale: 0.6,
              }),
            });
          }

          // 🔹 Deep Depression Style (Red & Black)
          if (category === 'Deep Depression') {
            const fillColor = isForecast ? '#a20707' : '#000000';

            return new Style({
              image: new CircleStyle({
                radius: 8, // Bigger curve because deeper cyclone
                fill: new Fill({ color: fillColor }),
                stroke: new Stroke({
                  color: fillColor,
                  width: 2,
                }),
              }),
            });
          }

          // 🔹 Depression Style (Orange & Grey)
          if (category === 'Depression') {
            const fillColor = isForecast ? '#a20707' : '#000000';

            return new Style({
              image: new CircleStyle({
                radius: 6,
                fill: new Fill({ color: fillColor }),
                stroke: new Stroke({
                  color: fillColor,
                  width: 2,
                }),
              }),
            });
          }

          // 🔹 Default fallback (if something missing in data)
          return new Style({
            image: new CircleStyle({
              radius: 5,
              fill: new Fill({ color: 'black' }),
              stroke: new Stroke({
                color: '#000000ff',
                width: 2,
              }),
            }),
          });
        };

        // ⭐ ADD LINE JOINING POINTS ⭐
        const features: any = vectorSource.getFeatures();
        if (features.length > 1) {
          features.sort((a: any, b: any) => {
            const tA = new Date(a.get('date_time_utc')).getTime();
            const tB = new Date(b.get('date_time_utc')).getTime();
            return tA - tB;
          });
          this.createLineForOrderedPoints(features);
        }
      }

      // LINE LAYER STYLE
      else if (type === 'line') {
        layerName = 'lineLayer';
        layerTitle = 'Line Layer';

        layerStyle = new Style({
          stroke: new Stroke({
            color: '#d1834f',
            width: 3,
          }),
        });
      }

      // CONE LAYER STYLE
      else if (type === 'cone') {
        layerName = 'coneLayer';
        layerTitle = 'Cone Layer';

        layerStyle = new Style({
          fill: new Fill({
            color: 'rgba(231, 176, 139, 0.3)',
          }),
          stroke: new Stroke({
            color: '#d1834f',
            width: 2,
          }),
        });
      }

      // BUFFER LAYER STYLE (DYNAMIC COLOR)
      else if (type === 'buffer') {
        layerName = 'bufferLayer';
        layerTitle = 'Buffer Layer';

        layerStyle = (feature: any) => {
          const severity = feature.get('severity');

          let fillColor = '#ecc36a33'; // default
          let strokeColor = '#ecc36a33';

          if (severity === 'Very rough seas') {
            fillColor = 'rgba(208, 206, 207, 0.3)';
            strokeColor = '#d0cecf';
          } else if (severity === 'High to very high rough seas') {
            fillColor = 'rgba(141, 170, 218, 0.3)';
            strokeColor = '#8daada';
          } else if (severity === 'Very high seas') {
            fillColor = 'rgba(55, 202, 68, 0.3)';
            strokeColor = '#37ca44';
          } else if (severity === 'Very high seas') {
            fillColor = 'rgba(255, 255, 0, 0.3)';
            strokeColor = '#ffff00';
          }
          return new Style({
            fill: new Fill({ color: fillColor }),
            stroke: new Stroke({ color: strokeColor, width: 3 }),
          });
        };
      }

      // CREATE VECTOR LAYER
      this.vectorLayers[type] = new VectorLayer({
        source: vectorSource,
        style: layerStyle,
        properties: {
          name: layerName,
          title: layerTitle,
          type: type,
        },
      });

      // ADD TO MAP
      this.addLayerIfNotExists(this.vectorLayers[type]);
      // 🔥 Auto zoom to layer with features
      setTimeout(() => {
        const source = vectorSource;

        if (source && source.getFeatures().length > 0) {
          const extent = source.getExtent();

          this.map.getView().fit(extent, {
            padding: [500, 500, 500, 500],
            duration: 1200,
            maxZoom: 12,
          });
        }
      }, 50);

      console.log(`Vector Layer created for: ${type}`, this.vectorLayers[type]);
    } catch (err) {
      console.error('Failed to create vector layer:', err);
      alert('Could not convert file into a vector layer.');
    }
  }

  createLineForOrderedPoints(features: any[]): void {
    const points: any[] = [];
    const categories: string[] = [];

    // Extract coordinates and categories
    features.forEach((f: any) => {
      const geom = f.get('geometry');
      const coords = geom.getCoordinates
        ? geom.getCoordinates()
        : geom['flatCoordinates'];
      points.push(coords);

      const category = f.get('category')?.trim().toLowerCase();
      categories.push(category);
    });

    if (!points || points.length < 2) return;

    const lineFeatures: any[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];

      const lineGeom = new LineString([start, end]);

      // Determine color based on the category of the next point
      let strokeColor = '#000000'; // default black
      switch (categories[i + 1]) {
        case 'cyclonic storm':
          strokeColor = '#ff0000'; // red
          break;
        case 'deep depression':
          strokeColor = '#000000'; // black
          break;
        case 'depression':
          strokeColor = '#ff0000'; // orange/red
          break;
      }

      const feature = new Feature({
        geometry: lineGeom,
      });

      feature.setStyle(
        new Style({
          stroke: new Stroke({
            color: strokeColor,
            width: 3,
          }),
        })
      );

      lineFeatures.push(feature);
    }

    const lineLayer = new VectorLayer({
      source: new VectorSource({
        features: lineFeatures,
      }),
      properties: {
        title: 'Track Lines',
      },
    });

    this.addLayerIfNotExists(lineLayer);
  }

  addLayerIfNotExists(newLayer: any): void {
    const title = newLayer.get('title');
    if (!title) return;

    const mapLayers = this.map.getLayers().getArray();

    const existingLayer = mapLayers.find(
      (layer: any) => layer.get('title') === title
    );

    if (existingLayer) {
      console.log(`Layer "${title}" already exists. Not adding again.`);
      return; // do not add duplicate
    }

    this.map.addLayer(newLayer);
    console.log(`Layer "${title}" added successfully.`);
  }

  getGeometryType(geojsonData: any): string | null {
    try {
      if (geojsonData.type === 'FeatureCollection') {
        if (geojsonData.features.length > 0) {
          return geojsonData.features[0].geometry.type;
        }
      } else if (geojsonData.type === 'Feature') {
        return geojsonData.geometry.type;
      }
    } catch (e) {
      console.error('Invalid GeoJSON', e);
    }
    return null;
  }

  ClearLayer() {
    const targetTitles = [
      'Point Layer',
      'Line Layer',
      'Cone Layer',
      'Buffer Layer',
    ];
    const layers = this.map.getLayers().getArray();

    targetTitles.forEach((layerTitle: string) => {
      layers.forEach((layer) => {
        const title = layer.get('title');
        if (title === layerTitle) {
          this.map.removeLayer(layer);
        }
      });
    });

    this.uploadedFiles = {
      point: null,
      line: null,
      cone: null,
      buffer: null,
    };

    this.resetFileInputs();
    this.phenomenalDistricts = [];
    this.veryHighSeasDistricts = [];
    this.highToVeryHighRoughSeasDistricts = [];
    this.veryRoughSeasDistricts = [];
    this.showSeverityPanel = false;
  }

  resetFileInputs() {
    const inputs = document.querySelectorAll<HTMLInputElement>(
      '.cyclone-file-input'
    );
    inputs.forEach((input) => (input.value = ''));
  }

  toggleSeverityPanel() {
    this.showSeverityPanel = !this.showSeverityPanel;
  }

  exportToExcel() {
    const maxLength = Math.max(
      this.phenomenalDistricts.length,
      this.veryHighSeasDistricts.length,
      this.highToVeryHighRoughSeasDistricts.length,
      this.veryRoughSeasDistricts.length
    );

    const rows = [];

    for (let i = 0; i < maxLength; i++) {
      rows.push({
        Phenomenal: this.phenomenalDistricts[i] || '',
        'Very High Seas': this.veryHighSeasDistricts[i] || '',
        'High To Very High Rough Seas':
          this.highToVeryHighRoughSeasDistricts[i] || '',
        'Very Rough Seas': this.veryRoughSeasDistricts[i] || '',
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Severity Districts');

    XLSX.writeFile(wb, 'Severity_Districts.xlsx');
  }
}
