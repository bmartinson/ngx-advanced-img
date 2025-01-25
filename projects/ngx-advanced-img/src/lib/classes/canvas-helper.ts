/**
 * This class has been designed to help with the management of canvas elements
 * so that they may be reused across several instances of bitmap usage in order
 * to conserve memory and reduce the number of canvas elements that are created
 * overall.
 */
export class NgxAdvancedImgCanvasHelper {
  /**
   * This property will control how many canvases are generated on any given
   * event that requires the minting of new HTMLCanvasElement instances in
   * memory.
   *
   * By default this is set to 1. You may set higher if you want to generate
   * canvases faster, using more memory. This is generally discouraged.
   */
  public static CANVAS_BATCH_ALLOCATION_AMOUNT = 1;

  private static CANVAS_COUNT = 0;
  private static readonly IN_USE_CANVASES: HTMLCanvasElement[] = [];
  private static readonly AVAILABLE_CANVASES: HTMLCanvasElement[] = [];

  /**
   * Read only access to the count of canvases that are currently in
   * the pool of canvases.
   */
  public static getCanvasCount(): number {
    return NgxAdvancedImgCanvasHelper.IN_USE_CANVASES?.length + NgxAdvancedImgCanvasHelper.AVAILABLE_CANVASES?.length;
  }

  /**
   * Returns a canvas to the requester that is available for usage.
   *
   * @return The HTMLCanvasElement that is available for use.
   */
  public static requestCanvas(): HTMLCanvasElement {
    if (NgxAdvancedImgCanvasHelper.AVAILABLE_CANVASES.length === 0) {
      // allocate more canvases if none are available for use so we can service the request immediately
      this.allocateMoreCanvases();
    }

    const canvas: HTMLCanvasElement | undefined = NgxAdvancedImgCanvasHelper.AVAILABLE_CANVASES.pop();

    if (!canvas) {
      // this should not occur because the canvas was allocated above, but if so consider batching more
      throw new Error('No canvas was available to be allocated.');
    }

    // add to the list of in use canvases
    NgxAdvancedImgCanvasHelper.IN_USE_CANVASES.push(canvas);

    return canvas;
  }

  /**
   * Returns a canvas that was in use to the queue of available canvases.
   *
   * @param canvas The canvas to return to the allocated available canvas list.
   */
  public static returnCanvas(canvas: HTMLCanvasElement): void {
    if (!canvas) {
      return;
    }

    // clear the canvas for future use
    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d', {
      desynchronized: false,
      willReadFrequently: true,
    });

    if (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    canvas.width = 0;
    canvas.height = 0;

    const inUseIndex: number = this.IN_USE_CANVASES.indexOf(canvas);

    if (inUseIndex >= 0) {
      this.IN_USE_CANVASES.splice(inUseIndex, 1);
      this.AVAILABLE_CANVASES.push(canvas);
    }
  }

  /**
   * When called, this method will reduce the number of canvases stored in the
   * static memory pool to the minimum number it can by removing available canvases.
   *
   * If canvases are actively in use, they will be exempt from the release process.
   */
  public static reducePool(): void {
    let canvas: HTMLCanvasElement | undefined | null = null;

    while (
      NgxAdvancedImgCanvasHelper.AVAILABLE_CANVASES.length > NgxAdvancedImgCanvasHelper.CANVAS_BATCH_ALLOCATION_AMOUNT
    ) {
      canvas = NgxAdvancedImgCanvasHelper.AVAILABLE_CANVASES.pop();

      if (canvas) {
        canvas = null;
      }
    }
  }

  /**
   * Generates more canvases for usage.
   */
  private static allocateMoreCanvases(): void {
    let canvas: HTMLCanvasElement;

    for (let i = 0; i < NgxAdvancedImgCanvasHelper.CANVAS_BATCH_ALLOCATION_AMOUNT; i++) {
      canvas = document.createElement('canvas');
      canvas.id = 'NgxAdvancedImgHelperCanvas_' + String(this.CANVAS_COUNT++);
      this.AVAILABLE_CANVASES.push(canvas);
    }
  }
}
