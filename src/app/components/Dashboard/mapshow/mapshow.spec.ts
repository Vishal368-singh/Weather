import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Mapshow } from './mapshow';

describe('Mapshow', () => {
  let component: Mapshow;
  let fixture: ComponentFixture<Mapshow>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Mapshow]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Mapshow);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
