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
  public retainMimeType: boolean = false;
  public mode: 'retain-size' | 'retain-quality' | 'prefer-size' | 'prefer-quality' | 'alternating-preference' = 'prefer-size';

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

  public onRetainMimeTypeChange(event: any): void {
    this.retainMimeType = !!event.target.checked;
  }

  public onStrictModeChange(event: any): void {
    this.strictMode = !!event.target.checked;
  }

  public onModeChange(event: any): void {
    this.mode = event.target.value;
  }

  public prettyLog(message: any[], level?: 'log' | 'warn' | 'error' | undefined): void {
    if (!level) {
      level = 'log';
    }

    let style = '';

    switch (level) {
      case 'log':
        console.log(...message);
        break;
      case 'warn':
        console.warn(...message);
        style = ` style='background-color:rgba(234, 239, 44, 0.5)`;
        break;
      case 'error':
        console.error(...message);
        style = ` style='background-color:rgba(255, 0, 0, 0.5)`;
        break;
    }

    const logElement = document.getElementById('log');
    if (logElement) {
      logElement.innerHTML += `<span${style}>` + message.join(' ') + `</span><br>`;
    }
  }

  public processImage(): void {
    if (!this.imageFiles) {
      this.prettyLog(['No image file selected.'], 'error');
      return;
    }

    // if not retaining mime type, let's use webp by default
    let defaultMimeType = "image/webp";

    if (!this.retainMimeType && !NgxAdvancedImgBitmap.isMimeTypeSupported('image/webp')) {
      this.prettyLog(['image/webp output is not supported by your browser....using image/jpeg instead.'], 'error');

      // switch to use jpeg for fast optimization
      defaultMimeType = "image/jpeg";
    }

    this.imageFiles.forEach((file: File) => {
      if (file) {
        // Implement image processing logic here
        const bitmap: NgxAdvancedImgBitmap = new NgxAdvancedImgBitmap(file, '', 0, 0);
        bitmap.debug = true;

        NgxAdvancedImgBitmap.getImageDataFromBlob(file as Blob).then((unOptimizedData: INgxAdvancedImgBitmapInfo) => {
          if (unOptimizedData.fileSize > this.size) {
            performance.mark('load_start');
            bitmap.load().finally(() => {
              const mimeType: string = this.retainMimeType ? bitmap.mimeType : defaultMimeType;

              performance.mark('load_end');
              performance.measure('Image Load', 'load_start', 'load_end');

              this.prettyLog(['bitmap loaded with size (B):', bitmap.fileSize]);

              // compress the image to a smaller file size
              this.prettyLog([`Optimizing ${file.name}...`]);
              this.prettyLog([
                'Quality:', this.quality,
                'Type:', mimeType,
                'Initial Size (B):', bitmap.initialFileSize,
                'Loaded File Size (B):', bitmap.fileSize,
                'Size Limit (B):', this.size,
                'Dimension Limit (pixels):', this.maxDimension,
                'Resize Factor', this.scale / 100,
                'Strict Mode:', !!this.strictMode,
              ]);

              performance.mark('optimization_start');
              bitmap.optimize(mimeType, +this.quality, +this.scale / 100, +this.maxDimension, {
                sizeLimit: this.size ? +this.size : undefined,
                minDimension: 100,
                minScale: 0.025,
                minQuality: 0.8,
                mode: this.mode,
                strict: !!this.strictMode
              }).then((data: INgxAdvancedImgBitmapOptimization) => {
                performance.mark('optimization_end');
                performance.measure('Image Optimization', 'optimization_start', 'optimization_end');

                // auto save this for the user
                this.prettyLog(['[TEST] Saving URL:', data.objectURL, data.exifData, unOptimizedData.exifData]);

                performance.mark('save_start');
                bitmap.saveFile(`test_output_${AppComponent.getFileNameWithoutExtension(file)} _q - ${this.quality} _m - ${this.mode} _s - ${this.size} `, data.objectURL, mimeType);
                performance.mark('save_end');
                performance.measure('Image Saving', 'save_start', 'save_end');

                const loadMeasure = performance.getEntriesByName('Image Load')[0];
                const optimizationMeasure = performance.getEntriesByName('Image Optimization')[0];
                const saveMeasure = performance.getEntriesByName('Image Saving')[0];
                this.prettyLog([`Image load took ${loadMeasure.duration} ms`]);
                this.prettyLog([`${mimeType} optimization took ${optimizationMeasure.duration} ms`]);
                this.prettyLog([`${mimeType} saving took ${saveMeasure.duration} ms`]);
                this.prettyLog(['']);

                // reset performance
                performance.clearMarks();
                performance.clearMeasures();

                URL.revokeObjectURL(data.objectURL);

                // clean up the bitmap
                bitmap.destroy();
              }); // let the errors bubble up
            });
          } else {
            this.prettyLog(['~~~ No optimization is needed, your file is already small enough!'], 'warn');
          }
        }).catch((e) => {
          this.prettyLog(['Unable to get image data from blob:', e], 'error');
        });
      }
    });
  }

}