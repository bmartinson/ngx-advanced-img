import { Component } from '@angular/core';
import { INgxAdvancedImgBitmapCompression, NgxAdvancedImgBitmap } from '../../projects/ngx-advanced-img/src/public-api';

@Component({
  selector: 'ngx-advanced-img-lib-app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  public imageFile: File | null = null;
  public scale: number = 100;
  public quality: number = 1;
  public size: number = 2097152;
  public maxDimension: number = 16384;

  public constructor() {
  }

  public onFileChange(event: any): void {
    const file = event.target.files[0];

    if (file) {
      this.imageFile = file;
    }
  }

  public onScaleChange(event: any): void {
    this.scale = event.target.value;
  }

  public onQualityChange(event: any): void {
    this.quality = event.target.value;
  }

  public onSizeChange(event: any): void {
    this.size = event.target.value;
  }

  public onMaxDimensionChange(event: any): void {
    this.maxDimension = event.target.value;
  }

  public processImage(): void {
    if (!this.imageFile) {
      console.error('No image file selected.');
      return;
    }

    // Implement image processing logic here
    console.log('Processing image with scale:', this.scale, 'and quality:', this.quality);
    const bitmap: NgxAdvancedImgBitmap = new NgxAdvancedImgBitmap(this.imageFile, '', 0, 0);

    bitmap.load().finally(() => {
      console.log('bitmap loaded with size (B):', bitmap.fileSize);

      // compress the image to a smaller file size
      console.log(
        '[TEST] Quality:', this.quality,
        'Type:', bitmap.mimeType,
        'Initial Size (B):', bitmap.initialFileSize,
        'Loaded File Size (B):', bitmap.fileSize,
        'Size Limit (B):', this.size,
        'Dimension Limit (pixels):', this.maxDimension,
        'Resize Factor', this.scale / 100
      );

      performance.mark('compression_start');
      bitmap.compress(+this.quality, bitmap.mimeType, +this.scale / 100, +this.maxDimension, this.size ? +this.size : undefined).then((data: INgxAdvancedImgBitmapCompression) => {
        performance.mark('compression_end');
        performance.measure('Image Compression', 'compression_start', 'compression_end');

        // auto save this for the user
        console.log('[TEST] Saving URL:', data.objectURL, data.exifData);

        performance.mark('save_start');
        bitmap.saveFile('test', data.objectURL, bitmap.mimeType);
        performance.mark('save_end');
        performance.measure('Image Saving', 'save_start', 'save_end');

        const compressionMeasure = performance.getEntriesByName('Image Compression')[0];
        const saveMeasure = performance.getEntriesByName('Image Saving')[0];
        console.log(`${bitmap.mimeType} compression took ${compressionMeasure.duration} ms`);
        console.log(`${bitmap.mimeType} saving took ${saveMeasure.duration} ms`);
      }); // let the errors bubble up
    });
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    let len = bytes.byteLength;

    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return window.btoa(binary);
  }

}
