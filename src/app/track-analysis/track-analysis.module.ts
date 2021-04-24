import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadTrackdataModalComponent } from './load-trackdata-modal/load-trackdata-modal.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';
import { DrivingProfile, Recording, Track } from './track-loader.service';
import { UploadTrackdataModalComponent } from './upload-trackdata-modal/upload-trackdata-modal.component';
import { FormsModule } from '@angular/forms';
import { Circle } from 'leaflet';


@NgModule({
  declarations: [LoadTrackdataModalComponent, UploadTrackdataModalComponent],
  imports: [
    CommonModule,
    FormsModule
  ]
})
export class TrackAnalysisModule {


  constructor(private modalService: NgbModal) {
  }


  public openRecordingModal(): Observable<Recording> {
    const modalRef = this.modalService.open(LoadTrackdataModalComponent);
    return (modalRef.componentInstance as LoadTrackdataModalComponent).recordingLoaded.asObservable();
  }


  public openUploadRecordingModal(track: Track, excludedDataPoints: Circle[]): Observable<DrivingProfile> {
    const modalRef = this.modalService.open(UploadTrackdataModalComponent);
    (modalRef.componentInstance as UploadTrackdataModalComponent).initialize(track, excludedDataPoints);
    return (modalRef.componentInstance as UploadTrackdataModalComponent).uploadTrackDataConfirmed.asObservable();
  }


}
