import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HazardsFeed } from './hazards-feed';

describe('HazardsFeed', () => {
  let component: HazardsFeed;
  let fixture: ComponentFixture<HazardsFeed>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HazardsFeed]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HazardsFeed);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
