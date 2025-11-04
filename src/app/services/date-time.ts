import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DateTimeService {

  constructor() { }
  getCurrentDateTime() {
    const now = new Date();

    // Format date → 27 Aug 2025
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    };
    const formattedDate = now.toLocaleDateString('en-GB', options);

    // Format time → 02:00 (24h format, zero-padded)
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const formattedTime = `${hours}:${minutes}`;

    return { formattedDate, formattedTime };
  }
}
