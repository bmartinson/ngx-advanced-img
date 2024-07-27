import { Component } from '@angular/core';
import { NgxAdvancedImgBitmap } from '../../projects/ngx-advanced-img/src/public-api';

@Component({
  selector: 'ngx-advanced-img-lib-app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  public constructor() {
    const bitmap: NgxAdvancedImgBitmap = new NgxAdvancedImgBitmap('https://full.treering.com/P80/364586191.1', '', 0, 0);
    bitmap.load().finally(() => {
      console.log('bitmap loaded with size (B):', bitmap.fileSize);


      let mimeType: string = 'image/png';
      let quality = 1;
      let sizeLimit = 6291456; // 6 MB
      let resizeFactor = 0.5;
      let url = '';

      console.log('[TEST] Quality:', quality, 'Type:', mimeType, 'Size Limit (B):', sizeLimit, 'Resize Factor', resizeFactor);
      url = bitmap.compress(quality, mimeType)

      console.log('[TEST] Saving URL:', url);
      bitmap.saveFile('test', url, mimeType);
    });
  }

}
