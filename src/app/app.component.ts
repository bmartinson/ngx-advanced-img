import { Component } from '@angular/core';
import { NgxAdvancedImgBitmap } from '../../projects/ngx-advanced-img/src/public-api';

@Component({
  selector: 'ngx-advanced-img-lib-app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  public constructor() {
    // load a cool image
    const bitmap: NgxAdvancedImgBitmap = new NgxAdvancedImgBitmap('https://full.treering.com/P80/364586191.1', '', 0, 0);
    bitmap.load().finally(() => {
      console.log('bitmap loaded with size (B):', bitmap.fileSize);

      let mimeType: string = 'image/jpg';
      let quality = 1;
      let sizeLimit = 3355443.2; // 6291456 for 6MB -- try 2097152 for 2MB -- try 3355443.2 for 3.2MB
      let resizeFactor = 1;
      let url = '';

      // compress the image to a smaller file size
      console.log('[TEST] Quality:', quality, 'Type:', mimeType, 'Size Limit (B):', sizeLimit, 'Resize Factor', resizeFactor);
      bitmap.compress(quality, mimeType, resizeFactor, sizeLimit).then((url: string) => {
        // auto save this for the user
        console.log('[TEST] Saving URL:', url);
        bitmap.saveFile('test', url, mimeType);
      }); // let the errors bubble up
    });
  }

}
