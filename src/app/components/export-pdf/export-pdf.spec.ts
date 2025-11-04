import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExportPdf } from './export-pdf';

describe('ExportPdf', () => {
  let component: ExportPdf;
  let fixture: ComponentFixture<ExportPdf>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExportPdf]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExportPdf);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
