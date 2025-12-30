import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Cyclone } from './cyclone';

describe('Cyclone', () => {
  let component: Cyclone;
  let fixture: ComponentFixture<Cyclone>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cyclone]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Cyclone);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
