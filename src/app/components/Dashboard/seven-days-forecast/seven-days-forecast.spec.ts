import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SevenDaysForecast } from './seven-days-forecast';

describe('SevenDaysForecast', () => {
  let component: SevenDaysForecast;
  let fixture: ComponentFixture<SevenDaysForecast>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SevenDaysForecast]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SevenDaysForecast);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
