import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl?: number; // milliseconds
}

@Injectable({ providedIn: 'root' })
export class CacheService {
  private dbPromise: Promise<IDBPDatabase>;
  constructor() {
    this.dbPromise = openDB('app-cache', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('district_json')) {
          db.createObjectStore('district_json');
        }
        if (!db.objectStoreNames.contains('circle_json')) {
          db.createObjectStore('circle_json');
        }
        if (!db.objectStoreNames.contains('bnd_json')) {
          db.createObjectStore('bnd_json');
        }
      },
    });
  }

  // For District JSON Cache Service
  async getWithTTL<T>(key: string): Promise<T | null> {
    return this.get<T>(key);
  }

  async setWithTTL<T>(key: string, value: T, ttl: number): Promise<void> {
    return this.set<T>(key, value, ttl);
  }
  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.dbPromise;

      //  Handle when key = "ALL Circle" case
      if (key === 'All Circle') {
        const allEntries = await db.getAll('district_json');

        const validData: any[] = [];

        for (const entry of allEntries as CacheEntry<any>[]) {
          if (!entry) continue;

          // TTL check
          if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
            continue; // skip expired
          }

          validData.push(entry.value);
        }

        // flatten (since each value is array of features)
        return validData.flat() as T;
      }

      //  Normal single key flow
      const entry = (await db.get('district_json', key)) as
        | CacheEntry<T>
        | undefined;

      if (!entry) return null;

      if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
        await this.delete('district_json', key);
        return null;
      }

      return entry.value;
    } catch (e) {
      console.error('Cache GET error:', e);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const db = await this.dbPromise;

      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl,
      };

      await db.put('district_json', entry, key);
    } catch (e) {
      console.error('Cache SET error:', e);
    }
  }

  // For Circle Cache Service
  async getCircle<T>(key: string): Promise<T | null> {
    try {
      const db = await this.dbPromise;

      //  Handle when key = "ALL Circle" case
      if (key === 'All Circle') {
        const allEntries = await db.getAll('circle_json');

        const validData: any[] = [];

        for (const entry of allEntries as CacheEntry<any>[]) {
          if (!entry) continue;

          // TTL check
          if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
            continue; // skip expired
          }

          validData.push(entry.value);
        }

        // flatten (since each value is array of features)
        return validData.flat() as T;
      }

      //  Normal single key flow
      const entry = (await db.get('circle_json', key)) as
        | CacheEntry<T>
        | undefined;

      if (!entry) return null;

      if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
        await this.delete('circle_json', key);
        return null;
      }

      return entry.value;
    } catch (e) {
      console.error('Cache GET error:', e);
      return null;
    }
  }

  async setCircle<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const db = await this.dbPromise;

      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl,
      };

      await db.put('circle_json', entry, key);
    } catch (e) {
      console.error('Cache SET error:', e);
    }
  }

  // For BND JSON Cache Service
  async getBnd<T>(key: string): Promise<T | null> {
    try {

      const db = await this.dbPromise;
      const entry = (await db.get('bnd_json', key)) as
        | CacheEntry<T>
        | undefined;
        if (!entry) return null;

        if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
          await this.delete('bnd_json', key);
          return null;
        }
  
        return entry.value;
      } catch (e) {
        console.error('Cache GET error:', e);
        return null;
      }
    }
      
  async setBnd<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const db = await this.dbPromise;
      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl,
      };
      await db.put('bnd_json', entry, key);
    } catch (e) {
      console.error('Cache SET error:', e);
    }
  }
      

  // Delete a specific cache entry
  async delete(store: string, key: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(store, key);
  }

  //Clear All Cache Entries
  async clear(): Promise<void> {
    const db = await this.dbPromise;
    await db.clear('district_json');
    await db.clear('circle_json');
    await db.clear('bnd_json');
  }
}
