import * as exif from 'exifr';
import mime from 'mime';
import heic2any from 'heic2any';
import { Observable, Subject } from 'rxjs';

import Timeout = NodeJS.Timeout;
import { NgxAdvancedImgJxon } from './jxon';

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
  objectURL: any;
  exifData: any;
}

export interface INgxAdvancedImgBitmapInfo {
  fileSize: number;
  exifData: any;
}

export class NgxAdvancedImgBitmap {

  private static ITERATION_FACTOR = 0.025;
  private static QUALITY_FACTOR = 0.5;

  public resolution: NgxAdvancedImgResolution;
  public src: string | Blob;
  public revision: number;
  public loaded: boolean;
  public image: HTMLImageElement | undefined;
  public size: number;
  public debug: boolean; // set to true for console logging
  private _ttl: number;	// time to live in seconds after it has been loaded
  private loadedAt: Date | null;
  private expirationClock: Timeout | null;
  private _destroyed: Subject<INgxAdvancedImgBitmapDataSignature> | undefined;
  private _objectURL: string;
  private _exifData: any;
  private _mimeType: string;
  private _orientation: number;
  private _fileSize: number;
  private _initialFileSize: number;

  /**
   * The object URL format of the image that can be used for direct downloading to an end-user's machine.
   */
  public get objectURL(): string {
    return this._objectURL;
  }

