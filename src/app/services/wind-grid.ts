import { Injectable } from '@angular/core';

export interface WindPoint {
  latitude: number;
  longitude: number;
  wind_kph: number;
  wind_degree: number;
}

export interface WindGrid {
  la1: number;
  lo1: number;
  la2: number;
  lo2: number;
  dx: number;
  dy: number;
  nx: number;
  ny: number;
  uData: number[];
  vData: number[];
}

@Injectable({ providedIn: 'root' })
export class WindGridService {
  setData(apiData: WindPoint[]): WindGrid {
    return this.buildGrid(apiData);
  }

  interpolateWind(lon: number, lat: number, grid: WindGrid) {
    const { la1, lo1, dx, dy, nx, ny, uData, vData } = grid;
    const maxLon = lo1 + dx * (nx - 1);
    const minLat = la1 - dy * (ny - 1);

    if (lon < lo1 || lon > maxLon || lat > la1 || lat < minLat) {
      return null;
    }

    const fi = (lon - lo1) / dx;
    const fj = (la1 - lat) / dy;
    const i0 = Math.floor(fi);
    const i1 = Math.min(i0 + 1, nx - 1);
    const j0 = Math.floor(fj);
    const j1 = Math.min(j0 + 1, ny - 1);
    const tx = fi - i0;
    const ty = fj - j0;

    const idx = (j: number, i: number) => j * nx + i;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    return {
      u: lerp(
        lerp(uData[idx(j0, i0)], uData[idx(j0, i1)], tx),
        lerp(uData[idx(j1, i0)], uData[idx(j1, i1)], tx),
        ty,
      ),
      v: lerp(
        lerp(vData[idx(j0, i0)], vData[idx(j0, i1)], tx),
        lerp(vData[idx(j1, i0)], vData[idx(j1, i1)], tx),
        ty,
      ),
    };
  }

  private buildGrid(data: WindPoint[]): WindGrid {
    const latMin = 6;
    const latMax = 38;
    const lonMin = 68;
    const lonMax = 98;

    const dx = 0.25;
    const dy = 0.25;

    const nx = Math.floor((lonMax - lonMin) / dx) + 1;
    const ny = Math.floor((latMax - latMin) / dy) + 1;

    // --- FIX: Build a fast snap-resolution lookup map ---
    const lookup = new Map<string, { u: number; v: number }>();
    for (const pt of data) {
      // Snap to nearest grid node
      const snappedLat = Math.round(pt.latitude / dy) * dy;
      const snappedLon = Math.round(pt.longitude / dx) * dx;
      const key = `${snappedLat.toFixed(2)}_${snappedLon.toFixed(2)}`;
      const speed = pt.wind_kph * 0.27778;
      const rad = (pt.wind_degree * Math.PI) / 180;
      lookup.set(key, {
        u: -speed * Math.sin(rad),
        v: -speed * Math.cos(rad),
      });
    }

    const uData: number[] = [];
    const vData: number[] = [];

    for (let j = 0; j < ny; j++) {
      const lat = latMax - j * dy;
      for (let i = 0; i < nx; i++) {
        const lon = lonMin + i * dx;
        const key = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
        const pt = lookup.get(key);

        if (pt) {
          uData.push(pt.u);
          vData.push(pt.v);
        } else {
          // Fallback: nearest neighbour — but only called for sparse gaps
          const nearest = this.findNearest(lat, lon, data);
          if (nearest) {
            const speed = nearest.wind_kph * 0.27778;
            const rad = (nearest.wind_degree * Math.PI) / 180;
            uData.push(-speed * Math.sin(rad));
            vData.push(-speed * Math.cos(rad));
          } else {
            uData.push(0);
            vData.push(0);
          }
        }
      }
    }

    return {
      la1: latMax,
      lo1: lonMin,
      la2: latMin,
      lo2: lonMax,
      dx,
      dy,
      nx,
      ny,
      uData,
      vData,
    };
  }

  findNearest(lat: number, lon: number, data: WindPoint[]) {
    let minDist = Infinity;
    let nearest: WindPoint | null = null;
    for (const pt of data) {
      const dLat = lat - pt.latitude;
      const dLon = lon - pt.longitude;
      const dist = dLat * dLat + dLon * dLon;
      if (dist < minDist) {
        minDist = dist;
        nearest = pt;
      }
    }
    return nearest;
  }
}
