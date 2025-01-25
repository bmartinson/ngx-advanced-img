/* eslint-disable @typescript-eslint/no-explicit-any */
import * as exif from 'exifr';
import mime from 'mime';
import { Observable, Subject } from 'rxjs';

import { NgxAdvancedImgCanvasHelper } from './canvas-helper';
import { NgxAdvancedImgJxon } from './jxon';

import Timeout = NodeJS.Timeout;

export type NgxAdvancedImgResolution = string | '';

/**
 * This interface defines the standard data signature that can represent an asset bitmap entry
 * in raw data format.
 */
export interface INgxAdvancedImgBitmapDataSignature {
  src: string | Blob;
  revision: number;
  resolution: NgxAdvancedImgResolution;
  loaded: boolean;
  size: number;
}

export interface INgxAdvancedImgBitmapOptimization {
  blob: Blob;
  exifData: any;
}

export interface INgxAdvancedImgBitmapInfo {
  fileSize: number;
  exifData: any;
}

export interface INgxAdvancedImgOptimizationOptions {
  sizeLimit?: number | undefined; // the maximum size of the image in bytes, if exceeded, the image will be optimized further
  minDimension?: number | undefined; // minimum dimension we will reduce to during optimization
  minScale?: number | undefined; // minimum scale we will reduce to during optimization
  minQuality?: number | undefined; // minimum quality we will reduce to during optimization
  mode?: 'retain-size' | 'retain-quality' | 'prefer-size' | 'prefer-quality' | 'alternating-preference' | undefined;
  strict?: boolean; // if true, false by default, then the function will throw an error if the size limit cannot be achieved
}

export class NgxAdvancedImgBitmap {
  private static ITERATION_FACTOR = 0.025;
  private static QUALITY_FACTOR = 0.5;
  private static PREDICTION_FACTOR = 0.275; // how much we scale back our quality prediction since the mathematical function is not perfect

  public resolution: NgxAdvancedImgResolution;
  public revision: number;
  public loaded: boolean;
  public image: HTMLImageElement | undefined | null;
  public size: number;
  public debug: boolean; // set to true for console logging
  private _src: string | Blob;
  private _ttl: number; // time to live in seconds after it has been loaded
  private loadedAt: Date | null;
  private expirationClock: Timeout | null;
  private _destroyed: Subject<INgxAdvancedImgBitmapDataSignature> | undefined | null;
  private _objectURL: string | null;
  private _exifData: any;
  private _mimeType: string;
  private _orientation: number;
  private _fileSize: number;
  private _initialFileSize: number;

  /**
   * The source of the image that will be loaded. When setting the source,
   * the rest of the class will be reset, akin to a call to destroy(true).
   */
  public get src(): string | Blob {
    return this._src;
  }

  /**
   * The source of the image that will be loaded. When setting the source,
   * the rest of the class will be reset, akin to a call to destroy(true).
   */
  public set src(value: string | Blob) {
    this.destroy(true);

    this._src = value;
  }

  /**
   * The object URL format of the image that can be used for direct downloading to an end-user's machine.
   */
  public get objectURL(): string {
    return this._objectURL || '';
  }

  /**
   * The exif data associated with the image.
   */
  public get exifData(): object {
    return this._exifData || {};
  }

  /**
   * The mime type for the loaded image.
   */
  public get mimeType(): string {
    return this._mimeType;
  }

  /**
   * The size of the file in bytes.
   */
  public get fileSize(): number {
    return this._fileSize;
  }

  /**
   * The size of the file before it was inflated as part of the bitmap loading process using base64 data.
   */
  public get initialFileSize(): number {
    return this._initialFileSize;
  }

  /**
   * The time to live in seconds after the asset has been loaded, or if changing after it has already been loaded,
   * since the TTL was set. If 0 is given, this asset will live forever.
   */
  public get ttl(): number {
    return this._ttl;
  }

  /**
   * The time to live in seconds after the asset has been loaded, or if changing after it has already been loaded,
   * since the TTL was set. If 0 is given, this asset will live forever.
   */
  public set ttl(value: number) {
    // set the time to live in seconds
    this._ttl = !isNaN(value) && isFinite(value) && +value >= 0 ? value : 0;

    // if we have an expiration clock ticking, clear it
    if (this.expirationClock) {
      clearTimeout(this.expirationClock);
      this.expirationClock = null;
    }

    // start the clock for when to destroy ourselves if we are not 0, infinitely
    if (this.ttl > 0) {
      this.expirationClock = setTimeout(this.onExpired.bind(this), this.ttl * 1000);
    }
  }

