import { Component, OnInit, ChangeDetectorRef  } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-zone',
  // standalone: true,
  imports: [CommonModule],
  templateUrl: './zone.html',
  styleUrls: ['./zone.css'],
})
export class Zone implements OnInit {
  zones: any[] = [];

   constructor(private http: HttpClient, 
              private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.fetchData();
  }

  fetchData(): void {
    const apiUrl = 'http://localhost:8083/api/WeatherDataPlaceNameZoneWise'; // Update API URL as needed
    this.http.get<any>(apiUrl).subscribe({
      next: (response) => {
        if (response?.data?.recordset) {
          this.mapApiResponseToZones(response.data.recordset);
        } else {
          console.error('Invalid API response structure:', response);
        }
      },
      error: (error) => {
        console.error('Error fetching data from API:', error);
      },
    });
  }

mapApiResponseToZones(data: any[]): void {
  const zoneTitles: Record<string, string> = {
    "South Zone": "Very High Sensitive Zone",
    "East Zone": "High Sensitive Zone",
    "West Zone": "Moderate Sensitive Zone",
    "North Zone": "Low Sensitive Zone",
  };

  this.zones = Object.keys(zoneTitles).map(zoneKey => {
    const zoneData = data.filter(d => d.Zone === zoneKey); // Filter data for the current zone

    return {
      title: `${zoneTitles[zoneKey]} (${zoneKey})`, // Dynamic title
      color: this.getZoneColor(zoneKey), // Dynamic color
      headerColor: '#ffffff',
      items: [
        {
          categoryIcon: 'rainfall.svg',
          boxes: [
            {
              icons: ['tower_extr.svg', 'District.svg'],
              values: [
                zoneData.find(d => d.Data_Type === 'Rain' && d.Category === 'Very Heavy')?.Name_Count || 0,
                zoneData.find(d => d.Data_Type === 'Rain' && d.Category === 'Very Heavy')?.State_Count || 0,
              ],
              color: '#D62828',
            },
            {
              icons: ['tower_extr.svg', 'District.svg'],
              values: [
                zoneData.find(d => d.Data_Type === 'Rain' && d.Category === 'Heavy')?.Name_Count || 0,
                zoneData.find(d => d.Data_Type === 'Rain' && d.Category === 'Heavy')?.State_Count || 0,
              ],
              color: '#E47500',
            },
            {
              icons: ['tower_extr.svg', 'District.svg'],
              values: [
                zoneData.find(d => d.Data_Type === 'Rain' && d.Category === 'Moderate')?.Name_Count || 0,
                zoneData.find(d => d.Data_Type === 'Rain' && d.Category === 'Moderate')?.State_Count || 0,
              ],
              color: '#FFAE58',
            },
          ],
        },
        {
          categoryIcon: 'temp.svg',
          boxes: [
            {
              icons: ['tower_extr.svg', 'District.svg'],
              values: [
                zoneData.find(d => d.Data_Type === 'Temperature' && d.Category === 'Very Heavy')?.Name_Count || 0,
                zoneData.find(d => d.Data_Type === 'Temperature' && d.Category === 'Very Heavy')?.State_Count || 0,
              ],
              color: '#D62828',
            },
            {
              icons: ['tower_extr.svg', 'District.svg'],
              values: [
                zoneData.find(d => d.Data_Type === 'Temperature' && d.Category === 'Heavy')?.Name_Count || 0,
                zoneData.find(d => d.Data_Type === 'Temperature' && d.Category === 'Heavy')?.State_Count || 0,
              ],
              color: '#E47500',
            },
            {
              icons: ['tower_extr.svg', 'District.svg'],
              values: [
                zoneData.find(d => d.Data_Type === 'Temperature' && d.Category === 'Moderate')?.Name_Count || 0,
                zoneData.find(d => d.Data_Type === 'Temperature' && d.Category === 'Moderate')?.State_Count || 0,
              ],
              color: '#FFAE58',
            },
          ],
        },
        {
          categoryIcon: 'wind.svg',
          boxes: [
            {
              icons: ['tower_extr.svg', 'District.svg'],
              values: [
                zoneData.find(d => d.Data_Type === 'Wind' && d.Category === 'Very Heavy')?.Name_Count || 0,
                zoneData.find(d => d.Data_Type === 'Wind' && d.Category === 'Very Heavy')?.State_Count || 0,
              ],
              color: '#D62828',
            },
            {
              icons: ['tower_extr.svg', 'District.svg'],
              values: [
                zoneData.find(d => d.Data_Type === 'Wind' && d.Category === 'Heavy')?.Name_Count || 0,
                zoneData.find(d => d.Data_Type === 'Wind' && d.Category === 'Heavy')?.State_Count || 0,
              ],
              color: '#E47500',
            },
            {
              icons: ['tower_extr.svg', 'District.svg'],
              values: [
                zoneData.find(d => d.Data_Type === 'Wind' && d.Category === 'Moderate')?.Name_Count || 0,
                zoneData.find(d => d.Data_Type === 'Wind' && d.Category === 'Moderate')?.State_Count || 0,
              ],
              color: '#FFAE58',
            },
          ],
        },
      ],
    };
  });

  this.cdr.detectChanges(); // Ensure view updates after the data is mapped
}

getZoneColor(zone: string): string {
  switch (zone) {
    case 'South Zone':
      return '#b31312';
    case 'East Zone':
      return '#DA9358';
    case 'West Zone':
      return '#EDBF57';
    case 'North Zone':
      return '#4E8B7A';
    default:
      return '#cccccc'; // Default color
  }
}



}