  /**
   * The exif data associated with the image.
   */
  public get exifData(): any {
    return this._exifData;
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
    this._ttl = (!isNaN(value) && isFinite(value) && +value >= 0) ? value : 0;

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
    if (!this.loadedAt || !this.src) {
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

  public constructor(
    src: string | Blob,
    resolution: NgxAdvancedImgResolution,
    revision: number,
    ttl?: number,
  ) {
    this.src = (!!src) ? src : '';
    this.resolution = (resolution !== null && resolution !== undefined) ? resolution : '';
    this.revision = (!!revision) ? revision : 0;
    this.loaded = false;
    this.size = 0;
    this.expirationClock = this.loadedAt = null;

    this._ttl = !ttl ? 0 : (!isNaN(ttl) && isFinite(ttl) && +ttl >= 0) ? ttl : 0;
    this._destroyed = new Subject<INgxAdvancedImgBitmapDataSignature>();
    this._orientation = 1;
    this._mimeType = 'unknown';
    this._objectURL = '';
    this._fileSize = this._initialFileSize = 0;
    this.debug = false;
  }

  /**
   * Standard function to convert a HEIC image to a different format for further processing.
   *
   * @param heic The HEIC file to convert.
   * @param format The format to convert the HEIC file to.
   */
  private static convertHEIC(blob: Blob, format: 'image/jpeg' | 'image/png'): Promise<Blob> {
    return heic2any({
      blob: blob,      // Input HEIC File object
      toType: format, // Desired output format
    }).then((convertedBlob: Blob | Blob[]) => {
      // use first image if HEIC file contains multiple images
      if (Array.isArray(convertedBlob)) {
        convertedBlob = convertedBlob[0];
      }

      return convertedBlob;
    }).catch((error: any) => {
      console.error('Error during HEIC to JPEG conversion:', error);
      return Promise.reject(error);
    });
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
      exif.parse(data, true).then((exifData: any) => {
        resolve({
          fileSize,
          exifData,
        });
      }).catch((error: any) => {
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
   * @returns True if the canvas implementation supports webp output.
   */
  public static isWebPSupported(): boolean {
    const canvas: HTMLCanvasElement = document.createElement('canvas');
    if (!!(canvas.getContext && canvas.getContext('2d'))) {
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }
    return false;
  }

  /**
   * Destroys the current asset bitmap object and frees all memory in use.
   */
  public destroy(): void {
    // announce the disposal of this
    this._destroyed?.next({
      src: this.src,
      revision: this.revision,
      resolution: this.resolution,
      loaded: this.loaded,
      size: this.size,
    });

    this.ttl = 0;
    this.loaded = false;
    this.loadedAt = null;
    if (this.image) {
      this.image.onload = null;
      this.image.onerror = null;
    }
    this.image = undefined;
    this.size = 0;
    this._destroyed?.unsubscribe();
    this._destroyed = undefined;
  }

  /**
   * Attempts to load the image. When successful, it will mark the class as loaded and resolve the returned promise.
   *
   * @param anonymous Whether or not to load anonymously or not.
   * @param allowXMLLoading Drives whether XML serialization of image/svg+xml objects can be performed. By default, this feature is on, but some browsers do not support it.
   */
  public async load(anonymous = true, allowXMLLoading = true): Promise<NgxAdvancedImgBitmap> {
    // if no valid source, then reject the load
    if (!this.src) {
      return Promise.reject();
    }

    // HEICs need to be converted before loading
    let needsHEICConversion = false;
    if (typeof this.src === 'string') {
      if (this.src.startsWith('data:image/heic')) {
        needsHEICConversion = true;
        // convert to blob
        this.src = NgxAdvancedImgBitmap.dataURItoBlob(this.src);
      }
    } else if (this.src.type === 'image/heic') {
      needsHEICConversion = true;
    }

    if (needsHEICConversion) {
      const jpeg = await NgxAdvancedImgBitmap.convertHEIC(this.src as Blob, 'image/jpeg');

      this.src = jpeg;
    }

    // if we have an expiration clock ticking, clear it
    if (this.expirationClock) {
      clearTimeout(this.expirationClock);
    }

    return new Promise((resolve, reject) => {
      let url: string;

      this.image = new Image();
      this.image.loading = 'eager';

      if (anonymous) {
        this.image.crossOrigin = 'anonymous';
      }

      // image loading error handler
      const onerror: () => void = () => {
        this.loaded = false;
        this.size = 0;

        // ensure that no expiration clock is running if we failed
        if (this.expirationClock) {
          clearTimeout(this.expirationClock);
        }

        reject(this);
      };

      // image load success handler
      this.image.onload = () => {
        if (!this.image) {
          // throw error if image has been destroyed
          return;
        }

        this.getImageBlob(this.image.src).then((blobData: Blob) => {
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

          const fileReader: FileReader = new FileReader();

          // when the file reader successfully loads array buffers, process them
          fileReader.onload = async (event: Event) => {
            // if image has been destroyed error out
            if (!this.image) {
              onerror();
              return;
            }

            const buffer: Uint8Array = new Uint8Array((event.target as any).result);
            this._mimeType = NgxAdvancedImgBitmap.detectMimeType(buffer, blobData.type);

            const domURL: any = URL || webkitURL || window.URL;

            if (this.mimeType !== 'image/svg+xml' || !allowXMLLoading) {
              // if our browser doesn't support the URL implementation, fail the load
              if (!domURL || !(domURL).createObjectURL) {
                onerror();

                return;
              }

              // create a canvas to paint to
              let canvas: HTMLCanvasElement | null = document.createElement('canvas');

              // configure the dimensions of the canvas
              canvas.width = this.image.width;
              canvas.height = this.image.height;

              // acquire the rendering context
              const ctx: CanvasRenderingContext2D | null = canvas?.getContext('2d', { desynchronized: false, willReadFrequently: true });

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
              let dataUri: string = (anonymous) ? canvas.toDataURL(this._mimeType) : '';

              if (typeof this.src === 'string') {
                // store the exif data
                exif.parse(blobData, true).then((exifData: any) => {
                  this._exifData = exifData;
                });
              }

              // if we got the bitmap data, create the link to download and invoke it
              if (dataUri) {
                // get the bitmap data in blob format
                this._objectURL = domURL.createObjectURL(NgxAdvancedImgBitmap.dataURItoBlob(dataUri));
              }

              // clean up the canvas
              if (canvas) {
                ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                canvas.width = canvas.height = 0;
                canvas = null;
              }

              this.loaded = true;
              this.size = this.image.naturalWidth * this.image.naturalHeight;

              const head: string = `data:${this._mimeType};base64,`;
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
                  let svg: any = (new NgxAdvancedImgJxon()).stringToXml(client.responseText).getElementsByTagName('svg')[0];

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

                  const svgXML: string = (new NgxAdvancedImgJxon()).xmlToString(svg);
                  svg = new Blob([svgXML], { type: this.mimeType + ';charset=utf-8' });

                  // if our browser doesn't support the URL implementation, fail the load
                  if (!this.image || !domURL || !(domURL).createObjectURL) {
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

                  this.image.loading = 'eager';
                  this.image.src = this._objectURL = domURL.createObjectURL(svg);
                }
              };

              // issue the file load
              client.send();
            }
          };

          // if we fail to load the file header data, throw an error to be captured by the promise catch
          fileReader.onerror = () => {
            throw new Error('Couldn\'t read file header for download');
          };

          // load the file data array buffer once we have the blob
          fileReader.readAsArrayBuffer(blobData);
        }).catch(onerror.bind(this));
      };

      // image load failure handler
      this.image.onerror = onerror;

      // calculate a unique revision signature to ensure we pull the image with the correct CORS headers
      let rev = '';
      if (this.revision >= 0 && (typeof this.src === 'string' && this.src.indexOf('base64') === -1)) {
        if (this.src.indexOf('?') >= 0) {
          rev = '&rev=' + this.revision;
        } else {
          rev = '?rev=' + this.revision;
        }
      }

      // create a properly configured url despite protocol - make sure any resolution data is cleared
      if (typeof this.src === 'string') {
        if (this.resolution === '') {
          // distinct loads should take the direct source url
          url = this.src;
        } else {
          // clear resolution information if provided for situations where we intend to use some resolution
          url = this.src.replace(/_(.*)/g, '');
        }

        // append resolution and revision information for all scenarios if provided
        url += this.resolution + rev;

        // load the image
        this.image.src = url
      } else {
        this.image.src = url = URL.createObjectURL(this.src);

        // store the original blob file size
        this._initialFileSize = this.src.size;

        // parse the exif data direction while the image content loads
        exif.parse(this.src, true).then((exifData: any) => {
          this._exifData = exifData;
        });
      }
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
  public saveFile(fileName: string, objectURL?: string, mimeType?: string): void {
    if (!this.loaded || !this.image) {
      return;
    }

    if (!mimeType) {
      mimeType = this.mimeType;
    }

    const domURL: any = URL || webkitURL || window.URL;

    // if our browser doesn't support the URL implementation, then quit
    if (!domURL || !(domURL).createObjectURL) {
      return;
    }

    const extension: string | null = mime.getExtension(mimeType);
    let url: string = this.image.src;

    // use the object url if one is present
    if (objectURL) {
      url = objectURL;
    } else if (this.objectURL) {
      url = this.objectURL;
    }

    // create a link and set it into the DOM for programmatic use
    const link: HTMLAnchorElement = document.createElement('a');
    link.setAttribute('type', 'hidden');
    link.setAttribute('href', url);
    link.setAttribute('target', '_blank');
    link.download = (typeof extension === 'string' && !!extension) ? `${fileName}.${extension}` : fileName;
    document.body.appendChild(link);

    // invoke the link click to start the download
    link.click();

    // clean up the download operation
    domURL.revokeObjectURL(url);
    document.body.removeChild(link);
  }

  /**
   * If the image is loaded, this function will optimize the image to the
   * desired quality and type and return a data url of bitmap information.
   *
   * @param quality The quality of the image optimization.
   * @param type The type of file output we would like to generate.
   * @param resizeFactor The scaling factor to reduce the size of the image.
   * @param maxDimension If provided, the maximum pixels allowed for x/y dimension in the size of the image.
   * @param sizeLimit The maximum size of the image in bytes, if exceeded, the image will be optimized further.
   * @param mode Describes the optimization mode to attempt. Focus on retaining size, quality, or a balance between them all.
   * @param strict If true, false by default, then the function will throw an error if the size limit cannot be achieved.
   */
  public async optimize(
    quality: number,
    type: string,
    resizeFactor: number = 1,
    maxDimension?: number | undefined, // 16,384 is a reasonable safe limit for most browsers
    sizeLimit?: number | undefined,
    mode?: 'classic' | 'prefer-quality' | 'prefer-size' | 'balanced' | 'hardcore' | undefined,
    strict?: boolean,
  ): Promise<INgxAdvancedImgBitmapOptimization> {
    return this._optimize(quality, type, resizeFactor, maxDimension, sizeLimit, mode, undefined, strict);
  }

  /**
   * If the image is loaded, this function will optimize the image to the
   * desired quality and type and return a data url of bitmap information.
   *
   * This is the internal logic to power optimization so that we may recursively
   * attempt optimizations in balanced and hardcore modes by tracking last op
   * without showing lastOp for the user of this function.
   *
   * @param quality The quality of the image optimization.
   * @param type The type of file output we would like to generate.
   * @param resizeFactor The scaling factor to reduce the size of the image.
   * @param maxDimension If provided, the maximum pixels allowed for x/y dimension in the size of the image.
   * @param sizeLimit The maximum size of the image in bytes, if exceeded, the image will be optimized further.
   * @param mode Describes the optimization mode to attempt. Focus on retaining size, quality, or a balance between them all.
   * @param strict If true, false by default, then the function will throw an error if the size limit cannot be achieved.
   */
  private async _optimize(
    quality: number,
    type: string,
    resizeFactor: number = 1,
    maxDimension?: number | undefined, // 16,384 is a reasonable safe limit for most browsers
    sizeLimit?: number | undefined,
    mode?: 'classic' | 'prefer-quality' | 'prefer-size' | 'balanced' | 'hardcore' | undefined,
    lastOp?: 'quality' | 'scale' | undefined,
    strict?: boolean,
  ): Promise<INgxAdvancedImgBitmapOptimization> {
    return new Promise((resolve: (value: INgxAdvancedImgBitmapOptimization) => void) => {
      if (
        !this.image ||
        !this.loaded
      ) {
        throw new Error('Image not loaded');
      }

      if (quality < 0 || quality > 1) {
        throw new Error('The requested image optimization cannot be achieved');
      }

      // draw the image to the canvas
      let canvas: HTMLCanvasElement | null = document.createElement('canvas');
      let width: number = canvas.width = this.image.width * resizeFactor;
      let height: number = canvas.height = this.image.height * resizeFactor;

      // scale the image down based on the max allowed pixel dimension
      if (
        typeof maxDimension === 'number' &&
        !isNaN(maxDimension) &&
        isFinite(maxDimension) &&
        maxDimension > 0
      ) {
        if (canvas.width > maxDimension) {
          canvas.height = canvas.height * (maxDimension / canvas.width);
          canvas.width = maxDimension;
        }

        if (canvas.height > maxDimension) {
          canvas.width = canvas.width * (maxDimension / canvas.height);
          canvas.height = maxDimension;
        }
      }

      const ctx: CanvasRenderingContext2D | null = canvas?.getContext('2d', { desynchronized: false, willReadFrequently: true });

      ctx?.drawImage(
        this.image,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      // if we haven't loaded anonymously, we'll taint the canvas and crash the application
      let dataUri: string = canvas.toDataURL(type, quality);

      // clean up the canvas
      if (canvas) {
        ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        canvas.width = canvas.height = 0;
        canvas = null;
      }

      const domURL: any = URL || webkitURL || window.URL;
      let objectURL = '';

      // if we got the bitmap data, create the link to download and invoke it
      if (dataUri) {
        // get the bitmap data
        objectURL = domURL.createObjectURL(NgxAdvancedImgBitmap.dataURItoBlob(dataUri));
      }

      if (!objectURL) {
        throw new Error('An error occurred while drawing to the canvas');
      }

      if (typeof sizeLimit === 'number' && !isNaN(sizeLimit) && isFinite(sizeLimit) && sizeLimit > 0) {
        const head: string = `data:${type};base64,`;
        const fileSize: number = Math.round(atob(dataUri.substring(head.length)).length);

        if (this.debug) {
          console.warn('Image Optimization Factors:', mode, quality, resizeFactor, `${fileSize} B`);
        }

        if (fileSize > sizeLimit) {

          if (resizeFactor === undefined) {
            // if the resize factor wasn't supplied set to 1
            resizeFactor = 1;
          }

          if (resizeFactor <= 0) {
            throw new Error('Invalid resize factor reached (<= 0)');
          }

          let qualityFloor = 0.025;
          let scaleFloor = 0.025;
          let preferredOp: 'prefer-size' | 'prefer-quality' = 'prefer-size';

          switch (mode) {
            case 'balanced':
              if (lastOp === 'quality') {
                preferredOp = 'prefer-size';
                lastOp = 'scale';
              } else {
                preferredOp = 'prefer-quality'
                lastOp = 'quality';
              }
              break;

            case 'hardcore':
              if (lastOp === 'quality') {
                preferredOp = 'prefer-size';
                lastOp = 'scale';
              } else {
                preferredOp = 'prefer-quality'
                lastOp = 'quality';
              }
              break;

            case 'prefer-size':
              preferredOp = 'prefer-size';
              lastOp = 'quality';
              break;

            case 'prefer-quality':
              preferredOp = 'prefer-quality';
              lastOp = 'scale';
              break;

            default:
            case 'classic':
              qualityFloor = 0.8;
              scaleFloor = 0.1;

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
              if (!strict && quality === qualityFloor && resizeFactor === scaleFloor) {
                const exifData: any = JSON.parse(JSON.stringify(this.exifData));

                exifData['ExifImageWidth'] = width;
                exifData['ExifImageHeight'] = height;

                resolve({
                  objectURL,
                  exifData,
                } as INgxAdvancedImgBitmapOptimization);

                return;
              }

              if (resizeFactor > scaleFloor) {
                resizeFactor = resizeFactor - NgxAdvancedImgBitmap.ITERATION_FACTOR;

                if (resizeFactor < scaleFloor) {
                  // keep it within a given scaling factor
                  resizeFactor = scaleFloor;
                }


                // if the quality is too high, reduce it and try again
                this._optimize(quality, type, resizeFactor, maxDimension, sizeLimit, mode, lastOp, strict).then((optimization: INgxAdvancedImgBitmapOptimization) => resolve(optimization));

                return;
              }

              // we've reduced scale, let's reduce image size
              if (quality < qualityFloor) {
                if (strict) {
                  throw new Error('The requested image optimization cannot be achieved');
                }

                // keep it within a given quality floor
                quality = qualityFloor;
              }

              this._optimize(quality, type, resizeFactor, maxDimension, sizeLimit, mode, lastOp, strict).then((optimization: INgxAdvancedImgBitmapOptimization) => resolve(optimization));

              return;

            case 'prefer-size':
              // base case if we are at our bottom quality and resize factor, resolve
              if (!strict && quality === qualityFloor && resizeFactor === scaleFloor) {
                const exifData: any = JSON.parse(JSON.stringify(this.exifData));

                exifData['ExifImageWidth'] = width;
                exifData['ExifImageHeight'] = height;

                resolve({
                  objectURL,
                  exifData,
                } as INgxAdvancedImgBitmapOptimization);

                return;
              }

              if (quality > qualityFloor) {
                quality = quality - ((NgxAdvancedImgBitmap.QUALITY_FACTOR / (sizeLimit / fileSize) * NgxAdvancedImgBitmap.ITERATION_FACTOR));

                if (quality < qualityFloor) {
                  // keep it within a given quality floor
                  quality = qualityFloor;
                }

                // if the quality is too high, reduce it and try again
                this._optimize(quality, type, resizeFactor, maxDimension, sizeLimit, mode, lastOp, strict).then((optimization: INgxAdvancedImgBitmapOptimization) => resolve(optimization));

                return;
              }

              // we've reduced quality, let's reduce image size
              resizeFactor = resizeFactor - NgxAdvancedImgBitmap.ITERATION_FACTOR;
              if (resizeFactor < scaleFloor) {
                if (strict) {
                  throw new Error('The requested image optimization cannot be achieved');
                }

                // keep it within a given scaling factor
                resizeFactor = scaleFloor;
              }

              this._optimize(quality, type, resizeFactor, maxDimension, sizeLimit, mode, lastOp, strict).then((optimization: INgxAdvancedImgBitmapOptimization) => resolve(optimization));

              return;
          }
        }
      }

      const exifData: any = JSON.parse(JSON.stringify(this.exifData));

      exifData['ExifImageWidth'] = width;
      exifData['ExifImageHeight'] = height;

      resolve({
        objectURL,
        exifData,
      } as INgxAdvancedImgBitmapOptimization);
    });
  }

  /**
   * Helper function that adjusts the image based on any exif data indicating
   * a different orientation be performed.
   */
  private async adjustForExifOrientation(): Promise<void> {
    if (!this.image) {
      return Promise.reject();
    }

    try {
      this._orientation = await exif.orientation(this.image) || 1;
    } catch (e) {
      // assume normal orientation if none can be found based on exif info
      this._orientation = 1;
    }

    if (this._orientation === undefined || this._orientation === null) {
      // assume normal orientation if none can be found based on exif info
      this._orientation = 1;
    }

    return Promise.resolve();
  }

  /**
   * Event handler for when expiration clocks are complete and we must dispose of ourselves.
   */
  private onExpired(): void {
    // only destroy if we had been loaded, otherwise let the loading pathways dispose of this bitmap
    if (this.loaded) {
      this.destroy();
    }

    // the expiration clock is now complete
    this.expirationClock = null;
  }

  /**
   * Fetch the blob info for a given url.
   *
   * @param url The url to the image to load the blob data.
   */
  private async getImageBlob(url: string): Promise<Blob> {
    if (!this.image) {
      return Promise.reject();
    }

    const headers: Headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');

    const response: Response = await fetch(url, {
      method: 'GET',
      mode: this.image.crossOrigin !== 'anonymous' ? 'no-cors' : undefined,
      headers,
    });

    return response.blob();
  }

}