  /**
   * Returns the time, in seconds, for which this asset has lived since it was first loaded.
   */
  public get life(): number {
    if (!this.loadedAt || !this._src) {
      return 0;
    }

    // capture the current time
    const currentTime: Date = new Date();

    // return the time since the load time in seconds
    return currentTime.getSeconds() - this.loadedAt.getSeconds();
  }

  /**
   * An observable property that can be used to detect when this asset bitmap has been disposed of.
   */
  public get destroyed(): Observable<INgxAdvancedImgBitmapDataSignature> {
    if (!this._destroyed) {
      this._destroyed = new Subject<INgxAdvancedImgBitmapDataSignature>();
    }

    return this._destroyed.asObservable();
  }

  /**
   * Get the orientation of the image as defined by the exif data
   */
  public get orientation(): number {
    if (!this._orientation) {
      // normalize orientation if not defined
      this._orientation = 1;
    }

    return this._orientation;
  }

  /**
   * Return how many degrees an image should be rotated to normalize the
   * orientation based on the exif data.
   *
   * 1 = Horizontal (normal)
   * 2 = Mirror horizontal
   * 3 = Rotate 180
   * 4 = Mirror vertical
   * 5 = Mirror horizontal and rotate 270 CW
   * 6 = Rotate 90 CW
   * 7 = Mirror horizontal and rotate 90 CW
   * 8 = Rotate 270 CW
   */
  public get normalizedRotation(): number {
    if (navigator.userAgent?.indexOf('Firefox') > -1) {
      // firefox already deals with exif orientation, so don't normalize
      return 0;
    }

    switch (this.orientation) {
      case 3:
      case 4:
        return 180;

      case 5:
      case 6:
        return 270;

      case 7:
      case 8:
        return 90;

      default:
        return 0;
    }
  }

  public constructor(src: string | Blob, resolution: NgxAdvancedImgResolution, revision: number, ttl?: number) {
    this._src = src ? src : '';
    this.resolution = resolution !== null && resolution !== undefined ? resolution : '';
    this.revision = revision ? revision : 0;
    this.loaded = false;
    this.size = 0;
    this.expirationClock = this.loadedAt = null;

    this._ttl = !ttl ? 0 : !isNaN(ttl) && isFinite(ttl) && +ttl >= 0 ? ttl : 0;
    this._destroyed = new Subject<INgxAdvancedImgBitmapDataSignature>();
    this._orientation = 1;
    this._mimeType = 'unknown';
    this._objectURL = '';
    this._fileSize = this._initialFileSize = 0;
    this.debug = false;
  }

  /**
   * Standard function for extracting file information from a Blob.
   *
   * @param data Blob data that can be assessed.
   */
  public static getImageDataFromBlob(data: Blob): Promise<INgxAdvancedImgBitmapInfo> {
    const fileSize: number = data.size;

    return new Promise((resolve: (value: INgxAdvancedImgBitmapInfo) => void, reject: (reason?: any) => void) => {
      // parse the exif data direction while the image content loads
      exif
        .parse(data, true)
        .then((exifData: any) => {
          resolve({
            fileSize,
            exifData,
          });
        })
        .catch((error: any) => {
          reject(error);
        });
    });
  }

  /**
   * Standard function for converting data URI strings into Blob objects.
   */
  public static dataURItoBlob(dataURI: string): Blob {
    // convert base64 to raw binary data held in a string
    // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
    const byteString = atob(dataURI.split(',')[1]);

    // separate out the mime component
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

    // write the bytes of the string to an ArrayBuffer
    const ab = new ArrayBuffer(byteString.length);

    // create a view into the buffer
    const ia = new Uint8Array(ab);

    // set the bytes of the buffer to the correct values
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    // write the ArrayBuffer to a blob, and you're done
    return new Blob([ab], { type: mimeString });
  }

  /**
   * Standard function for detecting mimeType based on buffer data.
   *
   * @param buffer The buffer data to detect the mimeType from.
   * @param blobDataType The blob data type to use as a fallback if the mimeType cannot be detected.
   */
  public static detectMimeType(buffer: Uint8Array, blobDataType: string): string {
    let header = '';

    // gather the hex data for the file header data
    for (const signature of buffer.subarray(0, 4)) {
      header += signature.toString(16);
    }

    // The identifying header for HEICS is offset by 4
    let middle = '';
    for (const signature of buffer.subarray(4, 12)) {
      middle += signature.toString(16);
    }

    if (middle === '6674797068656963') {
      header = middle;
    }

    // WEBP files require bytes 9-12 to differentiate
    // between other RIFFs like .wav or .avi
    if (header === '52494646') {
      for (const signature of buffer.subarray(8, 12)) {
        header += signature.toString(16);
      }
    }

    // convert the header to an appropriate mime type
    switch (header) {
      case '89504e47':
        return 'image/png';

      case '47494638':
        return 'image/gif';

      case '424d0000':
        return 'image/bmp';

      case '5249464657454250':
        return 'image/webp';

      case 'ffd8ffe0':
      case 'ffd8ffe1':
      case 'ffd8ffe2':
      case 'ffd8ffe3':
      case 'ffd8ffe8':
        return 'image/jpeg';

      case '6674797068656963':
        return 'image/heic';

      case '75ab5a6a':
      case '25504446':
      case '45e71e8a':
        return 'application/pdf';

      default:
        return blobDataType;
    }
  }

