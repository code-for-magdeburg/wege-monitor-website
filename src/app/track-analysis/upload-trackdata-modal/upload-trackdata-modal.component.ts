import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { DrivingProfile } from '../track-loader.service';


@Component({
  selector: 'app-upload-trackdata-modal',
  templateUrl: './upload-trackdata-modal.component.html',
  styleUrls: ['./upload-trackdata-modal.component.scss']
})
export class UploadTrackdataModalComponent {


  lowerMaxAcceleration = 0;
  upperMaxAcceleration = 0;
  lowerAvgAcceleration = 0;
  upperAvgAcceleration = 0;

  uploadTrackDataConfirmed = new Subject<DrivingProfile>();


  constructor(public activeModal: NgbActiveModal) {
  }


  confirm(): void {

    const drivingProfile: DrivingProfile = {
      avgAcceleration: {
        lowerValue: this.lowerAvgAcceleration,
        upperValue: this.upperAvgAcceleration
      },
      maxAcceleration: {
        lowerValue: this.lowerMaxAcceleration,
        upperValue: this.upperMaxAcceleration
      }
    };
    this.uploadTrackDataConfirmed.next(drivingProfile);

    this.activeModal.close();

  }


}
