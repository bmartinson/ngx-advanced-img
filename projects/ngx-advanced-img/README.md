# ngx-advanced-img

Angular attribute directives suite that provides various HTML img feature extensions.

## Table of contents
- [ngx-advanced-img](#ngx-advanced-img)
  - [Table of contents](#table-of-contents)
  - [About This Package](#about-this-package)
  - [Installation](#installation)
  - [Usage](#usage)
  - [Directives](#directives)
    - [ngxAdvancedImgFallback](#ngxadvancedimgfallback)
- [Classes](#classes)
  - [NgxAdvancedImgBitmap](#ngxadvancedimgbitmap)
      - [Creating Bitmap](#creating-bitmap)
      - [Optimizing Bitmaps](#optimizing-bitmaps)

## About This Package
This package was built to provide easy to use feature directives that are meant to be used with HTML img tags. The first features being created are fallback image loading and progressive image loading and caching. Additionally, it provides helper classes that allow image data to be cached in application memory for quick HTML5 Canvas usage and the library also provides an easy to use interface for encoding images with new mime types and optimize them to meet certain conditions or file sizes.

## Installation
```npm install ngx-advanced-img --save```

## Usage
1. Import `NgxAdvancedImgModule` in your app module (or other Angular module) and place it in your imports section:

    ```typescript
    import { NgxAdvancedImgModule } from "ngx-advanced-img";

    @NgModule({
       imports: [
         ...,
         NgxAdvancedImgModule,
       ],
       ...
    })
    export class AppModule { }
	  ```

2. Import `ngx-advanced-img.scss` to your application's styles or add it to your `angular.json` if you use the CLI tools.

## Directives

### ngxAdvancedImgFallback

This directive extends HTML img nodes to provide some special fallback loading functionality. If the initial load of the image src value fails, this directive will automatically swap to the provided fallback URL or data URI. Alternatively, you may provide a special value of `cache-bust` and it will handle reloading prevoiusly failed src but with a unique cache busting query parameter attached to the URL (assuming it is a valid URL).

`ngxAdvancedImgFallback` {'cache-bust' | string}
+ `cache-bust`: If the img src is a valid URL and it fails to load, the img will fallback to the exact same url but with a `?cache-bust` query parameter added to it including a uniqiue timestamp value.
+ `string`: If the img src fails to load, the img will fallback to the provided string. This should be a valid URL or data URI. If this fails to load, no further action is taken.

`ngxAdvancedImgFallbackActive` {read-only boolean}
+ Returns the active state of the fallback. If the fallback is currently being displayed, then this will return as true. This is useful if you need to change width/height or other attributes of your img element based on whether or not the fallback is active.

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
- `resolution: NgxAdvancedImgResolution` - The suffix that will be added to the filepath if it is a string. This allows for variable resolution loading (e.g. '_low-res', '_high-res').
- `revision: number` - The image revision. It will add a query parameter to help with cache busting if we are trying to load a specific image with revision to it.
- `ttl?: number` - The time to live. If 0 or undefined, the data will live in memory forever. Otherwise, it will be purged after this many seconds.

#### Optimizing Bitmaps

You can optimize an already loaded image bitmap by using the `optimize` function.

```typescript
bitmap.load().finally(() => {
  console.log('bitmap loaded with size (B):', bitmap.fileSize);

  bitmap.optimize(
    +this.quality,
    bitmap.mimeType,
    +this.scale / 100,
    +this.maxDimension,
    this.size ? +this.size : undefined,
    this.mode,
    !!this.strictMode,
  ).then((data: INgxAdvancedImgBitmapOptimization) => {
    // ... save the file? use that resultant data in other canvases?
  }).catch(() => {
    // ... if things fail
  });
});
```

- `quality` - A number between 0-1 that indicates the encoding quality to use (or start with if limiting by size).
- `type` - The mime type for the resultant data (e.g. `image/jpeg`, `image/png`, etc.)
- `resizeFactor` - Optional parameter that will scale the physical size of the image by
- `maxDimension` - Optional parameter that will limit the maximum dimension (width/height) of the image to while retaining aspect ratio.
- `sizeLimit` - Optional parameter that will attempt to reduce the resultant file output size to this size in bytes.
- `mode` - (`retain-quality` | `retain-size` | `balanced` | `hardcore`) - Optional parameter that specifies what size limiting mode to use. Default is `balanced`.
  - `retain-quality` - Reduces the size of the image first until a threshold is achieved. Then it starts to reduce quality after that to try and achieve the `sizeLimit`.
  - `retain-size` - Reduces the quality of the image first until a threshold is achieved. Then it starts to reduce size after that to try and achieve the `sizeLimit`.
  - `balanced` - Alternates between adjusting quality and size while retaining reasonable thresholds of modification.
  - `hardcore` - Alternates between adjusting quality and size without regards to reasonable limits. It will go as far as making an image have 0.025 quality and 0.025x the scale of the original image.
- `strict` - Optional parameter, if set to true, will throw an exception if a given `sizeLimit` is unobtainable. If set to false, the optimization will return whatever data it can generate as close to the size limit as possible.

**Important Note**

The resultant bitmap data will have all exif meta data stripped from it since the optimization procedure uses HTML5 canvas operations to manipulate the data. All exif meta data is included in the response object of the function call so that you may work with it as necessary if you are in a controlled server environment where you have reliable and efficient means for writing exif data back to images. In the browser environment, this isn't really the case without limiting our output mime types. Therefore, such considerations should be those of the wielder of this library.
