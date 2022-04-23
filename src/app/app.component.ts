import { AfterViewInit, Compiler, Component, ElementRef, Injector, NgZone, OnInit, ViewChild } from '@angular/core';
import {
  Circle,
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
import { h3ToGeo, geoToH3, h3ToGeoBoundary, polyfill } from 'h3-js';
import { RecordingWithRating, RecordingPerTimeUnit, Track, Recording } from './track-analysis/track-loader.service';
import { Offcanvas } from 'bootstrap';
import { environment } from '../environments/environment';


const CENTER_MAGDEBURG = latLng(52.120545, 11.627632);

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
export class AppComponent implements OnInit, AfterViewInit {


  private chromaScale = chroma.scale('RdYlGn');
  private map!: LeafletMap;
  mapOptions: MapOptions = {};

  private cyclePathsDataLayer: LayerGroup = layerGroup();
  private avgBaseDataLayer: LayerGroup = layerGroup();
  private maxBaseDataLayer: LayerGroup = layerGroup();
  private recordingLayer: LayerGroup = layerGroup();
  private excludedDataPoints: Circle[] = [];

  cyclePathsVisible = true;
  baseDataVisible = true;
  track: Track | null = null;
  selectedMarker: Circle | undefined = undefined;
  selectedMarkerIsExcluded = false;

  @ViewChild('root') rootElement!: ElementRef;
  @ViewChild('offcanvas') offcanvasElement!: ElementRef;


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
    private ngZone: NgZone,
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


  ngAfterViewInit(): void {
    const offcanvas = new Offcanvas(this.offcanvasElement.nativeElement);
    offcanvas.show(this.rootElement.nativeElement);
  }


  onMapReady(map: LeafletMap): void {
    this.map = map;
    this.loadCyclePaths();
    this.loadBaseData();
    this.showBaseData();
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


  removeDataPoint(dataPoint: Circle): void {
    this.excludedDataPoints.push(dataPoint);
    this.selectedMarkerIsExcluded = true;
    dataPoint.setStyle({ fillOpacity: 0.3 });
  }


  undoRemoveDataPoint(dataPoint: Circle): void {
    const index = this.excludedDataPoints.findIndex(e => e === dataPoint);
    if (index > 0) {
      this.excludedDataPoints.splice(index, 1);
    }
    this.selectedMarkerIsExcluded = false;
    dataPoint.setStyle({ fillOpacity: 1 });
  }


  async uploadRecording(): Promise<void> {

    if (!this.track) {
      return;
    }

    const { TrackAnalysisModule } = await import('./track-analysis/track-analysis.module');
    const moduleFactory = await this.compiler.compileModuleAsync(TrackAnalysisModule);
    moduleFactory
      .create(this.injector)
      .instance
      .openUploadRecordingModal(this.track, this.excludedDataPoints)
      .subscribe(async drivingProfile => {
        console.log(drivingProfile);
      });

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

    const mapBounds = this.map.getBounds();
    const mapNorthWest = mapBounds.getNorthWest();
    const mapNorthEast = mapBounds.getNorthEast();
    const mapSouthEast = mapBounds.getSouthEast();
    const mapSouthWest = mapBounds.getSouthWest();

    // Collect all resolution 7 H3 indices within current map view
    const fill = new Set(polyfill([
      [mapNorthWest.lat, mapNorthWest.lng],
      [mapNorthEast.lat, mapNorthEast.lng],
      [mapSouthEast.lat, mapSouthEast.lng],
      [mapSouthWest.lat, mapSouthWest.lng],
      [mapNorthWest.lat, mapNorthWest.lng]
    ], 7));

    // Add map corners
    fill.add(geoToH3(mapNorthWest.lat, mapNorthWest.lng, 7));
    fill.add(geoToH3(mapNorthEast.lat, mapNorthEast.lng, 7));
    fill.add(geoToH3(mapSouthEast.lat, mapSouthEast.lng, 7));
    fill.add(geoToH3(mapSouthWest.lat, mapSouthWest.lng, 7));

    // Refuse to load data when zoom level is too low
    if (fill.size > 25) {
      return;
    }

    this.avgBaseDataLayer.clearLayers();
    this.maxBaseDataLayer.clearLayers();

    for (const fillKey of fill) {
      this.http
        .get<{ h3IndexRes07: string, h3IndexRes13: any }>(`${environment.cloudfrontBaseUrl}/H3Res07/${fillKey}.json`)
        .subscribe(data => {

          const layers: { avgLayer: Layer, maxLayer: Layer }[] = Object.keys(data.h3IndexRes13).map(key => {

            const row = { ...data.h3IndexRes13[key], h3Index: key };

            const avgFillColor = this.baseDataColorScale(row.avgAcc);
            const poly = h3ToGeoBoundary(row.h3Index);
            const avgLayer = polygon(poly.map(d => latLng(d[0], d[1])), { stroke: false, fillColor: avgFillColor, fillOpacity: 0.6 });

            const maxFillColor = this.baseDataColorScale(row.maxAcc);
            const center = h3ToGeo(row.h3Index);
            const maxLayer = circle(latLng(center[0], center[1]), { radius: 10, stroke: false, fillColor: maxFillColor, fillOpacity: 0.6 });

            return { avgLayer, maxLayer };

          });

          layers.forEach(layer => {
            this.avgBaseDataLayer.addLayer(layer.avgLayer);
            this.maxBaseDataLayer.addLayer(layer.maxLayer);
          });

        });
    }

  }


  private async processRecording(recording: Recording): Promise<void> {

    const evaluatedData = AppComponent.evaluateRecording(recording.recordingsPerTimeUnit);
    const acceptedData = AppComponent.filterAcceptedRecording(evaluatedData);
    this.track = { recording, evaluatedData, acceptedData };

    const minAcceleration = Math.min(...recording.recordingsPerTimeUnit.map(a => a.maxAcceleration));
    const maxAcceleration = Math.max(...recording.recordingsPerTimeUnit.map(a => a.maxAcceleration));
    const layers = recording.recordingsPerTimeUnit.map(row => {
      const normalizedAcceleration = (row.maxAcceleration - minAcceleration) / (maxAcceleration - minAcceleration);
      const fillColor = this.colorScale(normalizedAcceleration);
      const marker = circle(
        latLng(row.lat, row.lon),
        { radius: 5, stroke: false, color: '#fcead0', weight: 5, fillColor, fillOpacity: 1 }
      );
      marker.feature = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [row.lon, row.lat] },
        id: row.time,
        properties: { ...row }
      };
      marker.on('click', e => this.markerClicked(marker));
      return marker;
    });

    if (this.recordingLayer) {
      this.recordingLayer.clearLayers();
    }
    this.recordingLayer = layerGroup(layers).addTo(this.map);
    this.excludedDataPoints = [];

    const lle = recording.recordingsPerTimeUnit.map(row => latLng(row.lat, row.lon));
    const llb = latLngBounds(lle);
    this.map.fitBounds(llb);

  }


  centerChanged(): void {
    this.loadBaseData();
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


  private markerClicked(marker: Circle): void {

    this.ngZone.run(() => {
      if (this.selectedMarker) {
        this.selectedMarker.setStyle({ stroke: false });
      }
      this.selectedMarker = marker;
      this.selectedMarkerIsExcluded = this.excludedDataPoints.some(e => e === marker);
      marker.setStyle({ stroke: true });
    });

  }


}



