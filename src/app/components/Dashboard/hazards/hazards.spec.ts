import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Hazards } from './hazards';

describe('Hazards', () => {
  let component: Hazards;
  let fixture: ComponentFixture<Hazards>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Hazards]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Hazards);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
