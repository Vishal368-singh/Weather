import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HourlyWeather } from './hourly-weather';

describe('HourlyWeather', () => {
  let component: HourlyWeather;
  let fixture: ComponentFixture<HourlyWeather>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HourlyWeather]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HourlyWeather);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
