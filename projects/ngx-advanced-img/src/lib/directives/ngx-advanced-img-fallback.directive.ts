import { Directive, ElementRef, Input, OnDestroy, OnInit, Renderer2 } from '@angular/core';

@Directive({
  selector: '[ngxAdvancedImgFallback]',
  standalone: false,
})
export class NgxAdvancedImgFallbackDirective implements OnInit, OnDestroy {
  private _failureURL: string | undefined; // the url for the latest fallback attempt
  private _src: 'cache-bust' | string;
  private _errorHandler: () => void;
  private removeErrorHandler: (() => void) | undefined;

  /**
   * Public accessor for the active state of the fallback. If the fallback is
   * currently being displayed, then this will return as true. This is useful
   * if you need to change dimensions of your img element based on whether or
   * not the fallback is active.
   */
  public get ngxAdvancedImgFallbackActive(): boolean {
    if (this._src === 'cache-bust') {
      // if we were cache busting, then we should check the failure url for matches
      return this.elementRef?.nativeElement?.src === this._failureURL;
    }

    return this.elementRef?.nativeElement?.src === this._src;
  }

  /**
   * The fallback url to use when the image fails to load. If the url is
   * set to 'cache-bust', then the image will be reloaded with a cache bust
   * query parameter to attempt to force a reload. This is useful for cases
   * where you may have a CDN that previously cached the image and you want to
   * refresh it because the cached value is a failure.
   *
   * Otherwise, if the value is another string, that source will attempt to
   * load instead. Perhaps it is a URL or a data URI.
   */
  public get ngxAdvancedImgFallback(): 'cache-bust' | string {
    return this._src;
  }

  /**
   * The fallback url to use when the image fails to load. If the url is
   * set to 'cache-bust', then the image will be reloaded with a cache bust
   * query parameter to attempt to force a reload. This is useful for cases
   * where you may have a CDN that previously cached the image and you want to
   * refresh it because the cached value is a failure.
   *
   * Otherwise, if the value is another string, that source will attempt to
   * load instead. Perhaps it is a URL or a data URI.
   */
  @Input()
  public set ngxAdvancedImgFallback(value: 'cache-bust' | string) {
    if (typeof value !== 'string') {
      // use an empty string if the url is not a string
      value = 'cache-bust';
    }

    if (value !== this._src) {
      this._src = value;
    }
  }

  /**
   * Directive constructor. If the element is not an image, we will throw an error.
   *
   * @param elementRef The element ref so we can look at native properties like src.
   * @param renderer A renderer reference so we can listen to events.
   */
  public constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2
  ) {
    this._src = '';

    if (this.elementRef?.nativeElement?.nodeName !== 'IMG') {
      throw new Error('ngxAdvancedImgFallback can only be applied to an image element');
    }

    this._errorHandler = this.onError.bind(this);
  }

  /**
   * When the component initializes, we will attach event handlers to listen
   * for image failures.
   */
  public ngOnInit(): void {
    if (this.elementRef?.nativeElement?.nodeName !== 'IMG') {
      // no need for an error since the constructor deals with it
      return;
    }

    this.removeErrorHandler = this.renderer.listen(this.elementRef.nativeElement, 'error', this._errorHandler);
  }

  /**
   * When the component is destroyed, we need to make sure that we clean up
   * any loading listeners that we may have attached to the image.
   */
  public ngOnDestroy(): void {
    if (typeof this.removeErrorHandler === 'function') {
      this.removeErrorHandler();
    }
  }

  /**
   * Primary error handler. Whenever the image fails to load, we will see if
   * the failed image is not the fallback image and instead attempt to load the
   * fallback image in its place.
   */
  private onError(): void {
    if (this._src === 'cache-bust') {
      // look to see if the current url is the same as the last fallback url
      if (this.elementRef?.nativeElement?.src !== this._failureURL) {
        // get the source as a url. if it is not a valid url, we'll throw an error
        const url = new URL(this.elementRef?.nativeElement?.src);
        const now = new Date();

        // generate some unique parameter value for the cache bust
        url.searchParams.append(
          'cache-bust',
          `${now.getUTCMinutes()}${now.getUTCSeconds()}${now.getUTCMilliseconds()}`
        );

        // convert the url back out to a string
        this._failureURL = url.toString();

        // load the url with the cache bust query parameter added
        this.renderer.setAttribute(this.elementRef.nativeElement, 'src', this._failureURL);
      }
    } else if (this.elementRef?.nativeElement?.src !== this._src) {
      // it isn't a cache bust, it's some other src, so load it if it isn't failed on that
      this.renderer.setAttribute(this.elementRef.nativeElement, 'src', this._src);
    }
  }
}
