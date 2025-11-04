import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CurrentLocationService {
  UP_West = [
    'Saharanpur',
    'Muzaffarnagar',
    'Shamli',
    'Moradabad',
    'Bijnor',
    'Rampur',
    'Amroha',
    'Sambhal',
    'Meerut',
    'Baghpat',
    'Ghaziabad',
    'Gautam Buddha Nagar',
    'Hapur',
    'Bulandshahr',
    'Aligarh',
    'Hathras',
    'Etah',
    'Kasganj',
    'Agra',
    'Mathura',
    'Firozabad',
    'Mainpuri',
    'Bareilly',
    'Badaun',
    'Pilibhit',
    'Shahjahanpur',
    'Farrukhabad',
    'Kannauj',
    'Etawah',
    'Auraiya',
    'Uttarakhand',
  ];

  UP_East = [
    'Gorakhpur',
    'Varanasi',
    'Sant Ravidas Nagar (Bhadohi)',
    'Pratapgarh',
    'Mirzapur',
    'Jaunpur',
    'Chandauli',
    'Ghazipur',
    'Kushinagar',
    'Deoria',
    'Azamgarh',
    'Mau',
    'Maharajganj',
    'Basti',
    'Sant Kabir Nagar',
    'Siddharth Nagar',
    'Ballia',
    'Sonbhadra',
    'Prayagraj (Allahabad)',
    'Kaushambi',
    'Bahraich',
    'Shrawasti',
    'Balrampur',
    'Gonda',
    'Ambedkar Nagar',
    'Sultanpur',
    'Amethi',
  ];

  North_East = [
    'Sikkim',
    'Tripura',
    'Nagaland',
    'Mizoram',
    'Meghalaya',
    'Manipur',
    'Arunachal Pradesh',
  ];
  async getCurrentLocation(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      debugger;
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            );
            const data = await response.json();
            debugger;
            // Force check for India
            if (data.address.country_code === 'in') {
              let placeName =
                data.address.state || data.address.city || 'Unknown location';
              if (this.UP_East.includes(data.address.city)) {
                resolve('UP East');
              } else if (this.UP_West.includes(data.address.city)) {
                resolve('UP West');
              } else if (this.North_East.includes(data.address.city)) {
                resolve('North East');
              } else {
                resolve(placeName);
              }
            } else {
              reject(new Error('Location is outside India'));
            }
          } catch (err) {
            reject(err);
          } finally {
            navigator.geolocation.clearWatch(watchId);
          }
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  async getSafeLocation(): Promise<string> {
    try {
      const data: any = await this.getCurrentLocation(); // try browser GPS
      return data;
    } catch {
      return ''; // fallback to Delhi
    }
  }
}
