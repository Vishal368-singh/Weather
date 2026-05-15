import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonthlyReport } from './monthly-report';

describe('MonthlyReport', () => {
  let component: MonthlyReport;
  let fixture: ComponentFixture<MonthlyReport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonthlyReport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MonthlyReport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
