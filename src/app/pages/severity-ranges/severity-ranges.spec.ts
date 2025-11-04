import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeverityRanges } from './severity-ranges';

describe('SeverityRanges', () => {
  let component: SeverityRanges;
  let fixture: ComponentFixture<SeverityRanges>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeverityRanges]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SeverityRanges);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
