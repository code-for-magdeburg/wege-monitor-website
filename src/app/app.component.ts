import { Compiler, Component, Injector, OnInit } from '@angular/core';
import {
  circle, geoJSON,
  latLng,
  latLngBounds, Layer,
  LayerGroup, layerGroup,
  Map as LeafletMap,
  MapOptions, polygon,
  tileLayer
} from 'leaflet';
import { HttpClient } from '@angular/common/http';
import { Papa } from 'ngx-papaparse';
import * as chroma from 'chroma-js';
import { h3ToGeo, geoToH3, h3ToGeoBoundary } from 'h3-js';
import { RecordingWithRating, RecordingPerTimeUnit, Track, Recording } from './track-analysis/track-loader.service';


const CENTER_MAGDEBURG = latLng(52.120545, 11.627632);
const H3_MAGDEBURG_RES7 = geoToH3(CENTER_MAGDEBURG.lat, CENTER_MAGDEBURG.lng, 7);


const MIN_VELOCITY = 15 / 3.6;
const BEST_VELOCITY = 20 / 3.6;
const MAX_VELOCITY = 25 / 3.6;
const TOO_SLOW = 'TOO_SLOW';
const TOO_FAST = 'TOO_FAST';
const GOOD_SPEED = 'GOOD_SPEED';
const PERFECT_SPEED = 'PERFECT_SPEED';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {


  private chromaScale = chroma.scale('RdYlGn');
  private map!: LeafletMap;
  mapOptions: MapOptions = {};

  private cyclePathsDataLayer: LayerGroup = layerGroup();
  private avgBaseDataLayer: LayerGroup = layerGroup();
  private maxBaseDataLayer: LayerGroup = layerGroup();
  private recordingLayer: LayerGroup = layerGroup();

  cyclePathsVisible = true;
  baseDataVisible = true;
  track: Track | null = null;


  private static rateVelocity(velocity: number): string {

    if (velocity < MIN_VELOCITY) {
      return TOO_SLOW;
    }

    if (velocity > MAX_VELOCITY) {
      return TOO_FAST;
    }

    if (velocity > BEST_VELOCITY) {
      return GOOD_SPEED;
    }

    return PERFECT_SPEED;

  }


  private static evaluateRecording(recording: RecordingPerTimeUnit[]): RecordingWithRating[] {

    return recording.map(row => {
      return {
        velocityRating: AppComponent.rateVelocity(row.velocity),
        recordingData: row
      };
    });

  }


  private static filterAcceptedRecording(evaluatedData: RecordingWithRating[]): RecordingPerTimeUnit[] {

    return evaluatedData
      .filter(e => e.velocityRating === GOOD_SPEED || e.velocityRating === PERFECT_SPEED)
      .map(d => d.recordingData);

  }


  constructor(
    private http: HttpClient,
    private papa: Papa,
    private compiler: Compiler,
    private injector: Injector) {
  }


  ngOnInit(): void {

    this.mapOptions = {
      layers: [
        tileLayer(
          'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
          {
            maxZoom: 18,
            attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
          })
      ],
      zoom: 13,
      center: CENTER_MAGDEBURG
    };

  }


  onMapReady(map: LeafletMap): void {
    this.map = map;
    this.loadCyclePaths();
    this.loadBaseData();
  }


  loadRecording(): void {

    import('./track-analysis/track-analysis.module')
      .then(async ({ TrackAnalysisModule }) => {

        const moduleFactory = await this.compiler.compileModuleAsync(TrackAnalysisModule);
        moduleFactory
          .create(this.injector)
          .instance
          .openRecordingModal()
          .subscribe(recording => this.processRecording(recording));

      });

  }


  removeRecording(): void {
    if (this.recordingLayer) {
      this.recordingLayer.remove();
    }
    this.track = null;
  }


  showHideCyclePaths(show: boolean): void {
    this.cyclePathsVisible = show;
    if (show) {
      this.showCyclePaths();
    } else {
      this.hideCyclePaths();
    }
  }


  showHideBaseData(show: boolean): void {
    this.baseDataVisible = show;
    if (show) {
      this.showBaseData();
    } else {
      this.hideBaseData();
    }
  }


  private loadCyclePaths(): void {

    this.http
      .get('assets/cyclepaths-magdeburg.geojson')
      .subscribe(geojson => {
        this.cyclePathsDataLayer = geoJSON(geojson as any, { style: { opacity: 0.4 } }).addTo(this.map);
      }, err => {
        // TODO: Handle error
        console.log(err);
      });

  }


  private loadBaseData(): void {

    const params = { h3Res7Key: H3_MAGDEBURG_RES7 };
    this.http
      .get<{ h3Index: string, maxAcceleration: number, avgAcceleration: number }[]>('/.netlify/functions/get-base-data', { params })
      .subscribe(data => {

        const layers: { avgLayer: Layer, maxLayer: Layer }[] = data.map(row => {

          const avgFillColor = this.baseDataColorScale(row.avgAcceleration);
          const poly = h3ToGeoBoundary(row.h3Index);
          const avgLayer = polygon(poly.map(d => latLng(d[0], d[1])), { stroke: false, fillColor: avgFillColor, fillOpacity: 0.6 });

          const maxFillColor = this.baseDataColorScale(row.maxAcceleration);
          const center = h3ToGeo(row.h3Index);
          const maxLayer = circle(latLng(center[0], center[1]), { radius: 10, stroke: false, fillColor: maxFillColor, fillOpacity: 0.6 });

          return { avgLayer, maxLayer };

        });

        this.avgBaseDataLayer = layerGroup(layers.map(l => l.avgLayer)).addTo(this.map);
        this.maxBaseDataLayer = layerGroup(layers.map(l => l.maxLayer)).addTo(this.map);

      });

  }


  private async processRecording(recording: Recording): Promise<void> {

    const evaluatedData = AppComponent.evaluateRecording(recording.recordingsPerTimeUnit);
    const acceptedData = AppComponent.filterAcceptedRecording(evaluatedData);
    this.track = { recording, evaluatedData, acceptedData };

    const maxAcceleration = Math.max(...recording.recordingsPerTimeUnit.map(a => a.maxAcceleration));
    const layers = recording.recordingsPerTimeUnit.map(row => {
      const fillColor = this.colorScale(row.maxAcceleration / maxAcceleration);
      return circle(latLng(row.lat, row.lon), { radius: 5, stroke: false, fillColor, fillOpacity: 1 });
    });

    if (this.recordingLayer) {
      this.recordingLayer.clearLayers();
    }
    this.recordingLayer = layerGroup(layers).addTo(this.map);

    const lle = recording.recordingsPerTimeUnit.map(row => latLng(row.lat, row.lon));
    const llb = latLngBounds(lle);
    this.map.fitBounds(llb);

  }


  private colorScale(acceleration: number): string {
    return this.chromaScale(1 - acceleration).hex();
  }


  private baseDataColorScale(acceleration: number): string {
    return this.chromaScale(1 - acceleration).hex();
  }


  private showCyclePaths(): void {
    this.cyclePathsDataLayer.addTo(this.map);
  }


  private hideCyclePaths(): void {
    this.cyclePathsDataLayer.remove();
  }


  private showBaseData(): void {
    this.avgBaseDataLayer.addTo(this.map);
    this.maxBaseDataLayer.addTo(this.map);
  }


  private hideBaseData(): void {
    this.avgBaseDataLayer.remove();
    this.maxBaseDataLayer.remove();
  }


}



