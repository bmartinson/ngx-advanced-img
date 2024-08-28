import { Component } from '@angular/core';
import { INgxAdvancedImgBitmapOptimization, INgxAdvancedImgBitmapInfo, NgxAdvancedImgBitmap } from '../../projects/ngx-advanced-img/src/public-api';

@Component({
  selector: 'ngx-advanced-img-lib-app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  public imageFiles: File[] | null = null;
  public scale: number = 100;
  public quality: number = 1;
  public size: number = 2097152;
  public maxDimension: number = 16384;
  public strictMode: boolean = false;
  public mode: 'prefer-size' | 'prefer-quality' | 'balanced' | 'hardcore' = 'prefer-size';

  public constructor() {
  }

  private static getFileNameWithoutExtension(file: File): string {
    const fileName = file.name;
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) return fileName; // No extension found
    return fileName.substring(0, lastDotIndex);
  }

  public onFileChange(event: any): void {
    this.imageFiles = Array.from(event.target?.files);
  }

  public onScaleChange(event: any): void {
    this.scale = +event.target.value;
  }

  public onQualityChange(event: any): void {
    this.quality = +event.target.value;
  }

  public onSizeChange(event: any): void {
    this.size = +event.target.value;
  }

  public onMaxDimensionChange(event: any): void {
    this.maxDimension = +event.target.value;
  }

  public onStrictModeChange(event: any): void {
    this.strictMode = !!event.target.checked;
  }

  public onModeChange(event: any): void {
    this.mode = event.target.value;
  }

  public async processImage(): Promise<void> {
    if (!this.imageFiles) {
      console.error('No image file selected.');
      return;
    }

    this.imageFiles.forEach(async (file: File) => {
      if (file) {
        let blob: Blob = file;
        // convert HEIC to JPEG if
        if (file.type === 'image/heic') {
          console.log('Converting HEIC to JPEG...');
          const [jpeg, heicData] = await NgxAdvancedImgBitmap.convertHEIC(file, 'image/jpeg');

          blob = jpeg;
          console.log('HEIC data:', heicData);
        }

        // Implement image processing logic here
        const bitmap: NgxAdvancedImgBitmap = new NgxAdvancedImgBitmap(blob, '', 0, 0);
        bitmap.debug = true;

        NgxAdvancedImgBitmap.getImageDataFromBlob(blob).then((data: INgxAdvancedImgBitmapInfo) => {
          if (data.fileSize > this.size) {
            bitmap.load().finally(() => {
              console.log('bitmap loaded with size (B):', bitmap.fileSize);

              // compress the image to a smaller file size
              console.log(`Optimizing ${file.name}...`);
              console.log(
                'Quality:', this.quality,
                'Type:', bitmap.mimeType,
                'Initial Size (B):', bitmap.initialFileSize,
                'Loaded File Size (B):', bitmap.fileSize,
                'Size Limit (B):', this.size,
                'Dimension Limit (pixels):', this.maxDimension,
                'Resize Factor', this.scale / 100,
                'Strict Mode:', !!this.strictMode,
              );

              performance.mark('compression_start');
              bitmap.optimize(+this.quality, bitmap.mimeType, +this.scale / 100, +this.maxDimension, this.size ? +this.size : undefined, this.mode, !!this.strictMode).then((data: INgxAdvancedImgBitmapOptimization) => {
                performance.mark('compression_end');
                performance.measure('Image Compression', 'compression_start', 'compression_end');

                // auto save this for the user
                console.log('[TEST] Saving URL:', data.objectURL, data.exifData);

                performance.mark('save_start');
                bitmap.saveFile(`test_output_${AppComponent.getFileNameWithoutExtension(file)}_q-${this.quality}_m-${this.mode}_s-${this.size}`, data.objectURL, bitmap.mimeType);
                performance.mark('save_end');
                performance.measure('Image Saving', 'save_start', 'save_end');

                const compressionMeasure = performance.getEntriesByName('Image Compression')[0];
                const saveMeasure = performance.getEntriesByName('Image Saving')[0];
                console.log(`${bitmap.mimeType} compression took ${compressionMeasure.duration} ms`);
                console.log(`${bitmap.mimeType} saving took ${saveMeasure.duration} ms`);

                // reset performance
                performance.clearMarks();
                performance.clearMeasures();

                // clean up the bitmap
                bitmap.destroy();
              }); // let the errors bubble up
            });
          } else {
            console.warn('~~~ No compression is needed, your file is already small enough!');
          }
        });
      }
    });
  }

}
