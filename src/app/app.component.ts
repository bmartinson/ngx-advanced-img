import { Component } from '@angular/core';

import {
  INgxAdvancedImgBitmapInfo,
  INgxAdvancedImgBitmapOptimization,
  INgxAdvancedImgHeicConversion,
  NgxAdvancedImgBitmap,
  NgxAdvancedImgCanvasHelper,
  NgxAdvancedImgFallbackDirective,
} from '../../projects/ngx-advanced-img/src/public-api';

@Component({
  selector: 'ngx-advanced-img-lib-app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [NgxAdvancedImgFallbackDirective],
})
export class AppComponent {
  public imageFiles: File[] | null = null;
  public scale = 100;
  public quality = 1;
  public size = 500000; //2097152;
  public maxDimension = 16384;
  public strictMode = false;
  public retainMimeType = false;
  public mode: 'retain-size' | 'retain-quality' | 'prefer-size' | 'prefer-quality' | 'alternating-preference' =
    'prefer-size';
  private worker: Worker | null = null;

  private static getFileNameWithoutExtension(file: File): string {
    const fileName = file.name;
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) return fileName; // No extension found
    return fileName.substring(0, lastDotIndex);
  }

  public onFileChange(event: Event): void {
    const files = (event.target as HTMLInputElement)?.files;
    this.imageFiles = files ? Array.from(files) : null;
  }

  public onScaleChange(event: Event): void {
    this.scale = +(event?.target as HTMLInputElement)?.value;
  }

  public onQualityChange(event: Event): void {
    this.quality = +(event?.target as HTMLInputElement)?.value;
  }

  public onSizeChange(event: Event): void {
    this.size = +(event?.target as HTMLInputElement)?.value;
  }

  public onMaxDimensionChange(event: Event): void {
    this.maxDimension = +(event?.target as HTMLInputElement)?.value;
  }

  public onRetainMimeTypeChange(event: Event): void {
    this.retainMimeType = !!(event?.target as HTMLInputElement)?.checked;
  }

  public onStrictModeChange(event: Event): void {
    this.strictMode = !!(event?.target as HTMLInputElement)?.checked;
  }

  public onModeChange(event: Event): void {
    this.mode = (event?.target as HTMLInputElement)?.value as
      | 'retain-size'
      | 'retain-quality'
      | 'prefer-size'
      | 'prefer-quality'
      | 'alternating-preference';
  }

  public prettyLog(
    message: (string | number | boolean | Event | Error)[],
    level?: 'log' | 'warn' | 'error' | undefined
  ): void {
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
    let defaultMimeType = 'image/webp';
    const supportsWebp = NgxAdvancedImgBitmap.isMimeTypeSupported('image/webp');

    if (!this.retainMimeType && !supportsWebp) {
      this.prettyLog(['image/webp output is not supported by your browser....using image/jpeg instead.'], 'error');

      // switch to use jpeg for fast optimization
      defaultMimeType = 'image/jpeg';
    }

    this.imageFiles.forEach(async (file: File) => {
      if (file) {
        // convert heic to jpeg
        let src: Blob = file;
        if (file.type === 'image/heic') {
          try {
            const result = await this.workerConvert(file, this.retainMimeType ? 'image/jpeg' : defaultMimeType);

            src = result.blob;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (error: any) {
            this.prettyLog(['Unable to convert HEIC with web worker', error], 'error');
          }
        }
        // Implement image processing logic here
        const bitmap: NgxAdvancedImgBitmap = new NgxAdvancedImgBitmap(src, '', 0, 0);
        bitmap.debug = true;

        NgxAdvancedImgBitmap.getImageDataFromBlob(file as Blob)
          .then((unOptimizedData: INgxAdvancedImgBitmapInfo) => {
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
                  'Quality:',
                  String(),
                  'Type:',
                  mimeType,
                  'Initial Size (B):',
                  bitmap.initialFileSize,
                  'Loaded File Size (B):',
                  bitmap.fileSize,
                  'Size Limit (B):',
                  this.size,
                  'Dimension Limit (pixels):',
                  this.maxDimension,
                  'Resize Factor',
                  this.scale / 100,
                  'Strict Mode:',
                  !!this.strictMode,
                ]);

                performance.mark('optimization_start');
                bitmap
                  .optimize(mimeType, +this.quality, +this.scale / 100, +this.maxDimension, {
                    sizeLimit: this.size ? +this.size : undefined,
                    minDimension: 100,
                    minScale: 0.025,
                    minQuality: 0.8,
                    mode: this.mode,
                    strict: !!this.strictMode,
                  })
                  .then((data: INgxAdvancedImgBitmapOptimization) => {
                    performance.mark('optimization_end');
                    performance.measure('Image Optimization', 'optimization_start', 'optimization_end');

                    // auto save this for the user
                    this.prettyLog(['[TEST] Saving URL:', data.blob, data.exifData, unOptimizedData.exifData]);

                    performance.mark('save_start');
                    bitmap.saveFile(
                      `test_output_${AppComponent.getFileNameWithoutExtension(file)}_q-${this.quality}_m-${this.mode}_s-${this.size}`,
                      data.blob,
                      mimeType
                    );
                    performance.mark('save_end');
                    performance.measure('Image Saving', 'save_start', 'save_end');

                    const loadMeasure = performance.getEntriesByName('Image Load')[0];
                    const optimizationMeasure = performance.getEntriesByName('Image Optimization')[0];
                    const saveMeasure = performance.getEntriesByName('Image Saving')[0];
                    this.prettyLog([`Image load took ${loadMeasure.duration} ms`]);
                    this.prettyLog([`${mimeType} optimization took ${optimizationMeasure.duration} ms`]);
                    this.prettyLog([`${mimeType} saving took ${saveMeasure.duration} ms`]);
                    this.prettyLog(['']);
                    this.prettyLog([
                      `At this time, ${NgxAdvancedImgCanvasHelper.getCanvasCount()} canvases have been allocated.`,
                    ]);
                    this.prettyLog(['']);

                    // reset performance
                    performance.clearMarks();
                    performance.clearMeasures();

                    // clean up the bitmap
                    bitmap.destroy();
                  }); // let the errors bubble up
              });
            } else {
              this.prettyLog(['~~~ No optimization is needed, your file is already small enough!'], 'warn');
            }
          })
          .catch(e => {
            this.prettyLog(['Unable to get image data from blob:', e], 'error');
          });
      }
    });
  }

  private workerConvert(file: File, mimeType: string): Promise<INgxAdvancedImgHeicConversion> {
    return new Promise((resolve, reject) => {
      const id = (Math.random() * new Date().getTime()).toString();
      const message = { id, file, mimeType };
      console.log('sending message to worker', import.meta.url);
      const worker = new Worker(new URL('./app.worker', import.meta.url), { type: `module` });
      worker.postMessage(message);

      const listener = (message: MessageEvent) => {
        worker.removeEventListener('message', listener);

        // destroy worker
        worker.terminate();

        if (message.data instanceof Error) {
          reject(message.data);
        } else {
          resolve(message.data);
        }
      };

      worker.addEventListener('message', listener);

      worker.onerror = error => {
        console.log(`Worker error: ${error}`);

        worker.terminate();

        reject(error);
      };
    });
  }
}
