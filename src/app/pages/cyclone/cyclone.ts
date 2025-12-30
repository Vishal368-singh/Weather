import {
  Component,
  OnInit,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  AfterViewInit,
  ElementRef,
  ViewChild,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../data-service/data-service';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import shp from 'shpjs';
import * as XLSX from 'xlsx';
import GeoJSON from 'ol/format/GeoJSON';
import { fromLonLat } from 'ol/proj';
import html2canvas from 'html2canvas';
import { Zoom } from 'ol/control';
import Overlay from 'ol/Overlay';
import { LineString, Point } from 'ol/geom';
import { defaults as olDefaultControls } from 'ol/control/defaults';
import VectorSource from 'ol/source/Vector';
import { Style, Fill, Stroke, Text, Icon } from 'ol/style';
import * as turf from '@turf/turf';
import { Feature } from 'ol';
import CircleStyle from 'ol/style/Circle';
import { Extent } from 'ol/extent';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
declare const ol: any;
declare var bootstrap: any; // needed for modal JS

@Component({
  selector: 'app-cyclone',
  imports: [CommonModule, FormsModule],
  templateUrl: './cyclone.html',
  styleUrl: './cyclone.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cyclone implements OnInit, AfterViewInit {
  @ViewChild('weatherTableBody', { static: false })
  weatherTableBody!: ElementRef;
  map!: Map;
  popupElement!: HTMLElement;
  popupContent!: HTMLElement;
  popupCloser!: HTMLElement;
  popupOverlay!: any;
  userRole: string = '';
  indiaDistrictsDataGeoJsonData: any;
  indiaDistrictsVectorSource = new VectorSource();
  indiaExtent: Extent = [
    fromLonLat([68.176645, 6.747139]), // Southwest corner (approx. Gujarat/Kerala)
    fromLonLat([97.402561, 35.494009]), // Northeast corner (Arunachal Pradesh)
  ].flat() as Extent;

  indianDistrictLayer = new VectorLayer({
    source: new VectorSource(),
    properties: {
      title: 'Districts Layer',
    },
  });

  kpiColor = {
    extreme: '',
    high: '',
    moderate: '',
    low: '',
  };
  groupedPointData: any[] = [];
  uploadedFiles: any = {
    point: null,
    line: null,
    cone: null,
    buffer: null,
  };
  uploadedInputFiles: any = {
    point: null,
    line: null,
    cone: null,
    buffer: null,
  };

  initialCenter = fromLonLat([82.8320187, 25.4463565]);

  phenomenalDistricts: any[] = [];
  veryHighSeasDistricts: any[] = [];
  highToVeryHighRoughSeasDistricts: any[] = [];
  veryRoughSeasDistricts: any[] = [];
  vectorLayers: any = {};

  cycloneDataValidPeriod: string = '';
  cycloneLastUploadedDateTime: string = '';

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

  showSeverityPanel = false;
  circleNameMap: any = {
    GUJ: 'Gujarat',
    RAJ: 'Rajasthan',
    KER: 'Kerala',
    'Upper North': 'Upper North',
    OD: 'Odisha',
    AP: 'Andhra Pradesh',
    KK: 'Karnataka',
    'M&G': 'Maharashtra',
    TN: 'Tamil Nadu',
  };

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

  selectedHour: number = new Date().getHours();
  cycloneHazardData: any;
  pdfDataGrouped: any;
  isPdfTable: boolean = false;

  get logId(): string | null {
    return localStorage.getItem('logId');
  }

  circleVectorSource = new VectorSource();
  circleVectorLayer = new VectorLayer({
    source: this.circleVectorSource,
    style: (feature) => this.styleFunctionCircleLayer(feature),
    properties: {
      title: 'Circles',
      legendFixed: true,
    },
  });

  selectExportAll: boolean = false;
  sendingMail: boolean = false;

  isOpen = false;
  allUploadedDateTime: any = [];
  selectedUploadTime: string = '';
  isIndiaDistrictsVisible: boolean = false;

  toggleCard() {
    this.isOpen = !this.isOpen;
  }

  closeCard(event: Event) {
    event.stopPropagation();
    this.isOpen = false;
  }

  circleOptions: {
    id: number;
    value: string;
    name: string;
    checked: boolean;
  }[] = [];

  constructor(
    private dataService: DataService,
    private cdr: ChangeDetectorRef,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    let storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      this.userRole = user.userrole;
    }
    this.fetchKPIRanges();
    this.loadIndusCircleGeoJSON();
    this.initializeMap();
    this.loadIndiaDistrictsData();
    this.loadCycloneData();
    this.fetchAllIndusCircle();
  }
  ngAfterViewInit() {}

  updateWeatherLogTable(payload: Object) {
    this.dataService.sendWeatherUserLog(payload).subscribe((res) => {
      if (res?.status === 'success') {
        // console.log('Weather user activity logged.');
      }
    });
  }

  onUploadTimeChange(event: any) {
    const selectedValue = event.target.value;
    console.log('Selected Upload Time:', selectedValue);
  }

  loadIndusCircleGeoJSON = async () => {
    const payload = { circle: 'All Circle' };
    this.dataService
      .postRequest('get_indus_circle_boundary', payload)
      .subscribe((res) => {
        const data = res.data;
        const features = new GeoJSON().readFeatures(data);

        this.circleVectorSource.clear();
        this.circleVectorSource.addFeatures(features);

        const extent = this.circleVectorSource.getExtent();
        this.map
          .getView()
          .fit(extent, { duration: 500, padding: [15, 85, 30, 20] });
      });
  };
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

      // Auto hide rainfall/wind
      const layerName = layer.get('title');
      if (autoUncheckedLayers.includes(layerName)) {
        setTimeout(() => layer.setVisible(false));
      }

      // Only add to legend once
      if (!document.getElementById(layerId)) {
        this.renderLegendItem(layer, index, legendContainer, map);
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
        this.renderLegendItem(newLayer, index, legendContainer, map);
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
    legendContainer: HTMLElement,
    map: Map
  ): void {
    const layerName = layer.get('title') || `Layer ${index + 1}`;
    const layerId = layer.get('layerId') || `layer-${index}`;

    if (document.getElementById(layerId)) return;

    const autoUncheckedLayers = ['Rainfall', 'Wind'];

    const listItem = document.createElement('li');
    listItem.id = layerId;
    listItem.classList.add('legend-item');

    // ➤ Swap-based drag and drop
    listItem.draggable = true;

    listItem.addEventListener('dragstart', (e: DragEvent) => {
      e.dataTransfer?.setData('layerId', layerId);
    });

    listItem.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      listItem.classList.add('drag-over');
    });

    listItem.addEventListener('dragleave', () => {
      listItem.classList.remove('drag-over');
    });

    listItem.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      listItem.classList.remove('drag-over');

      const draggedId = e.dataTransfer?.getData('layerId');
      if (!draggedId || draggedId === layerId) return;

      const draggedEl = document.getElementById(draggedId);
      const targetEl = listItem;

      if (draggedEl && targetEl) {
        // Swap the positions in the DOM
        const draggedNext = draggedEl.nextSibling;
        const targetNext = targetEl.nextSibling;

        targetEl.parentNode?.insertBefore(draggedEl, targetNext);
        targetEl.parentNode?.insertBefore(targetEl, draggedNext);

        // Swap the layers in the map
        this.swapMapLayers(map, draggedId, layerId);
      }
    });

    // ➤ Checkbox for visibility
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
      const payload = {
        type: 'update',
        id: this.logId,
        data: {
          cyclone_map_layer_checked_unchecked: layerName,
        },
      };
      this.updateWeatherLogTable(payload);
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

  swapMapLayers(map: Map, id1: string, id2: string): void {
    const layers = map.getLayers();
    const arr = layers.getArray();

    const index1 = arr.findIndex((l) => l.get('layerId') === id1);
    const index2 = arr.findIndex((l) => l.get('layerId') === id2);

    if (index1 === -1 || index2 === -1) return;

    if (index1 === index2) return;

    const layer1 = arr[index1];
    const layer2 = arr[index2];

    // Swap using insertAt safely
    if (index1 < index2) {
      layers.remove(layer2);
      layers.remove(layer1);
      layers.insertAt(index1, layer2);
      layers.insertAt(index2, layer1);
    } else {
      layers.remove(layer1);
      layers.remove(layer2);
      layers.insertAt(index2, layer1);
      layers.insertAt(index1, layer2);
    }
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

  onFileSelected(event: Event, type: string): void {
    const input = event.target as HTMLInputElement;
    if (!input || !input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (!['json', 'geojson', 'shp'].includes(ext)) {
      console.log('Only JSON, GeoJSON, or SHP files are allowed.');
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
        this.uploadedInputFiles[type] = jsonData;
      } catch (err) {
        console.error('Invalid JSON/GeoJSON file');
        console.log('Invalid JSON or GeoJSON file.');
      }
    };

    reader.readAsText(file);
  }

  //  SHP handling using shpjs
  async handleShapefile(file: File, type: string): Promise<void> {
    try {
      const arrayBuffer = await file.arrayBuffer();

      const geojson = await shp(arrayBuffer); // shpjs auto-detects SHP/ZIP
      this.uploadedInputFiles[type] = geojson;
    } catch (error) {
      console.error('Error reading SHP:', error);
      console.log('Failed to read shapefile. Ensure it is a valid SHP or ZIP.');
    }
  }

  loadIndiaDistrictsData() {
    this.dataService
      .postRequest('get_india_level_districts')
      .pipe(
        catchError((error) => {
          console.error('API Error: ', error);
          return throwError(() => error);
        })
      )
      .subscribe((response) => {
        if (response.status === 'success') {
          this.indiaDistrictsDataGeoJsonData = response.data;
          if (response.data.features.length > 0) {
            this.isIndiaDistrictsVisible = true;
          }
          if (this.indiaDistrictsDataGeoJsonData) {
            this.addDistrictSourceToLayer();
            this.generateRegionWiseWeatherIDW();
          }
          this.cdr.detectChanges();
        }
      });
  }
  convertToGeoJSON = (districts: any[]) => {
    return {
      type: 'FeatureCollection',
      features: districts.map((dist) => ({
        type: 'Feature',
        geometry: dist.geom_json,
        properties: {
          id_val: dist.id_val,
          district: dist.DISTRICT_1,
          state: dist.state,

          Date: dist.Date,
          UTC: dist.UTC,

          warningDay1: dist.Day_1,
          warningDay2: dist.Day_2,
          warningDay3: dist.Day_3,
          warningDay4: dist.Day_4,
          warningDay5: dist.Day_5,

          day1_color: dist.day1_color,
          day2_color: dist.day2_color,
          day3_color: dist.day3_color,
          day4_color: dist.day4_color,
          day5_color: dist.day5_color,

          remarks: dist.remarks,
        },
      })),
    };
  };

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
  hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

  loadCycloneData() {
    this.dataService.postRequest('get_cyclone_geojson').subscribe({
      next: (response: any) => {
        if (
          response.status === 'success' &&
          response.geojson &&
          Object.keys(response.geojson).length > 0
        ) {
          const cycloneGeojson = response.geojson;

          // ✔ store cone, buffer, point layers
          for (const type of Object.keys(cycloneGeojson)) {
            const layerData = cycloneGeojson[type];
            if (layerData) {
              this.uploadedFiles[type] = layerData; // <-- saving to map layers
            }
          }

          // ✔ Save all uploaded datetime list
          this.allUploadedDateTime = response?.all_upload_times || [];

          // ✔ Set currently selected upload datetime
          this.setCurrentDateTime(response?.selected_upload_time);

          // ✔ Now load cyclone graphics on map
          this.addPreviousCycloneDataToMap();
        } else {
          console.warn('Cyclone API success but no data received!');
        }
      },
      error: (err) => console.error('Error loading cyclone data:', err),
    });
  }
  addPreviousCycloneDataToMap() {
    for (const type of Object.keys(this.uploadedFiles)) {
      const data = this.uploadedFiles[type];
      this.createVectorLayer(type, data);
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
  setCurrentDateTime(dateTime?: string) {
    let now: Date;
    let upcomingDate = dateTime?.split(' ')[0];

    if (upcomingDate) {
      // Parse the passed datetime string
      const [day, month, year] = upcomingDate?.split('-').map(Number);
      now = new Date(year, month - 1, day);
    } else {
      now = new Date();
    }

    // Set last uploaded datetime

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    this.cycloneLastUploadedDateTime = `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;

    // Calculate start and end of valid period
    const start = new Date(now);
    start.setHours(0, 0, 0, 0); // today 00:00

    const end = new Date(start);
    end.setDate(end.getDate() + 1); // tomorrow 00:00

    // Format as "DD MMM YYYY HH:mm - DD MMM YYYY HH:mm"
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      // hour: '2-digit',
      // minute: '2-digit',
      hour12: false,
    };

    const startStr = start.toLocaleString('en-GB', options).replace(',', '');
    const endStr = end.toLocaleString('en-GB', options).replace(',', '');

    this.cycloneDataValidPeriod = `${startStr} - ${endStr}`;
    this.cdr.detectChanges();
  }
  fetchKPIRanges = () => {
    try {
      this.dataService
        .postRequest('/fetch-kpi-range')
        .pipe(
          catchError((error: any) => {
            const errorMessage = error?.error?.message || 'Internal Server';
            return throwError(() => `${error}, ${errorMessage}`);
          })
        )
        .subscribe((response) => {
          if (response.status === 'success') {
            const severityConfig = response.data;
            const firstCircleKey = Object.keys(severityConfig)[0];
            const firstCircle = severityConfig[firstCircleKey][0];

            this.kpiColor = {
              extreme: firstCircle.severity_extreme_color,
              high: firstCircle.severity_high_color,
              moderate: firstCircle.severity_moderate_color,
              low: firstCircle.severity_low_color,
            };

            // 🔥 MAP COLORS TO DISTRICT LIST
            const colorMapping: any = {
              'Warning (Take Action)': this.kpiColor.extreme,
              'Alert (Be Prepared)': this.kpiColor.high,
              'Watch (Be Updated)': this.kpiColor.moderate,
              'No Warning (No Action)': this.kpiColor.low,
            };

            this.districtColorsDayWise = this.districtColorsDayWise.map(
              (item: any) => ({
                ...item,
                color: colorMapping[item.name] || item.color,
              })
            );
          }
          this.cdr.detectChanges();
        });
    } catch (error) {
      console.log(error);
    }
  };

  generateCycloneImpactPDF(): void {
    const mapElement = document.getElementById('mapWrapper');
    if (!mapElement) return;

    html2canvas(mapElement, {
      useCORS: true,
      allowTaint: true,
      scale: 2, // Increase resolution (High-Quality)
      backgroundColor: null, // Preserve transparency if needed
    }).then((canvas) => {
      // Calculate crop area
      const cropFactor = 0.75;
      const cropWidth = canvas.width * cropFactor;
      const cropHeight = canvas.height * cropFactor;

      const sx = (canvas.width - cropWidth) / 2;
      const sy = (canvas.height - cropHeight) / 2;

      // Create crop canvas
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropWidth;
      cropCanvas.height = cropHeight;
      const ctx = cropCanvas.getContext('2d')!;

      ctx.drawImage(
        canvas,
        sx,
        sy,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
      );

      // Better Quality image export
      const highQualityImgURL = cropCanvas.toDataURL('image/png', 1.0);

      // Convert DataURL → Blob
      const blob = this.dataURLtoBlob(highQualityImgURL);

      // Form data upload
      const formData = new FormData();
      formData.append('image', blob, `Cyclone_Map.png`);

      this.sendCycloneReport(formData);
    });
  }

  // Convert base64 dataURL to Blob
  private dataURLtoBlob(dataURL: string): Blob {
    const byteString = atob(dataURL.split(',')[1]);
    const mimeType = dataURL.split(',')[0].split(':')[1].split(';')[0];
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);

    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }

    return new Blob([arrayBuffer], { type: mimeType });
  }
  hexToRgb(hex: string): [number, number, number] {
    const cleaned = hex.replace('#', '');
    const bigint = parseInt(cleaned, 16);

    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255] as [
      number,
      number,
      number
    ];
  }
  sendCycloneReport(formData: any) {
    this.dataService
      .postFormData('send_cyclone_report', formData)
      .pipe(
        catchError((error) => {
          const message = error?.error?.message;
          console.log(message);
          return throwError(() => error);
        })
      )
      .subscribe((response) => {
        if (response.status === 'success') {
          alert(response.message);
        }
      });
  }

  async fetchAllIndusCircle() {
    const payload = {
      circle: 'All Circle',
    };
    const res: any = await this.dataService
      .postRequest('get_circle_list', payload)
      .toPromise();

    if (res && res.status && Array.isArray(res.data)) {
      let id = 1;

      const circles = res.data.filter((c: any) => c.label !== 'All Circle');

      circles.forEach((c: any) => {
        this.circleOptions.push({
          id: id++,
          value: c.label,
          name: c.full_name,
          checked: false,
        });
      });
    } else {
      console.error('Failed to load circle list: Invalid API response format');
      this.circleOptions = [];
    }
  }

  toggleSelectCircle() {
    this.circleOptions.forEach((circle) => {
      circle.checked = this.selectExportAll;
    });
  }

  updateSelectedCircle() {
    this.selectExportAll = this.circleOptions.every((c) => c.checked);
  }

  getSelectedImpactedCircles(): string {
    const selected = this.circleOptions
      .filter((c) => c.checked)
      .map((c) => c.name);

    return selected.length
      ? selected.length === this.circleOptions.length
        ? 'All'
        : selected.join(', ')
      : '';
  }

  get selectedCircles() {
    return this.circleOptions.filter((c) => c.checked);
  }

  cancelCircleUpload() {
    this.circleOptions.forEach((c) => (c.checked = false));
    this.selectExportAll = false;
    // Reset uploaded input files
    this.uploadedInputFiles = {
      point: null,
      line: null,
      cone: null,
      buffer: null,
    };
    const modalEl = document.getElementById('impactedCircleModal');
    const modal = bootstrap.Modal.getInstance(modalEl!);
    modal.hide();
  }

  saveImpactedCircleToDB() {
    const selected = this.selectedCircles.map(
      (circle: {
        id: number;
        value: string;
        name: string;
        checked: boolean;
      }) => {
        let imp_cir = { full_name: circle.name, name: circle.value };
        return imp_cir;
      }
    );

    const payload = {
      impacted_circles: selected,
    };
    this.dataService
      .postRequest('save_impacted_circle_to_db', payload)
      .pipe(
        catchError((error) => {
          const message = error?.error?.message;
          return throwError(() => `Error is ${error} and ${message}`);
        })
      )
      .subscribe((response) => {
        if (response.status === 'success') {
          const modalEl = document.getElementById('impactedCircleModal');
          const modal = bootstrap.Modal.getInstance(modalEl!);
          modal.hide();
          this.snackBar.open(response.message, 'X', {
            duration: 2000, // auto close after 3s
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['custom-success-snackbar'],
          });
          this.AddLayerToMap();
        }
      });
    // this.AddLayerToMap();
    console.log('Selected Circles:', selected);
  }

  submitUploadedFile() {
    const hasAnyData = Object.values(this.uploadedInputFiles).some(
      (value) => value !== null
    );

    if (!hasAnyData) {
      this.snackBar.open('Upload cyclone related files.', 'X', {
        duration: 2000, // auto close after 3s
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['custom-info-snackbar'],
      });
      return;
    }

    const modalEl = document.getElementById('impactedCircleModal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  AddLayerToMap() {
    this.setCurrentDateTime();
    const formData = new FormData();

    formData.append('upload_time', this.cycloneLastUploadedDateTime);

    for (const type in this.uploadedInputFiles) {
      if (!this.uploadedInputFiles[type] && this.vectorLayers[type]) {
        this.map.removeLayer(this.vectorLayers[type]);
        delete this.vectorLayers[type];

        const legendId = `legend-${type.replace(/\s+/g, '-')}`;
        const legendItem = document.getElementById(legendId);
        if (legendItem) {
          legendItem.remove();
        }

        console.log(`Removed old ${type} layer from map and legend`);
      }
    }
    this.uploadedFiles = structuredClone(this.uploadedInputFiles);
    for (const type of Object.keys(this.uploadedFiles)) {
      const data = this.uploadedFiles[type];

      if (data) {
        this.createVectorLayer(type, data);
        const jsonBlob = new Blob([JSON.stringify(data)], {
          type: 'application/json',
        });
        formData.append(type, jsonBlob, `${type}.json`);
      }
    }

    // Send to backend
    // this.dataService.postFormData('insert_cyclone_file', formData).subscribe({
    //   next: (response: any) => {
    //     if (response.status === 'success') {
    //       console.log('Data saved to backend');
    //     }
    //   },
    //   error: (err) => console.error('Upload error:', err),
    // });

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

    this.uploadedInputFiles = {
      point: null,
      line: null,
      cone: null,
      buffer: null,
    };

    const inputs = document.querySelectorAll<HTMLInputElement>(
      '.cyclone-file-input'
    );
    inputs.forEach((input) => {
      input.value = '';
    });
    this.renderLegend(this.map);
  }
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
          const ws = feature.get('max_wind_speed');
          const windSpeed = ws.split(' ')[0]; // Update field name if different
          const dateTime = feature.get('forecast_time');
          const date = dateTime.split(' ')[0];

          const categoryArray = [
            { category: 'Cyclonic Storm', short: 'CS' },
            { category: 'Deep Depression', short: 'DD' },
            { category: 'Depression', short: 'D' },
          ];

          // Find the matched object
          const categoryMatch = categoryArray.find(
            (item) => item.category === category
          );

          // Get short name or fallback
          const categoryShort = categoryMatch ? categoryMatch.short : '';

          const labelText = `${windSpeed || ''} Kn,  ${date || ''},  ${
            categoryShort || ''
          }`;

          const textStyle = new Text({
            text: labelText,
            font: '14px Calibri, sans-serif',
            fill: new Fill({ color: '#1a6ce6ff' }),
            stroke: new Stroke({ color: '#1a6ce6ff', width: 0 }),
            offsetX: 15, // ➜ Move label to the right
            offsetY: 0, // Keep vertically centered
            textAlign: 'left', // Ensures label aligns from left edge
          });

          const isForecast = pointType === 'Forecast';

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
              text: textStyle,
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
              text: textStyle,
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
              text: textStyle,
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
            text: textStyle,
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
            maxZoom: 6,
          });
        }
      }, 50);

      console.log(`Vector Layer created for: ${type}`, this.vectorLayers[type]);
    } catch (err) {
      console.error('Failed to create vector layer:', err);
      console.log('Could not convert file into a vector layer.');
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
        title: 'Lines Layer',
      },
    });

    this.addLayerIfNotExists(lineLayer);
  }
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
  addLayerIfNotExists(newLayer: any): void {
    const title = newLayer.get('title');
    if (!title) return;

    const mapLayers = this.map.getLayers().getArray();
    const existingLayer = mapLayers.find(
      (layer: any) => layer.get('title') === title
    );

    if (existingLayer) {
      this.map.removeLayer(existingLayer); // Remove old
      console.log(`Layer "${title}" updated.`);
    }

    this.map.addLayer(newLayer); // Always add updated layer
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
    this.cycloneDataValidPeriod = '';
    this.cycloneLastUploadedDateTime = '';
  }

  resetFileInputs() {
    const inputs = document.querySelectorAll<HTMLInputElement>(
      '.cyclone-file-input'
    );
    inputs.forEach((input) => (input.value = ''));
  }

  tableData: any[] = [];

  mapPdfDataToTable() {
    this.tableData = [];
    Object.keys(this.pdfDataGrouped).forEach((circle) => {
      const dates = this.pdfDataGrouped[circle];

      Object.keys(dates).forEach((date) => {
        const severityObj = dates[date];

        Object.keys(severityObj).forEach((severity) => {
          const data = severityObj[severity];
          const fullCircleName = this.circleNameMap[circle];
          this.tableData.push({
            circle: fullCircleName,
            date,
            severity,
            description: data.description,
            districts: data.districts.join(', '),
          });
        });
      });
    });
  }

  toggleSeverityPanel = async () => {
    this.showSeverityPanel = !this.showSeverityPanel;
    if (this.showSeverityPanel) this.mapPdfDataToTable();
  };

  exportToExcel() {
    const payload = {
      type: 'update',
      id: this.logId,
      data: {
        cyclone_severity_table_export: 'true',
      },
    };
    this.updateWeatherLogTable(payload);

    if (!this.tableData || this.tableData.length === 0) {
      return;
    }

    const exportRows = this.tableData.map((item) => ({
      'Indus Circle': item.circle,
      Date: item.date,
      Severity: item.severity,
      Description: item.description,
      Districts: item.districts,
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'District Severity');

    XLSX.writeFile(wb, 'District_Severity.xlsx');
  }
}
