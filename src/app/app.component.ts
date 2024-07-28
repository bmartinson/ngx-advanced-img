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

      let quality = 1;
      let sizeLimit = 2097152; // 6291456 for 6MB -- try 2097152 for 2MB -- try 3355443.2 for 3.2MB
      let resizeFactor = 1;

      // compress the image to a smaller file size
      console.log('[TEST] Quality:', quality, 'Type:', bitmap.mimeType, 'Size Limit (B):', sizeLimit, 'Resize Factor', resizeFactor);

      performance.mark('compression_start');
      bitmap.compress(quality, bitmap.mimeType, resizeFactor, sizeLimit).then((url: string) => {
        performance.mark('compression_end');
        performance.measure('Image Compression', 'compression_start', 'compression_end');

        // auto save this for the user
        console.log('[TEST] Saving URL:', url);

        performance.mark('save_start');
        bitmap.saveFile('test', url, bitmap.mimeType);
        performance.mark('save_end');
        performance.measure('Image Saving', 'save_start', 'save_end');

        const compressionMeasure = performance.getEntriesByName('Image Compression')[0];
        const saveMeasure = performance.getEntriesByName('Image Saving')[0];
        console.log(`${bitmap.mimeType} compression took ${compressionMeasure.duration} ms`);
        console.log(`${bitmap.mimeType} saving took ${saveMeasure.duration} ms`);
      }); // let the errors bubble up
    });
  }

}
