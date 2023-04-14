# ngx-advanced-img

Angular attribute directives suite that provides various HTML img feature extensions.

## Table of contents
- [ngx-advanced-img](#ngx-advanced-img)
  - [Table of contents](#table-of-contents)
  - [About This Package](#about-this-package)
  - [Installation](#installation)
  - [Usage](#usage)
  - [API](#api)
    - [ngxAdvancedImgFallback](#ngxadvancedimgfallback)

## About This Package
This package was built to provide easy to use feature directives that are meant to be used with HTML img tags. The first two features being created are fallback image loading and progressive image loading and caching.

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

## API

### ngxAdvancedImgFallback

This directive extends HTML img nodes to provide some special fallback loading functionality. If the initial load of the image src value fails, this directive will automatically swap to the provided fallback URL or data URI. Alternatively, you may provide a special value of `cache-bust` and it will handle reloading prevoiusly failed src but with a unique cache busting query parameter attached to the URL (assuming it is a valid URL).

`ngxAdvancedImgFallback` {'cache-bust' | string}
+ `cache-bust`: If the img src is a valid URL and it fails to load, the img will fallback to the exact same url but with a `?cache-bust` query parameter added to it including a uniqiue timestamp value.
+ `string`: If the img src fails to load, the img will fallback to the provided string. This should be a valid URL or data URI. If this fails to load, no further action is taken.
