import { Injectable } from '@angular/core';
import * as JSZip from 'jszip';
import { Papa, ParseConfig, ParseResult } from 'ngx-papaparse';


export type Recording = {
  sourceType: 'phyphox' | 'custom' | 'unknown';
  raw: any;
  normalizedRecordings: RecordingRaw[];
  recordingsPerTimeUnit: RecordingPerTimeUnit[];
};

export type PhyphoxExport = {
  accelerationCsv: string;
  locationCsv: string;
  metaDeviceCsv?: string;
  metaTimeCsv?: string;
};

export type PhyphoxLocationData = {
  time: number;
  lat: number;
  lon: number;
  velocity: number;
};

export type PhyphoxAccelerationData = {
  time: number;
  accAbsolute: number;
};

export type CustomExport = {
  date: string;
  time: string;
};

export type RecordingRaw = {
  locTime: number;
  accTime: number;
  lat: number;
  lon: number;
  acceleration: number;
  velocity: number;
  isSynthetic?: boolean
};

export type RecordingPerTimeUnit = {
  time: number;
  lat: number;
  lon: number;
  maxAcceleration: number;
  avgAcceleration: number;
  velocity: number;
  raw: RecordingRaw[];
};

export type RecordingWithRating = {
  recordingData: RecordingPerTimeUnit;
  velocityRating: string;
};

export type Track = {
  recording: Recording;
  evaluatedData: RecordingWithRating[];
  acceptedData: RecordingPerTimeUnit[];
};


@Injectable({ providedIn: 'root' })
export class TrackLoaderService {


  constructor(private papa: Papa) {
  }


  private static mapPhyphoxLocationCsv(locationCsv: any): PhyphoxLocationData {
    return {
      time: +locationCsv.time,
      lat: +locationCsv.lat,
      lon: +locationCsv.lon,
      velocity: +locationCsv.velocity
    };
  }


  private static mapPhyphoxAccelerationCsv(accelerationCsv: any): PhyphoxAccelerationData {
    return {
      time: +accelerationCsv.time,
      accAbsolute: +accelerationCsv.accAbsolute
    };
  }


  private static mergePhyphoxData(locationData: PhyphoxLocationData[], accelerationData: PhyphoxAccelerationData[]): RecordingRaw[] {

    if (locationData.length < 2) {
      return [];
    }

    locationData.sort((a, b) => a.time - b.time);
    accelerationData.sort((a, b) => a.time - b.time);

    let locationDataIndex = 0;
    let currentLocationDatum: PhyphoxLocationData | undefined = locationData[locationDataIndex];
    let nextLocationDatum: PhyphoxLocationData | undefined = locationData[locationDataIndex + 1];

    const result: RecordingRaw[] = [];

    const margin = 1.0;

    for (const accelerationDatum of accelerationData) {

      if (!currentLocationDatum) {
        break;
      }

      // Skip acceleration datum, as there is no useful location datum for the current timestamp
      if (currentLocationDatum.time - accelerationDatum.time > margin) {
        continue;
      }

      // Move cursor to next location datum
      while (
        currentLocationDatum
        && nextLocationDatum
        && Math.abs(accelerationDatum.time - nextLocationDatum.time) <= Math.abs(accelerationDatum.time - currentLocationDatum.time)
        ) {

        locationDataIndex++;
        currentLocationDatum = locationDataIndex < locationData.length ? locationData[locationDataIndex] : undefined;
        nextLocationDatum = locationDataIndex + 1 < locationData.length ? locationData[locationDataIndex + 1] : undefined;

      }

      // Record datum if time is within location margin
      if (currentLocationDatum && Math.abs(currentLocationDatum.time - accelerationDatum.time) < margin) {
        result.push({
          locTime: currentLocationDatum.time,
          accTime: accelerationDatum.time,
          lat: currentLocationDatum.lat,
          lon: currentLocationDatum.lon,
          acceleration: accelerationDatum.accAbsolute,
          velocity: currentLocationDatum.velocity
        });
      }

    }

    return result;

  }


  private static calcMillisecondsFromDateAndTimeValues(row: any) {
    const year = +row.date.substr(0, 4);
    const month = +row.date.substr(4, 2) - 1;
    const day = +row.date.substr(6, 2);
    const hours = +row.time.substr(0, 2);
    const minutes = +row.time.substr(2, 2);
    const seconds = +row.time.substr(4, 2);
    const milliseconds = +row.time.substr(6, 2) * 10;
    return new Date(year, month, day, hours, minutes, seconds, milliseconds).getTime();
  }


