import { ComponentFixture, TestBed } from '@angular/core/testing';

import { THVS } from './thvs';

describe('THVS', () => {
  let component: THVS;
  let fixture: ComponentFixture<THVS>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [THVS]
    })
    .compileComponents();

    fixture = TestBed.createComponent(THVS);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
