import { Component, Input } from '@angular/core';
import { Track } from '../track-analysis/track-loader.service';


@Component({
  selector: 'app-track-options',
  templateUrl: './track-options.component.html',
  styleUrls: ['./track-options.component.scss']
})
export class TrackOptionsComponent {


  @Input() track: Track | undefined;


}
