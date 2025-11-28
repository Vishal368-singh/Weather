import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

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
  private circleChanged = new BehaviorSubject<string>('');
  private circleLocationChanged = new BehaviorSubject<string>('');
  private enableSearchLoader = new BehaviorSubject<boolean>(false);

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

  setCircleChange(circle: string): void {
    this.circleChanged.next(circle);
  }

  setCircleLocationChange(circleLocation: string): void {
    this.circleLocationChanged.next(circleLocation);
  }

  setSearchLoader(enabled: boolean): void {
    this.enableSearchLoader.next(enabled);
  }
}
