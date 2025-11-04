import { TestBed } from '@angular/core/testing';

import { DateTime } from './date-time';

describe('DateTime', () => {
  let service: DateTime;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DateTime);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
