import { TestBed } from '@angular/core/testing';
import { WindGridService } from './wind-grid';

describe('WindGridService', () => {
  let service: WindGridService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WindGridService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
