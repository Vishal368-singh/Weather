import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MapExportService {
  private mapImageSubject = new BehaviorSubject<string | null>(null);
  mapImage$ = this.mapImageSubject.asObservable();

  setMapImage(image: string | null): void {
    this.mapImageSubject.next(image);
  }
}
