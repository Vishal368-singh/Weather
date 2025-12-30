import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

interface DistrictGroup {
  [circle: string]: string[];
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private locationSubject = new BehaviorSubject<string>('');
  private selectedLayerSubject = new BehaviorSubject<string>('');
  private searchLocationSubject = new BehaviorSubject<string>('');
  private selectedSource = new BehaviorSubject<string>('');
  private selectedDays = new BehaviorSubject<string>('today');
  private loggedInUserLogId = new BehaviorSubject<string>('');
  private circleForUserWithNoCircle = new BehaviorSubject<string>('');
  private panIndiaLocation = new BehaviorSubject<string>('');
  private isCircleLabelClicked = new BehaviorSubject<boolean>(false);
  private circleChanged = new BehaviorSubject<any[]>([]);
  private circleLocationChanged = new BehaviorSubject<string>('');
  private enableSearchLoader = new BehaviorSubject<boolean>(false);

  // ------------Sandip Integration Changes----------------

  private dashboardCircleLocation = new BehaviorSubject<string>('');
  private districtCircle = new BehaviorSubject<string>('');
  private groupedDirstrictesArray = new BehaviorSubject<DistrictGroup>({});
  private highlightDistrictSubject = new BehaviorSubject<string>('');
  private districtFeaturesSubject = new BehaviorSubject<any[]>([]);

  //.....................................................................

  location$ = this.locationSubject.asObservable(); // observable for other components to subscribe
  selectedLayer$ = this.selectedLayerSubject.asObservable();
  searchLocation$ = this.searchLocationSubject.asObservable();
  selectedSource$ = this.selectedSource.asObservable();
  selectedDay$ = this.selectedDays.asObservable();
  weatherLogId$ = this.loggedInUserLogId.asObservable();
  circleForUser$ = this.circleForUserWithNoCircle.asObservable();
  panIndia$ = this.panIndiaLocation.asObservable();
  circleLabelClicked$ = this.isCircleLabelClicked.asObservable();
  circleChangedIs$ = this.circleChanged.asObservable();
  circleLocationChangedIs$ = this.circleLocationChanged.asObservable();

  // New observables for district and dashboard circle by Sandeep
  districtFeatures$ = this.districtFeaturesSubject.asObservable();
  getGroupedDistrictsArray$ = this.groupedDirstrictesArray.asObservable();
  districtHighlight$ = this.highlightDistrictSubject.asObservable();
  dashboardCircleLocation$ = this.dashboardCircleLocation.asObservable();
  districtCircle$ = this.districtCircle.asObservable();

  setLocation(location: string): void {
    this.locationSubject.next(location);
  }

  setSearchLocation(location: string): void {
    this.searchLocationSubject.next(location);
  }

  setSelectedLayer(layer: string) {
    this.selectedLayerSubject.next(layer);
  }

  setSelectedSource(source: string): void {
    this.selectedSource.next(source);
  }

  clearSelectedLayer() {
    this.selectedLayerSubject.next('');
  }

  setSelectedDays(day: string): void {
    this.selectedDays.next(day);
  }

  setWeatherLogId(id: string): void {
    this.loggedInUserLogId.next(id);
  }

  setCircleForUser(circle: string): void {
    this.circleForUserWithNoCircle.next(circle);
  }

  setPanIndiaLocation(location: string): void {
    this.panIndiaLocation.next(location);
  }

  setCircleLabelClicked(clicked: boolean): void {
    this.isCircleLabelClicked.next(clicked);
  }

  setCircleChange(circleArray: any): void {
    this.circleChanged.next(circleArray);
  }

  setCircleLocationChange(circleLocation: string): void {
    this.circleLocationChanged.next(circleLocation);
  }

  setSearchLoader(enabled: boolean): void {
    this.enableSearchLoader.next(enabled);
  }

  // --------------Sandip Integration Changes----------------
  setGroupedDistrictsArray(districts: DistrictGroup): void {
    this.groupedDirstrictesArray.next(districts);
  }
  setDistrictHighlight(data: string): void {
    this.highlightDistrictSubject.next(data);
  }
  setDashboardCircleLocation(loc: string) {
    this.dashboardCircleLocation.next(loc);
  }
  setDistrictCircle(loc: string) {
    this.districtCircle.next(loc);
  }

  //this for card getting district fetaure//
  setAllDistrictFeatures(list: any[]) {
    this.districtFeaturesSubject.next(list);
  }

  //.....................................................................
}
