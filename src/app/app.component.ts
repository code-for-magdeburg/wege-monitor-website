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

  map!: LeafletMap;
  options!: MapOptions;

  cyclePathsDataLayer!: LayerGroup;
  baseDataLayer!: LayerGroup;
  recordingLayer!: LayerGroup;

  cyclePathsVisible = true;
  baseDataVisible = true;

  @ViewChild('recordingFileInput') recordingFileInput!: ElementRef;


  constructor(private http: HttpClient, private papa: Papa) {
  }


  ngOnInit(): void {

    this.options = {
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
    this.loadBaseData();
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


  private loadBaseData(): void {

    this.http
      .get('assets/base-data.csv', { responseType: 'text' })
      .subscribe(csv => {

        const parseConfig: ParseConfig = {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: parsedResult => {

            const data: any[] = parsedResult.data;

            // Create hash map
            const baseDataHashMap = new Map();
            for (const datum of data) {
              const h3Index = geoToH3(datum.latitude, datum.longitude, 13);
              const v = baseDataHashMap.get(h3Index);
              if (v) {
                baseDataHashMap.set(h3Index, [...v, datum]);
              } else {
                baseDataHashMap.set(h3Index, [datum]);
              }
            }

            // Convert hash map into hexagon data structure
            const layers: Layer[] = [];
            baseDataHashMap.forEach((values: any[], h3Index) => {
              //const avg = values.reduce((p, c) => p + c.acceleration, 0) / values.length;
              //const color = this.colorScale(avg);
              const max = values.reduce((p, c) => c.acceleration > p ? c.acceleration : p, 0) / values.length;
              const fillColor = this.colorScale(max);
              const poly = h3ToGeoBoundary(h3Index);
              //layers.push(polygon(poly.map(d => latLng(d[0], d[1])), { stroke: false, fillColor, fillOpacity: 0.6 }));
              const center = h3ToGeo(h3Index);
              layers.push(circle(latLng(center[0], center[1]), { radius: 10, stroke: false, fillColor, fillOpacity: 0.6 }));
            });

            this.baseDataLayer = layerGroup(layers).addTo(this.map);

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
    return this.chromaScale(0.8 - acceleration / 10).hex();
  }


  private showCyclePaths(): void {
    this.cyclePathsDataLayer.addTo(this.map);
  }


  private hideCyclePaths(): void {
    this.cyclePathsDataLayer.remove();
  }


  private showBaseData(): void {
    this.baseDataLayer.addTo(this.map);
  }


  private hideBaseData(): void {
    this.baseDataLayer.remove();
  }


}
