import { Component, ElementRef, ViewChild } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { Recording, TrackLoaderService } from '../track-loader.service';


@Component({
  selector: 'app-load-trackdata-modal',
  templateUrl: './load-trackdata-modal.component.html',
  styleUrls: ['./load-trackdata-modal.component.scss']
})
export class LoadTrackdataModalComponent {


  recordingLoaded = new Subject<Recording>();

  @ViewChild('recordingFileInput') recordingFileInput!: ElementRef;


  constructor(public activeModal: NgbActiveModal, private trackLoaderService: TrackLoaderService) {
  }


  async recordingFileChanged(event: Event): Promise<void> {

    const inputElement = event.target as HTMLInputElement;
    if (inputElement.files && inputElement.files.length > 0) {

      const loadedPhyphoxExport = await this.trackLoaderService.loadPhyphoxExport(inputElement.files[0]);
      if (loadedPhyphoxExport) {

        const normalizedRecordings = await this.trackLoaderService.normalizePhyphoxExport(loadedPhyphoxExport);
        const recordingsPerTimeUnit = await this.trackLoaderService.aggregateRecordingData(normalizedRecordings);

        const recording: Recording = {
          sourceType: 'phyphox',
          raw: loadedPhyphoxExport,
          normalizedRecordings,
          recordingsPerTimeUnit
        };
        this.recordingLoaded.next(recording);

        this.activeModal.dismiss();

      } else {
        // TODO: Handle failed loading of export file
      }

      this.recordingFileInput.nativeElement.value = '';

    }

  }


}
