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


      let mimeType: string = 'image/jpeg';
      let quality = 1;
      let sizeLimit = 3355443.2; // 6291456 for 6MB -- try 2097152 for 2MB -- try 3355443.2 for 3.2MB
      let resizeFactor = 1;
      let url = '';

      console.log('[TEST] Quality:', quality, 'Type:', mimeType, 'Size Limit (B):', sizeLimit, 'Resize Factor', resizeFactor);
      url = bitmap.compress(quality, mimeType, resizeFactor, sizeLimit);

      console.log('[TEST] Saving URL:', url);
      bitmap.saveFile('test', url, mimeType);
    });
  }

}
