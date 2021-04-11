import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Track } from '../track-analysis/track-loader.service';
import { Circle } from 'leaflet';


@Component({
  selector: 'app-track-options',
  templateUrl: './track-options.component.html',
  styleUrls: ['./track-options.component.scss']
})
export class TrackOptionsComponent {


  @Input() track: Track | undefined;
  @Input() selectedDataPoint: Circle | undefined;
  @Input() selectedIsExcluded = false;

  @Output() recordingSubmitted = new EventEmitter();
  @Output() trackDiscarded = new EventEmitter();
  @Output() dataPointDiscarded = new EventEmitter<Circle>();
  @Output() dataPointUndiscarded = new EventEmitter<Circle>();


  uploadData(): void {
    this.recordingSubmitted.emit();
  }


  discardTrack(): void {
    this.trackDiscarded.emit();
  }


  discardDataPoint(dataPoint: Circle): void {
    this.dataPointDiscarded.emit(dataPoint);
  }


  undoDiscardDataPoint(dataPoint: Circle): void {
    this.dataPointUndiscarded.emit(dataPoint);
  }


}
