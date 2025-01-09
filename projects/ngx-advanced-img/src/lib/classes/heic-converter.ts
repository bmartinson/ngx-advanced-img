import * as exif from 'exifr';

// @ts-ignore
import libheif from 'libheif-js/wasm-bundle';

export interface INgxAdvancedImgHeicConversion {
	exifData: any;
	blob: Blob;
}

export class NgxAdvancedImgHeicConverter {

  /**
   * Converts the result of a libheif-js HEIC decoding into an ImageData object.
   * Based on a helper function used in the heic2any library.
   * @param image DecodeResult object from libheif-js
   * @returns Promise resolving to an ImageData object
   */
	private static processSingleImage(image: any): Promise<ImageData> {
		return new Promise((resolve, reject) => {
			const w = image.get_width();
			const h = image.get_height();
			const whiteImage = new ImageData(w, h);
			
      for (let i = 0; i < w * h; i++) {
				whiteImage.data[i * 4 + 3] = 255;
			}
			
      image.display(whiteImage, (imageData: ImageData | null) => {
			  if (!imageData) {
				  return reject(
					  "ERR_LIBHEIF Error while processing single image and generating image data, could not ensure image"
				  );
			  }

				resolve(imageData);
			});
		});
	}

  /**
   * Converts a ImageData object to a Blob using an OffscreenCanvas.
   * OffscreenCanvas is used so that this function can be called in a Web Worker.
   * @param imageData Pixel data to convert to a Blob
   * @param mimeType The mimetype of the resulting blob
   * @param quality The quality of the resulting conversion
   * @returns 
   */
  protected static imageDataToBlobOffscreen(imageData: ImageData, mimeType: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      // Create an offscreen canvas
      let offscreenCanvas = new OffscreenCanvas(imageData.width, imageData.height);
      let ctx = offscreenCanvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get 2d context'));
      }
  
      ctx.putImageData(imageData, 0, 0);

      offscreenCanvas.convertToBlob({ type: mimeType, quality: quality }).then(resolve).catch((error) => {
        reject(new Error("ERR_CANVAS Error on converting imagedata to blob: " + error));
      });
    });
  }

  /**
   * 
   * @param buffer 
   * @returns 
   */
	protected static async decodeHeic(buffer: Uint8Array): Promise<ImageData> {
		const decoder = new libheif.HeifDecoder();
		let imagesArr = decoder.decode(buffer);
		
    if (!imagesArr || !imagesArr.length) {
			throw "ERR_LIBHEIF format not supported";
		}

		imagesArr = imagesArr.filter((x: any) => {
			let valid = true;
			try {
        /*
        sometimes the heic container is valid
        yet the images themselves are corrupt
        */
        x.get_height();
			} catch (e) {
			  valid = false;
			}
			
      return valid;
		});

		if (!imagesArr.length) {
			throw "ERR_LIBHEIF Heic doesn't contain valid images";
		}
	
		// use the first frame if heic contains multiple images
		return NgxAdvancedImgHeicConverter.processSingleImage(imagesArr[0]);
	}

  /**
   * Converts a Blob containing HEIC data to a Blob containing JPEG data
   * using the libheif-js WebAssembly bundle.
   * @param src 
   * @returns 
   */
	public static async convert(src: Blob, mimeType: string = 'image/jpeg'): Promise<INgxAdvancedImgHeicConversion> {
		// if no valid source, then reject the load
		if (!src) {
			return Promise.reject(new Error('No valid source provided'));
		}
		
		return new Promise((resolve, reject) => {
      // begin parsing of exif data before loss during conversion
      const exifPromise = exif.parse(src, true);

			const fileReader: FileReader = new FileReader();

			fileReader.onload = async (event: Event) => {
        const buffer: Uint8Array = new Uint8Array((event.target as any).result);

        const imageData = await NgxAdvancedImgHeicConverter.decodeHeic(buffer);
        
        const blob = await NgxAdvancedImgHeicConverter.imageDataToBlobOffscreen(imageData, mimeType, .92);

        const exifData = await exifPromise;

        resolve({
          exifData,
          blob
        });
			};

			// if we fail to load the file header data, throw an error to be captured by the promise catch
			fileReader.onerror = () => {
        reject(new Error('Failed to load file header data'));
			};
	
			// load the file data array buffer once we have the blob
			fileReader.readAsArrayBuffer(src);
		});
	}
}