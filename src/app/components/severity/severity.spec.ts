import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Severity } from './severity';

describe('Severity', () => {
  let component: Severity;
  let fixture: ComponentFixture<Severity>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Severity]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Severity);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
