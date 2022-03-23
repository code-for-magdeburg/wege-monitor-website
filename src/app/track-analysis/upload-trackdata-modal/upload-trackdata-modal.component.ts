import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { DrivingProfile, RecordingRaw, Track } from '../track-loader.service';
import * as JSZip from 'jszip';
import { HttpClient } from '@angular/common/http';
import { Circle } from 'leaflet';
import { Papa } from 'ngx-papaparse';


@Component({
  selector: 'app-upload-trackdata-modal',
  templateUrl: './upload-trackdata-modal.component.html',
  styleUrls: ['./upload-trackdata-modal.component.scss']
})
export class UploadTrackdataModalComponent {


  isUploading = false;

  lowerMaxAcceleration = 0;
  upperMaxAcceleration = 0;
  lowerAvgAcceleration = 0;
  upperAvgAcceleration = 0;
  track: Track | null = null;
  excludedDataPoints: Circle[] = [];

  uploadTrackDataConfirmed = new Subject<DrivingProfile>();


  constructor(public activeModal: NgbActiveModal, private http: HttpClient, private papa: Papa) {
  }


  initialize(track: Track, excludedDataPoints: Circle[]): void {

    const recordings = track.recording.recordingsPerTimeUnit;

    this.track = track;
    this.excludedDataPoints = excludedDataPoints;
    this.lowerMaxAcceleration = 0;
    this.upperMaxAcceleration = Math.ceil(Math.max(...recordings.map(r => r.maxAcceleration)));
    this.lowerAvgAcceleration = 0;
    this.upperAvgAcceleration = Math.ceil(Math.max(...recordings.map(r => r.avgAcceleration)));

  }


  async confirm(): Promise<void> {

    if (!this.track) {
      return;
    }

    this.isUploading = true;

    const createPresignedPostResponse = await this.http
      .get<any>('/.netlify/functions/create-presigned-post')
      .toPromise();

    const formData = new FormData();
    Object
      .keys(createPresignedPostResponse.fields)
      .forEach(key => formData.append(key, createPresignedPostResponse.fields[key]));

    const withoutExcluded = (recording: RecordingRaw): boolean => !this.excludedDataPoints.some(e => e.feature?.id === recording.time);
    const recordings = this.track.recording.normalizedRecordings
      .filter(withoutExcluded)
      .sort((a, b) => a.time - b.time);
    const recordingsCsv = this.papa.unparse(recordings);
    const zip = new JSZip();
    zip.file('recording.csv', recordingsCsv);

    const drivingProfile = this.createDrivingProfile();
    zip.file('profile.json', JSON.stringify(drivingProfile, null, 4));

    const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    formData.append('file', content);

    await this.http
      .post(createPresignedPostResponse.url, formData)
      .toPromise();

    this.uploadTrackDataConfirmed.next(drivingProfile);

    this.activeModal.close();

    this.isUploading = false;

  }


  private createDrivingProfile(): DrivingProfile {

    return {
      avgAcceleration: {
        lowerValue: this.lowerAvgAcceleration,
        upperValue: this.upperAvgAcceleration
      },
      maxAcceleration: {
        lowerValue: this.lowerMaxAcceleration,
        upperValue: this.upperMaxAcceleration
      }
    };

  }


}
