import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CycloneMailDialog } from './cyclone-mail-dialog';

describe('CycloneMailDialog', () => {
  let component: CycloneMailDialog;
  let fixture: ComponentFixture<CycloneMailDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CycloneMailDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CycloneMailDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