  async loadPhyphoxExport(file: File): Promise<PhyphoxExport | null> {

    const unzipped = await new JSZip().loadAsync(file);
    const accelerationCsvPromise = unzipped.file('Acceleration.csv')?.async('text');
    const locationCsvPromise = unzipped.file('Location.csv')?.async('text');
    const metaDeviceCsvPromise = unzipped.file('meta/device.csv')?.async('text');
    const metaTimeCsvPromise = unzipped.file('meta/time.csv')?.async('text');
    const [accelerationCsv, locationCsv, metaDeviceCsv, metaTimeCsv] = await Promise.all([
      accelerationCsvPromise,
      locationCsvPromise,
      metaDeviceCsvPromise,
      metaTimeCsvPromise
    ]);

    if (accelerationCsv && locationCsv) {
      return { accelerationCsv, locationCsv, metaDeviceCsv, metaTimeCsv };
    }

    return null;

  }


  async normalizePhyphoxExport(phyphoxExport: PhyphoxExport): Promise<RecordingRaw[]> {

    const parseLocationCsvPromise = this.parseCsv(phyphoxExport.locationCsv);
    const parseAccelerationCsvPromise = this.parseCsv(phyphoxExport.accelerationCsv);
    const [locationCsv, accelerationCsv] = await Promise.all([parseLocationCsvPromise, parseAccelerationCsvPromise]);
    const locationData = (locationCsv.data as Array<any>).map(TrackLoaderService.mapPhyphoxLocationCsv);
    const accelerationData = (accelerationCsv.data as Array<any>).map(TrackLoaderService.mapPhyphoxAccelerationCsv);

    return TrackLoaderService.mergePhyphoxData(locationData, accelerationData);

  }


  async loadCustomExport(file: File): Promise<ParseResult | null> {

    return new Promise((resolve, reject) => {

      const parseConfig: ParseConfig = {
        header: true,
        skipEmptyLines: true,
        complete: resolve,
        error: reject
      };
      this.papa.parse(file, parseConfig);

    });

  }


  normalizeCustomExport(customExport: ParseResult): RecordingRaw[] {

    const data = customExport.data;
    const syntheticRows = customExport.data.map((row: any) => {
      return {
        date: row.date,
        time: row.time,
        latitude: row.latitude,
        longitude: row.longitude,
        shockmax: (+row.shockavg * 2) - +row.shockmax,
        speed: row.speed,
        isSynthetic: true
      };
    });

    const result = [...syntheticRows, ...data].map((row: any) => {
      const time = TrackLoaderService.calcMillisecondsFromDateAndTimeValues(row);
      return {
        locTime: time / 1000,
        accTime: time / 1000,
        lat: +row.latitude,
        lon: +row.longitude,
        acceleration: +row.shockmax,
        velocity: +row.speed,
        isSynthetic: !!row.isSynthetic
      };
    });

    // Normalize time values
    const minTime = Math.min(...result.map(d => d.locTime));
    result.forEach(d => d.locTime = d.accTime = d.locTime - minTime);

    return result;

  }


  async aggregateRecordingData(recording: RecordingRaw[]): Promise<RecordingPerTimeUnit[]> {

    const m = recording.reduce(
      (entryMap, e) => entryMap.set(e.locTime, [...entryMap.get(e.locTime) || [], e]),
      new Map<number, RecordingRaw[]>()
    );

    return Array
      .from(m.values())
      .map(group => ({
        time: group[0].locTime,
        lat: group.reduce((p, c) => p + c.lat, 0) / group.length,
        lon: group.reduce((p, c) => p + c.lon, 0) / group.length,
        maxAcceleration: Math.max(...group.map(r => r.acceleration)),
        avgAcceleration: group.reduce((p, c) => p + c.acceleration, 0) / group.length,
        velocity: group.reduce((p, c) => p + c.velocity, 0) / group.length,
        raw: group
      }));

  }


  private async parseCsv(csv: string): Promise<any> {

    return new Promise((resolve, reject) => {
      const parseConfig: ParseConfig = {
        header: true,
        skipEmptyLines: true,
        complete: resolve,
        error: reject
      };
      this.papa.parse(csv, parseConfig);
    });

  }


}