  /**
   * Helper function to see if webp output is supported.
   *
   * @param mimeType The mimeType to check for support.
   */
  public static isMimeTypeSupported(mimeType: string): boolean {
    const canvas = NgxAdvancedImgCanvasHelper.requestCanvas();
    let isMimeTypeSupported = false;

    if (canvas?.getContext && canvas.getContext('2d')) {
      isMimeTypeSupported = canvas.toDataURL(mimeType).indexOf(`data:${mimeType}`) === 0;
      NgxAdvancedImgCanvasHelper.returnCanvas(canvas);
    }

    return isMimeTypeSupported;
  }

  /*
   * Helper function to get the image data from a canvas
   */
  private static canvasToBlobPromise(
    canvas: HTMLCanvasElement,
    mimeType = 'image/png',
    quality = 1.0
  ): Promise<Blob | null> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        },
        mimeType,
        quality
      );
    });
  }

  /**
   * Destroys the current asset bitmap object and frees all memory in use.
   *
   * @param silent Set to true if you would like to destroy everything but the destroyed observable so that the object will be reused.
   */
  public destroy(silent?: boolean): void {
    // announce the disposal of this
    if (!silent) {
      this._destroyed?.next({
        src: this._src,
        revision: this.revision,
        resolution: this.resolution,
        loaded: this.loaded,
        size: this.size,
      });
    }

    const domURL: any = URL || webkitURL || window.URL;

    this.ttl = 0;
    this.loaded = false;
    this.loadedAt = null;
    if (this.image) {
      this.image.onload = null;
      this.image.onerror = null;

      try {
        domURL?.revokeObjectURL(this.image.src);
      } catch (error) {
        console.error('An error occurred while cleaning up resources.', error);
      }
    }
    this.image = null;
    this.size = 0;
    this._initialFileSize = 0;
    this._exifData = null;

    if (this.expirationClock) {
      clearTimeout(this.expirationClock);
    }

    if (!silent) {
      this._destroyed?.unsubscribe();
      this._destroyed = null;
    }

    // clear any existing object urls as necessary
    if (this._objectURL) {
      try {
        domURL?.revokeObjectURL(this._objectURL);
        this._objectURL = null;
      } catch (error) {
        console.error('An error occurred while cleaning up resources.', error);
      }
    }
  }

  /**
   * Attempts to load the image. When successful, it will mark the class as loaded and resolve the returned promise.
   *
   * @param anonymous Whether or not to load anonymously or not.
   * @param allowXMLLoading Drives whether XML serialization of image/svg+xml objects can be performed. By default, this feature is on, but some browsers do not support it.
   * @param fullQualityLoad = If set to true, the image will be loaded with full encoding quality for any canvas output.
   */
  public async load(anonymous = true, allowXMLLoading = true, fullQualityLoad = false): Promise<NgxAdvancedImgBitmap> {
    // if no valid source, then reject the load
    if (!this._src) {
      return Promise.reject(new Error('No valid source provided'));
    }

    if (typeof this._src === 'string') {
      this._src = NgxAdvancedImgBitmap.dataURItoBlob(this._src);
    }

    const blobData: Blob = this._src;

    this.destroy(true);

    // re-init exif data for use
    this._exifData = {};

    return new Promise((resolve, reject) => {
      let url: string;

      this.image = new Image();
      this.image.loading = 'eager';

      if (anonymous) {
        this.image.crossOrigin = 'anonymous';
      }

      // throw error if image has been destroyed
      if (!this.image) {
        reject(this);
      }

      // store the blob's file size
      this._initialFileSize = blobData.size;

      // if we have an expiration clock ticking, clear it
      if (this.expirationClock) {
        clearTimeout(this.expirationClock);
      }

      // start the clock for when to destroy ourselves if we are not 0, infinitely
      if (this.ttl > 0) {
        this.expirationClock = setTimeout(this.onExpired.bind(this), this.ttl * 1000);
      }

      let fileReader: FileReader | null = new FileReader();

      // when the file reader successfully loads array buffers, process them
      fileReader.onload = async (event: Event) => {
        // if image has been destroyed error out
        if (!this.image) {
          onerror();
          return;
        }

        const buffer: Uint8Array = new Uint8Array((event.target as any).result);
        this._mimeType = NgxAdvancedImgBitmap.detectMimeType(buffer, blobData.type);

        // wait for image load

        // image load success handler
        this.image.onload = async () => {
          if (!this.image) {
            // throw error if image has been destroyed
            return;
          }

          const domURL: any = URL || webkitURL || window.URL;

          if (this.mimeType !== 'image/svg+xml' || !allowXMLLoading) {
            // if our browser doesn't support the URL implementation, fail the load
            if (!domURL || !domURL.createObjectURL) {
              onerror();

              return;
            }

            // create a canvas to paint to
            const canvas: HTMLCanvasElement = NgxAdvancedImgCanvasHelper.requestCanvas();

            // configure the dimensions of the canvas
            canvas.width = this.image.width;
            canvas.height = this.image.height;

            // acquire the rendering context
            const ctx: CanvasRenderingContext2D | null = canvas?.getContext('2d', {
              desynchronized: false,
              willReadFrequently: true,
            });

            // if the context cannot be acquired, we should quit the operation
            if (!ctx) {
              onerror();

              return;
            }

            // Enable image smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.drawImage(this.image, 0, 0);

            // if we haven't loaded anonymously, we'll taint the canvas and crash the application
            const dataUri: string = anonymous ? canvas.toDataURL(this._mimeType, fullQualityLoad ? 1 : undefined) : '';

            if (typeof this._src === 'string') {
              // store the exif data
              exif.parse(blobData, true).then((exifData: any) => {
                this._exifData = exifData || {};
              });
            }

            // if we got the bitmap data, create the link to download and invoke it
            if (dataUri) {
              // clear any existing object urls as necessary
              if (this._objectURL) {
                try {
                  domURL.revokeObjectURL(this._objectURL);
                } catch (error) {
                  console.error('An error occurred while cleaning up resources.', error);
                }
              }

              // get the bitmap data in blob format
              this._objectURL = domURL.createObjectURL(NgxAdvancedImgBitmap.dataURItoBlob(dataUri));
            }

            // clean up the canvas
            if (canvas) {
              NgxAdvancedImgCanvasHelper.returnCanvas(canvas);
            }

            this.loaded = true;
            this.size = this.image.naturalWidth * this.image.naturalHeight;

            const head = `data:${this._mimeType};base64,`;
            this._fileSize = Math.round(atob(dataUri.substring(head.length)).length);

            // track the time at which this asset was first asked to load
            this.loadedAt = new Date();

            // if we have an expiration clock ticking, clear it
            if (this.expirationClock) {
              clearTimeout(this.expirationClock);
            }

            await this.adjustForExifOrientation();

            // if we loaded a non-svg, then we are done loading
            resolve(this);
          } else {
            const client: XMLHttpRequest = new XMLHttpRequest();
            client.open('GET', this.image.src);
            client.onreadystatechange = () => {
              // if the document ready state is finished and ready
              if (client.readyState === 4) {
                let svg: any = new NgxAdvancedImgJxon().stringToXml(client.responseText).getElementsByTagName('svg')[0];

                // 'viewBox' is now a string, parse the string for the viewBox values - can be separated by whitespace and/or a comma
                const viewBox: string[] = svg.getAttribute('viewBox').split(/[ ,]/);

                // make sure the viewBox is set
                if (viewBox.length !== 4) {
                  onerror();

                  return;
                }

                // get the width and height from the viewBox
                const svgWidth: number = +viewBox[2];
                const svgHeight: number = +viewBox[3];

                // viewBox width and height is considered to be a required attribute, so check its existence and validity
                if (
                  !svgWidth ||
                  !svgHeight ||
                  isNaN(svgWidth) ||
                  isNaN(svgHeight) ||
                  !isFinite(svgWidth) ||
                  !isFinite(svgHeight)
                ) {
                  onerror();

                  return;
                }

                // set the width and height from the view box definition
                svg.setAttribute('width', svgWidth);
                svg.setAttribute('height', svgHeight);

                // never preserve aspect ratio so the entire image fills the element boundaries
                svg.setAttribute('preserveAspectRatio', 'none');

                const svgXML: string = new NgxAdvancedImgJxon().xmlToString(svg);
                svg = new Blob([svgXML], { type: this.mimeType + ';charset=utf-8' });

                // if our browser doesn't support the URL implementation, fail the load
                if (!this.image || !domURL || !domURL.createObjectURL) {
                  onerror();

                  return;
                }

                this.image.onload = async () => {
                  this.loaded = true;
                  this.size = svgWidth * svgHeight;

                  // track the time at which this asset was first asked to load
                  this.loadedAt = new Date();

                  // if we have an expiration clock ticking, clear it
                  if (this.expirationClock) {
                    clearTimeout(this.expirationClock);
                  }

                  await this.adjustForExifOrientation();

                  // the image has successfully loaded
                  resolve(this);
                };

                // clear any existing object urls as necessary
                if (this._objectURL) {
                  try {
                    domURL.revokeObjectURL(this._objectURL);
                  } catch (error) {
                    console.error(error);
                  }
                }

                this.image.loading = 'eager';
                this.image.src = this._objectURL = domURL.createObjectURL(svg);
              }
            };

            // issue the file load
            client.send();
          }
        };

        // image load failure handler
        this.image.onerror = onerror;

        // calculate a unique revision signature to ensure we pull the image with the correct CORS headers
        let rev = '';
        if (this.revision >= 0 && typeof this._src === 'string' && this._src.indexOf('base64') === -1) {
          if (this._src.indexOf('?') >= 0) {
            rev = '&rev=' + this.revision;
          } else {
            rev = '?rev=' + this.revision;
          }
        }

        // create a properly configured url despite protocol - make sure any resolution data is cleared
        if (typeof this._src === 'string') {
          if (this.resolution === '') {
            // distinct loads should take the direct source url
            url = this._src;
          } else {
            // clear resolution information if provided for situations where we intend to use some resolution
            url = this._src.replace(/_(.*)/g, '');
          }

          // append resolution and revision information for all scenarios if provided
          url += this.resolution + rev;

          // load the image
          this.image.src = url;
        } else {
          this.image.src = URL.createObjectURL(this._src);

          // store the original blob file size
          this._initialFileSize = this._src.size;

          // parse the exif data direction while the image content loads
          exif.parse(this._src, true).then((exifData: any) => {
            this._exifData = exifData || {};
          });
        }

        if (fileReader) {
          fileReader.onload = null;
          fileReader.onerror = null;
          fileReader = null;
        }
      };

      // if we fail to load the file header data, throw an error to be captured by the promise catch
      fileReader.onerror = () => {
        if (fileReader) {
          fileReader.onload = null;
          fileReader.onerror = null;
          fileReader = null;
        }

        throw new Error("Couldn't read file header for download");
      };

      // load the file data array buffer once we have the blob
      fileReader.readAsArrayBuffer(blobData);

      // image loading error handler
      const onerror: () => Promise<void> = async () => {
        console.error('image load error');
        this.loaded = false;
        this.size = 0;

        // ensure that no expiration clock is running if we failed
        if (this.expirationClock) {
          clearTimeout(this.expirationClock);
        }

        reject(this);
      };
    });
  }

  /**
   * Invokes a save of this image to the user's disk assuming that it has already finished loading and the image
   * is in tact. It relies on the load procedures correctly setting the object url for the load that we can use
   * to invoke the download.
   *
   * @param fileName The name of the file to save.
   * @param objectURL The object URL to use for the download, if not provided, the original image url will be used.
   */
  public saveFile(fileName: string, blob?: Blob, mimeType?: string): void {
    if (!this.loaded || !this.image) {
      return;
    }

    if (!mimeType) {
      mimeType = this.mimeType;
    }

    const domURL: any = URL || webkitURL || window.URL;

    // if our browser doesn't support the URL implementation, then quit
    if (!domURL || !domURL.createObjectURL) {
      return;
    }

    const extension: string | null = mime.getExtension(mimeType);
    let url: string = this.image.src;

    // If a Blob is provided, create an object URL for it
    if (blob) {
      url = domURL.createObjectURL(blob);
    } else if (this.objectURL) {
      // Otherwise, use the existing object URL if one is present
      url = this.objectURL;
    }

    // create a link and set it into the DOM for programmatic use
    let link: HTMLAnchorElement | null = document.createElement('a');
    link.setAttribute('type', 'hidden');
    link.setAttribute('href', url);
    link.setAttribute('target', '_blank');
    link.download = typeof extension === 'string' && !!extension ? `${fileName}.${extension}` : fileName;
    document.body.appendChild(link);

    // invoke the link click to start the download
    link.click();

    // clean up the download operation
    domURL.revokeObjectURL(url);
    document.body.removeChild(link);

    link = null;
  }

  /**
   * If the image is loaded, this function will optimize the image to the
   * desired quality and type and return a data url of bitmap information.
   *
   * @param type The type of file output we would like to generate.
   * @param quality The quality of the image optimization.
   * @param resizeFactor The scaling factor to reduce the size of the image.
   * @param maxDimension If provided, the maximum pixels allowed for x/y dimension in the size of the image. Invokes a resize.
   * @param options The optimization options to use when we want to optimize the image to a specified byte size.
   */
  public async optimize(
    type: string,
    quality: number,
    resizeFactor = 1,
    maxDimension?: number | undefined, // the image will be resized to fit within this max dimension before any further optimization
    options?: INgxAdvancedImgOptimizationOptions
  ): Promise<INgxAdvancedImgBitmapOptimization> {
    return this._optimize(type, quality, resizeFactor, maxDimension, options, undefined).catch((error: any) => {
      return Promise.reject(error);
    });
  }

  /**
   * If the image is loaded, this function will optimize the image to the
   * desired quality and type and return a data url of bitmap information.
   *
   * This is the internal logic to power optimization so that we may recursively
   * attempt optimizations in balanced and hardcore modes by tracking last op
   * without showing lastOp for the user of this function.
   *
   * @param type The type of file output we would like to generate.
   * @param quality The quality of the image optimization.
   * @param resizeFactor The scaling factor to reduce the size of the image.
   * @param maxDimension If provided, the maximum pixels allowed for x/y dimension in the size of the image. Invokes a resize.
   * @param options The optimization options to use when we want to optimize the image to a specified byte size.
   * @param lastOp The last operation that was performed in the optimization process.
   */
  private async _optimize(
    type: string,
    quality: number,
    resizeFactor = 1,
    maxDimension?: number | undefined,
    options?: INgxAdvancedImgOptimizationOptions,
    lastOp?: 'quality' | 'scale' | undefined,
    lastSize?: number
  ): Promise<INgxAdvancedImgBitmapOptimization> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve: (value: INgxAdvancedImgBitmapOptimization) => void, reject) => {
      try {
        if (!this.image || !this.loaded) {
          throw new Error('Image not loaded');
        }

        if (quality < 0 || quality > 1) {
          throw new Error('The requested image optimization cannot be achieved');
        }

        // draw the image to the canvas
        const canvas: HTMLCanvasElement = NgxAdvancedImgCanvasHelper.requestCanvas();
        let width: number = (canvas.width = this.image.width * resizeFactor);
        let height: number = (canvas.height = this.image.height * resizeFactor);
        let minThresholdReached = false;

        // cap the size of the canvas in accordance with te minDimension constraints for optimization
        if (
          resizeFactor < 1 &&
          typeof options?.minDimension === 'number' &&
          !isNaN(options?.minDimension) &&
          isFinite(options?.minDimension) &&
          options?.minDimension > 0 &&
          (canvas.width < options?.minDimension || canvas.height < options?.minDimension)
        ) {
          let minDimensionAspectRatio = canvas.width / canvas.height;

          if (canvas.width > canvas.height) {
            height = canvas.height = options?.minDimension;
            width = canvas.width = options?.minDimension * minDimensionAspectRatio;
          } else {
            minDimensionAspectRatio = canvas.height / canvas.width;
            width = canvas.width = options?.minDimension;
            height = canvas.height = options?.minDimension * minDimensionAspectRatio;
          }

          minThresholdReached = true;
        }

        if (
          typeof options?.minQuality === 'number' &&
          !isNaN(options?.minQuality) &&
          isFinite(options?.minQuality) &&
          options?.minQuality >= 0 &&
          quality < options?.minQuality
        ) {
          minThresholdReached = true;
        }

        if (
          typeof options?.minScale === 'number' &&
          !isNaN(options?.minScale) &&
          isFinite(options?.minScale) &&
          options?.minScale >= 0 &&
          resizeFactor < options?.minScale
        ) {
          minThresholdReached = true;
        }

        // scale the image down based on the max allowed pixel dimension
        if (typeof maxDimension === 'number' && !isNaN(maxDimension) && isFinite(maxDimension) && maxDimension > 0) {
          if (canvas.width > maxDimension) {
            height = canvas.height = canvas.height * (maxDimension / canvas.width);
            width = canvas.width = maxDimension;
            resizeFactor = maxDimension / this.image.width;
          }

          if (canvas.height > maxDimension) {
            width = canvas.width = canvas.width * (maxDimension / canvas.height);
            height = canvas.height = maxDimension;
            resizeFactor = maxDimension / this.image.height;
          }
        }

        const ctx: CanvasRenderingContext2D | null = canvas?.getContext('2d', {
          desynchronized: false,
          willReadFrequently: true,
        });

        ctx?.drawImage(this.image, 0, 0, canvas.width, canvas.height);

        // if we haven't loaded anonymously, we'll taint the canvas and crash the application
        const blob = await NgxAdvancedImgBitmap.canvasToBlobPromise(canvas, type, quality);

        // clean up the canvas
        if (canvas) {
          NgxAdvancedImgCanvasHelper.returnCanvas(canvas);
        }

        if (!blob) {
          throw new Error('An error occurred while drawing to the canvas');
        }

        if (
          typeof options?.sizeLimit === 'number' &&
          !isNaN(options?.sizeLimit) &&
          isFinite(options?.sizeLimit) &&
          options?.sizeLimit > 0
        ) {
          const fileSize: number = Math.round(blob.size);

          if (
            fileSize > options?.sizeLimit &&
            (!lastSize || (lastSize && Math.ceil(fileSize) <= Math.ceil(lastSize))) // consider rounding errors
          ) {
            if (resizeFactor === undefined) {
              // if the resize factor wasn't supplied set to 1
              resizeFactor = 1;
            }

            if (resizeFactor <= 0) {
              throw new Error('Invalid resize factor reached (<= 0)');
            }

            let qualityFloor = 0.025;
            let scaleFloor = 0.025;
            let preferredOp: 'prefer-size' | 'prefer-quality';

            // Ensure that minQuality is adhered
            if (options?.minQuality) {
              qualityFloor = options?.minQuality;
              qualityFloor = qualityFloor < 0 ? 0 : qualityFloor > 1 ? 1 : qualityFloor;
            }

            // Ensure that minScale is adhered
            if (options?.minScale) {
              scaleFloor = options?.minScale;
              scaleFloor = scaleFloor < 0 ? 0 : scaleFloor > 1 ? 1 : scaleFloor;
            }

            switch (options?.mode) {
              case 'alternating-preference':
                if (lastOp === 'quality') {
                  preferredOp = 'prefer-size';
                  lastOp = 'scale';
                } else {
                  preferredOp = 'prefer-quality';
                  lastOp = 'quality';
                }
                break;

              case 'retain-size':
                scaleFloor = 1;

                preferredOp = 'prefer-quality';
                lastOp = 'quality';

                break;

              case 'retain-quality':
                qualityFloor = 1;

                preferredOp = 'prefer-size';
                lastOp = 'scale';
                break;

              case 'prefer-quality':
                preferredOp = 'prefer-quality';
                lastOp = 'scale';

                break;

              case 'prefer-size':
              default:
                preferredOp = 'prefer-size';
                lastOp = 'quality';
                break;
            }

            /**
             * perform the optimization based on the preferred operation
             */

            switch (preferredOp) {
              case 'prefer-quality':
                // base case if we are at our bottom quality and resize factor, resolve
                if (
                  (!options?.strict && quality <= qualityFloor && resizeFactor <= scaleFloor) ||
                  minThresholdReached
                ) {
                  const exifData: any = JSON.parse(JSON.stringify(this.exifData));

                  exifData['ExifImageWidth'] = width;
                  exifData['ExifImageHeight'] = height;

                  resolve({
                    blob,
                    exifData,
                  } as INgxAdvancedImgBitmapOptimization);

                  return;
                }

                if (resizeFactor > scaleFloor) {
                  if (options?.sizeLimit) {
                    const oldResizeFactor: number = resizeFactor;
                    const newDims: { width: number; height: number } = this.estimateNewDimensions(
                      fileSize,
                      options?.sizeLimit,
                      width,
                      height
                    );

                    if (width > height) {
                      resizeFactor = resizeFactor - (1 - newDims.width / width);
                    } else {
                      resizeFactor = resizeFactor - (1 - newDims.height / height);
                    }

                    if (resizeFactor > oldResizeFactor) {
                      resizeFactor = resizeFactor - NgxAdvancedImgBitmap.ITERATION_FACTOR;
                    }
                  }

                  if (resizeFactor < scaleFloor) {
                    // keep it within a given scaling factor
                    resizeFactor = scaleFloor;
                  }

                  // if the quality is too high, reduce it and try again
                  this._optimize(type, quality, resizeFactor, maxDimension, options, lastOp, fileSize).then(
                    (optimization: INgxAdvancedImgBitmapOptimization) => resolve(optimization)
                  );

                  return;
                }

                // we've reduced scale, let's reduce image size
                if (quality < qualityFloor) {
                  if (options?.strict) {
                    throw new Error('The requested image optimization cannot be achieved');
                  }

                  // keep it within a given quality floor
                  quality = qualityFloor;
                }

                quality =
                  quality -
                  ((options?.sizeLimit
                    ? (fileSize / options?.sizeLimit) * NgxAdvancedImgBitmap.PREDICTION_FACTOR
                    : NgxAdvancedImgBitmap.QUALITY_FACTOR) /
                    (options?.sizeLimit / fileSize)) *
                    NgxAdvancedImgBitmap.ITERATION_FACTOR;

                this._optimize(type, quality, resizeFactor, maxDimension, options, lastOp, fileSize).then(
                  (optimization: INgxAdvancedImgBitmapOptimization) => resolve(optimization)
                );

                return;

              case 'prefer-size':
                // base case if we are at our bottom quality and resize factor, resolve
                if (
                  (!options?.strict && quality <= qualityFloor && resizeFactor <= scaleFloor) ||
                  minThresholdReached
                ) {
                  const exifData: any = JSON.parse(JSON.stringify(this.exifData));

                  exifData['ExifImageWidth'] = width;
                  exifData['ExifImageHeight'] = height;

                  return;
                }

                if (quality > qualityFloor) {
                  quality =
                    quality -
                    ((options?.sizeLimit
                      ? (fileSize / options?.sizeLimit) * NgxAdvancedImgBitmap.PREDICTION_FACTOR
                      : NgxAdvancedImgBitmap.QUALITY_FACTOR) /
                      (options?.sizeLimit / fileSize)) *
                      NgxAdvancedImgBitmap.ITERATION_FACTOR;

                  if (quality < qualityFloor) {
                    // keep it within a given quality floor
                    quality = qualityFloor;
                  }

                  // if the quality is too high, reduce it and try again
                  this._optimize(type, quality, resizeFactor, maxDimension, options, lastOp, fileSize).then(
                    (optimization: INgxAdvancedImgBitmapOptimization) => resolve(optimization)
                  );

                  return;
                }

                // we've reduced quality, let's reduce image size
                if (options?.sizeLimit) {
                  const oldResizeFactor: number = resizeFactor;
                  const newDims: { width: number; height: number } = this.estimateNewDimensions(
                    fileSize,
                    options?.sizeLimit,
                    width,
                    height
                  );

                  if (width > height) {
                    resizeFactor = resizeFactor - (1 - newDims.width / width);
                  } else {
                    resizeFactor = resizeFactor - (1 - newDims.height / height);
                  }

                  if (resizeFactor > oldResizeFactor) {
                    resizeFactor = resizeFactor - NgxAdvancedImgBitmap.ITERATION_FACTOR;
                  }
                }

                if (resizeFactor < scaleFloor) {
                  if (options?.strict) {
                    throw new Error('The requested image optimization cannot be achieved');
                  }

                  // keep it within a given scaling factor
                  resizeFactor = scaleFloor;
                }

                this._optimize(type, quality, resizeFactor, maxDimension, options, lastOp).then(
                  (optimization: INgxAdvancedImgBitmapOptimization) => resolve(optimization)
                );

                return;
            }
          }
        }

        const exifData: any = JSON.parse(JSON.stringify(this.exifData));

        exifData['ExifImageWidth'] = width;
        exifData['ExifImageHeight'] = height;

        resolve({
          blob,
          exifData,
        } as INgxAdvancedImgBitmapOptimization);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Estimates the new dimensions to use for scaling determinations.
   *
   * @param fileSize The current file size of the calculated reduced image.
   * @param targetSize The target file size to reduce the image to.
   * @param width The current width of the file.
   * @param height The current height of the file.
   */
  private estimateNewDimensions(
    fileSize: number,
    targetSize: number,
    width: number,
    height: number
  ): { width: number; height: number } {
    const bytesToGo: number = fileSize - targetSize;
    const bytesPerPixel: number = fileSize / (width * height);
    const pixelReduction: number = bytesToGo / bytesPerPixel;
    let newWidth: number = width;
    let newHeight: number = height;
    let foundReduction = false;

    while (!foundReduction) {
      if (width < height) {
        newHeight = newHeight * ((newWidth - 1) / newWidth);
        newWidth--;
      } else {
        newWidth = newWidth * ((newHeight - 1) / newHeight);
        newHeight--;
      }

      if (width * height - newWidth * newHeight >= pixelReduction) {
        foundReduction = true;
      }
    }

    return {
      width: newWidth,
      height: newHeight,
    };
  }

  /**
   * Helper function that adjusts the image based on any exif data indicating
   * a different orientation be performed.
   */
  protected async adjustForExifOrientation(): Promise<void> {
    if (!this.image) {
      return Promise.reject(new Error('Image not loaded'));
    }

    try {
      this._orientation = (await exif.orientation(this.image)) || 1;
    } catch (error) {
      // assume normal orientation if none can be found based on exif info
      this._orientation = 1;

      console.error('An error occurred while reading exif orientation data.', error);
    }

    if (this._orientation != null) {
      // assume normal orientation if none can be found based on exif info
      this._orientation = 1;
    }

    return Promise.resolve();
  }

  /**
   * Event handler for when expiration clocks are complete and we must dispose of ourselves.
   */
  protected onExpired(): void {
    // only destroy if we had been loaded, otherwise let the loading pathways dispose of this bitmap
    if (this.loaded) {
      this.destroy();
    }

    // the expiration clock is now complete
    this.expirationClock = null;
  }
}
