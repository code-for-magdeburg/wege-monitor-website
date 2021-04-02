import { Component, Input } from '@angular/core';
import { Track } from '../track-analysis/track-loader.service';
import { HttpClient } from '@angular/common/http';
import { Papa } from 'ngx-papaparse';
import * as JSZip from 'jszip';


@Component({
  selector: 'app-track-options',
  templateUrl: './track-options.component.html',
  styleUrls: ['./track-options.component.scss']
})
export class TrackOptionsComponent {


  @Input() track: Track | undefined;


  constructor(private http: HttpClient, private papa: Papa) {
  }


  async uploadData(): Promise<void> {

    const createPresignedPostResponse = await this.http
      .get<any>('/.netlify/functions/create-presigned-post')
      .toPromise();

    const formData = new FormData();
    Object
      .keys(createPresignedPostResponse.fields)
      .forEach(key => formData.append(key, createPresignedPostResponse.fields[key]));

    const zip = new JSZip();
    const recordingsCsv = this.papa.unparse(this.track?.recording.normalizedRecordings);
    zip.file('recording.csv', recordingsCsv);

    const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    formData.append('file', content);

    await this.http
      .post(createPresignedPostResponse.url, formData)
      .toPromise();

  }


}
