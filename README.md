# ngx-advanced-img

A multi-purpose utility package with the goal of providing high performing and easy to use tools for image handling in modern Angular web applications. Best known for high performance image optimization and conversion tools.

## Table of contents

- [ngx-advanced-img](#ngx-advanced-img)
  - [Table of contents](#table-of-contents)
  - [About This Package](#about-this-package)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Features](#features)
    - [Styling](#styling)
  - [Directives](#directives)
    - [ngxAdvancedImgFallback](#ngxadvancedimgfallback)
- [Classes](#classes)
  - [NgxAdvancedImgBitmap](#ngxadvancedimgbitmap)
      - [Creating Bitmap](#creating-bitmap)
      - [Optimizing Bitmaps](#optimizing-bitmaps)
  - [NgxAdvancedImgCanvasHelper](#ngxadvancedimgcanvashelper)
  - [NgxAdvancedImgHeicConverter](#ngxadvancedimgheicconverter)

## About This Package

This package was built to provide easy to use feature directives that are meant to be used with HTML img tags. The first features being created are fallback image loading and progressive image loading and caching. Additionally, it provides helper classes that allow image data to be cached in application memory for quick HTML5 Canvas usage and the library also provides an easy to use interface for encoding images with new mime types and optimize them to meet certain conditions or file sizes.

## Installation

`npm install ngx-advanced-img --save`

## Usage

### Features

If you use Angular modules and would like to use the directive or another feature, import it into your module.

```typescript
import { NgxAdvancedImgFallbackDirective } from "ngx-advanced-img";

@NgModule({
   imports: [
     ...,
     NgxAdvancedImgDirective,
   ],
   ...
})
export class AppModule { }
```

Better yet, just use the directive or other feature directly where relevant.

```typescript
import { NgxAdvancedImgFallbackDirective } from 'ngx-advanced-img';

@Component({
  selector: 'your-selector-name',
  templateUrl: './your-component.component.html',
  styleUrls: ['./your-component.component.scss'],
  imports: [NgxAdvancedImgFallbackDirective],
})
export class AppComponent {}
```

### Styling

Import `ngx-advanced-img.scss` to your application's styles or add it to your `angular.json` if you use the CLI tools.

## Directives

### ngxAdvancedImgFallback

This directive extends HTML img nodes to provide some special fallback loading functionality. If the initial load of the image src value fails, this directive will automatically swap to the provided fallback URL or data URI. Alternatively, you may provide a special value of `cache-bust` and it will handle reloading prevoiusly failed src but with a unique cache busting query parameter attached to the URL (assuming it is a valid URL).

`ngxAdvancedImgFallback` {'cache-bust' | string}

- `cache-bust`: If the img src is a valid URL and it fails to load, the img will fallback to the exact same url but with a `?cache-bust` query parameter added to it including a uniqiue timestamp value.
- `string`: If the img src fails to load, the img will fallback to the provided string. This should be a valid URL or data URI. If this fails to load, no further action is taken.

`ngxAdvancedImgFallbackActive` {read-only boolean}

- Returns the active state of the fallback. If the fallback is currently being displayed, then this will return as true. This is useful if you need to change width/height or other attributes of your img element based on whether or not the fallback is active.

# Classes

These classes require no import of the module, but you can import the classes directly into your source code.

## NgxAdvancedImgBitmap

This class is used to load image data into application memory using HTML5 canvas technology. This allows a user of this class to efficiently load and draw images to screen. It additionally provides extra support for dealing with SVGs in HTML5 and also provides the ability to optimize a given image file to reduce its file size in browser.

#### Creating Bitmap

```javascript
const bitmap: NgxAdvancedImgBitmap = new NgxAdvancedImgBitmap(
  src,
  resolution,
  revision,
  ttl,
);
```

- `src: string | Blob` - The source for the image to be loaded. Either a string or file Blob.
- `resolution: NgxAdvancedImgResolution` - The suffix that will be added to the filepath if it is a string. This allows for variable resolution loading (e.g. '\_low-res', '\_high-res').
- `revision: number` - The image revision. It will add a query parameter to help with cache busting if we are trying to load a specific image with revision to it.
- `ttl?: number` - The time to live. If 0 or undefined, the data will live in memory forever. Otherwise, it will be purged after this many seconds.

#### Optimizing Bitmaps

You can optimize an already loaded image bitmap by using the `optimize` function.

```typescript
bitmap.load().finally(() => {
  console.log('bitmap loaded with size (B):', bitmap.fileSize);

  bitmap.optimize(
    bitmap.mimeType,
    +this.quality,
    +this.scale / 100,
    +this.maxDimension,
    {
      sizeLimit: +this.size,
      mode: this.mode,
      strict: !!this.strictMode,
    },
    options?: INgxAdvancedImgOptimizationOptions,
  ).then((data: INgxAdvancedImgBitmapOptimization) => {
    // ... save the file? use that resultant data in other canvases?
  }).catch(() => {
    // ... if things fail
  });
});
```

- `type` - The mime type for the resultant data (e.g. `image/jpeg`, `image/png`, etc.)
- `quality` - A number between 0-1 that indicates the encoding quality to use (or start with if limiting by size).
- `resizeFactor` - Optional parameter that will scale the physical size of the image by this factor.
- `maxDimension` - Optional parameter that will limit the maximum dimension (width/height) of the image to while retaining aspect ratio.
- `options` - Optional parameter that drives optimization options. When provided, the optimize algorithm will attempt to perform the optimization in accordance with the provided mode to achieve a size within the limit of the `sizeLimit`.
- `mode` - (`prefer-quality` | `prefer-size` | `balanced` | `hardcore`) - Optional parameter that specifies what size limiting mode to use. Default is `balanced`.
  - `sizeLimit` - The maximum number of bytes we would like the resultant image to be.
  - `minDimension` - The minimum dimension that the photo will be optimized to.
  - `minScale` - The minimum scaling factor that will be used while optimizing.
  - `minQuality` - The minimum quality that will be used while optimizing.
  - `mode` - The optimization algorithm to use to try and achieve the `sizeLimit` threshold.
    - `prefer-quality` - Reduces the size of the image first until a threshold is achieved. Then it starts to reduce quality after that to try and achieve the `sizeLimit`.
    - `prefer-size` - Reduces the quality of the image first until a threshold is achieved. Then it starts to reduce size after that to try and achieve the `sizeLimit`.
    - `retain-quality` - Reduces the size of the photo only in order to try and achieve the `sizeLimit` threshold.
    - `retain-size` - Reduces the quality of the photo only in order to try and achieve the `sizeLimit` threshold.
    - `alternating-preference` - Alternates between adjusting quality and size. This is usually the slowest method.
  - `strict` - Optional parameter, if set to true, will throw an exception if a given `sizeLimit` is unobtainable. If set to false, the optimization will return whatever data it can generate as close to the size limit as possible.

## NgxAdvancedImgCanvasHelper

This class is used to act as a static memory pool for HTMLCanvasElement allocations so that the repeated process of canvas use within the NgxAdvancedImgBitmap class or in other implementations can re-use canvases
as often as possible and not rely on efficient JavaScript browser garbage collection.

**Sample**

```typescript
// get a canvas to work with...
const canvas: HTMLCanvasElement = NgxAdvancedImgCanvasHelper.requestCanvas();

// do some work with a canvas...

canvas.width = image.width;
canvas.height = image.height;

const ctx: CanvasRenderingContext2D | null = canvas?.getContext('2d', {
  desynchronized: false,
  willReadFrequently: true,
});

ctx?.drawImage(image, 0, 0, canvas.width, canvas.height);

// once done working with the canvas, return it to the pool...
NgxAdvancedImgCanvasHelper.returnCanvas(canvas);

// ...

/**
 *
 * Reduce your pool of available canvases on demand to the batch limit
 *
 * You really only really need to do this if your implementation is getting
 * really big and you're not actively re-using canvases very well.
 *
 * For example, perhaps your canvas pool processes a large spike in workload.
 * You don't want to keep the max number of canvases around for reuse because
 * you won't regularly use them. So, you call this to deflate it back down.
 * Pass in an optional number to reduce to that. This way you can reduce
 * to your expected average workload perhaps.
 *
 */
NgxAdvancedImgCanvasHelper.reducePool();
```

**Important Note**

The resultant bitmap data will have all exif meta data stripped from it since the optimization procedure uses HTML5 canvas operations to manipulate the data. All exif meta data is included in the response object of the function call so that you may work with it as necessary if you are in a controlled server environment where you have reliable and efficient means for writing exif data back to images. In the browser environment, this isn't really the case without limiting our output mime types. Therefore, such considerations should be those of the wielder of this library.

## NgxAdvancedImgHeicConverter

This class can be used within a web worker to convert a HEIC image to a different image format using a WebAssembly version of the libheif file format decoder/encoder. This is useful when trying to optimize a HEIC image in a browser that does not support HEIC image loads.

You can convert a HEIC Blob object to another mimetype by using the `convert` function.

**Sample**

```typescript
// convert heic to jpeg before trying to load image
let src: Blob = file;
if (file.type === 'image/heic') {
  try {
    const result = await this.workerConvert(file, 'image/jpeg');

    src = result.blob;
  } catch (error) {
    this.prettyLog(['Unable to convert HEIC with web worker'], 'error');
  }
}

// load and optimize decoded HEIC
const bitmap: NgxAdvancedImgBitmap = new NgxAdvancedImgBitmap(src, '', 0, 0);
// ...
```

**Web Worker Sample**

```typescript
/// <reference lib="webworker" />
import { NgxAdvancedImgHeicConverter } from '../../projects/ngx-advanced-img/src/lib/classes/heic-converter';

addEventListener('message', async ({ data }) => {
  const file = data.file as File;
  const mimeType = data.mimeType as string;

  try {
    const result = await NgxAdvancedImgHeicConverter.convert(file, mimeType);

    postMessage(result);
  } catch (error) {
    console.error('Worker error:', error instanceof Error ? error.stack : error);

    // Return the original error if it is an Error object, otherwise create a new one
    const errorMessage = error instanceof Error ? error : new Error(`Worker error: ${JSON.stringify(error)}`);

    postMessage(errorMessage);
  }
});
```
