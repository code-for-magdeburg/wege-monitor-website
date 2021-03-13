import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
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
import { Papa, ParseConfig } from 'ngx-papaparse';
import * as chroma from 'chroma-js';
import { h3ToGeo, geoToH3, h3ToGeoBoundary } from 'h3-js';


const centerMagdeburg = latLng(52.120545, 11.627632);


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

  @ViewChild('recordingFileInput') recordingFileInput!: ElementRef;


  constructor(private http: HttpClient, private papa: Papa) {
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
      center: centerMagdeburg
    };

  }


  onMapReady(map: LeafletMap): void {
    this.map = map;
    this.loadCyclePaths();
    this.loadAvgBaseData();
    this.loadMaxBaseData();
  }


  recordingFileChanged(ev: Event): void {

    const inputElement = ev.target as HTMLInputElement;
    if (inputElement.files && inputElement.files.length > 0) {
      this.loadRecording(inputElement.files[0]);
      this.recordingFileInput.nativeElement.value = '';
    }

  }


  removeRecording(): void {
    if (this.recordingLayer) {
      this.recordingLayer.remove();
    }
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


  private loadAvgBaseData(): void {

    this.http
      .get('assets/avg-base-data-h3-res13.csv', { responseType: 'text' })
      .subscribe(csv => {

        const parseConfig: ParseConfig = {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: parsedResult => {

            const data: { h3Index: string, avgAcceleration: number }[] = parsedResult.data;
            const layers: Layer[] = data.map(row => {
              const fillColor = this.baseDataColorScale(row.avgAcceleration);
              const poly = h3ToGeoBoundary(row.h3Index);
              return polygon(poly.map(d => latLng(d[0], d[1])), { stroke: false, fillColor, fillOpacity: 0.6 });
            });
            this.avgBaseDataLayer = layerGroup(layers).addTo(this.map);

          }
        };
        this.papa.parse(csv, parseConfig);

      }, err => {
        // TODO: Handle error
        console.log(err);
      });

  }


  private loadMaxBaseData(): void {

    this.http
      .get('assets/max-base-data-h3-res14.csv', { responseType: 'text' })
      .subscribe(csv => {

        const parseConfig: ParseConfig = {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: parsedResult => {

            const data: { h3Index: string, maxAcceleration: number }[] = parsedResult.data;
            const layers: Layer[] = data.map(row => {
              const fillColor = this.baseDataColorScale(row.maxAcceleration);
              const center = h3ToGeo(row.h3Index);
              return circle(latLng(center[0], center[1]), { radius: 10, stroke: false, fillColor, fillOpacity: 0.6 });
            });
            this.maxBaseDataLayer = layerGroup(layers).addTo(this.map);

          }
        };
        this.papa.parse(csv, parseConfig);

      }, err => {
        // TODO: Handle error
        console.log(err);
      });

  }


  private loadRecording(file: File): void {

    const parseConfig: ParseConfig = {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: parsedResults => {

        const array: any[] = parsedResults.data;
        const layers = array.map(row => {
          const fillColor = this.colorScale(row.acceleration);
          return circle(latLng(row.latitude, row.longitude), { radius: 5, stroke: false, fillColor, fillOpacity: 1 });
        });

        if (this.recordingLayer) {
          this.recordingLayer.clearLayers();
        }
        this.recordingLayer = layerGroup(layers).addTo(this.map);

        const lle = array.map(row => latLng(row.latitude, row.longitude));
        const llb = latLngBounds(lle);
        this.map.fitBounds(llb);

      }
    };
    this.papa.parse(file, parseConfig);

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
