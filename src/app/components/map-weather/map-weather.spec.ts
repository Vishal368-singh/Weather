import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapWeather } from './map-weather';

describe('MapWeather', () => {
  let component: MapWeather;
  let fixture: ComponentFixture<MapWeather>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapWeather]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MapWeather);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
