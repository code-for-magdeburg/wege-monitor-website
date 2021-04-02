import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadTrackdataModalComponent } from './load-trackdata-modal/load-trackdata-modal.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';
import { Recording } from './track-loader.service';


@NgModule({
  declarations: [LoadTrackdataModalComponent],
  imports: [
    CommonModule
  ]
})
export class TrackAnalysisModule {


  constructor(private modalService: NgbModal) {
  }


  public openRecordingModal(): Observable<Recording> {
    const modalRef = this.modalService.open(LoadTrackdataModalComponent);
    return (modalRef.componentInstance as LoadTrackdataModalComponent).recordingLoaded.asObservable();
  }


}
