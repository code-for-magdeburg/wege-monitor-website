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


  recordingLoaded = new Subject<Recording[]>();

  @ViewChild('recordingFileInput') recordingFileInput!: ElementRef;


  constructor(public activeModal: NgbActiveModal, private trackLoaderService: TrackLoaderService) {
  }


  async recordingFileChanged(event: Event): Promise<void> {

    const inputElement = event.target as HTMLInputElement;
    if (inputElement.files && inputElement.files.length > 0) {
      const loadedPhyphoxExport = await this.trackLoaderService.loadPhyphoxExport(inputElement.files[0]);
      if (loadedPhyphoxExport) {
        const preprocessedRecording = await this.trackLoaderService.preprocessPhyphoxExport(loadedPhyphoxExport);
        const recording = await this.trackLoaderService.aggregateRecordingData(preprocessedRecording);
        this.recordingLoaded.next(recording);
      } else {
        // TODO: Handle failed loading of export file
      }
      this.recordingFileInput.nativeElement.value = '';
    }

  }


}
