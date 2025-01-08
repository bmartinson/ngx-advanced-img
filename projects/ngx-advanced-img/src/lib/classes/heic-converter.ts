import * as exif from 'exifr';

// @ts-ignore
import libheif from 'libheif-js/wasm-bundle';

export interface INgxAdvancedImgHeicConversion {
	exifData: any;
	blob: Blob;
}

export class NgxAdvancedImgHeicConverter {

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

  protected static imageDataToBlobOffscreen(imageData: ImageData, mimeType: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      // Create an offscreen canvas
      let offscreenCanvas = new OffscreenCanvas(imageData.width, imageData.height);
      let ctx = offscreenCanvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get 2d context');
      }
  
      ctx.putImageData(imageData, 0, 0);

      offscreenCanvas.convertToBlob({ type: mimeType, quality: quality }).then(resolve).catch((error) => {
        reject("ERR_CANVAS Error on converting imagedata to blob: " + error);
      });
    });
  }

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


	public static async convert(src: Blob): Promise<INgxAdvancedImgHeicConversion> {
		// if no valid source, then reject the load
		if (!src) {
			return Promise.reject(new Error('No valid source provided'));
		}
		
		return new Promise((resolve, reject) => {
      // begin parsing exif data
      const exifPromise = exif.parse(src, true);

			const fileReader: FileReader = new FileReader();

			// when the file reader successfully loads array buffers, process them
			fileReader.onload = async (event: Event) => {
        const buffer: Uint8Array = new Uint8Array((event.target as any).result);

        const imageData = await NgxAdvancedImgHeicConverter.decodeHeic(buffer);
        
        const blob = await NgxAdvancedImgHeicConverter.imageDataToBlobOffscreen(imageData, 'image/jpeg', .92);

        const exifData = await exifPromise;

        console.log(exifData);

        resolve({
          exifData,
          blob: blob
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