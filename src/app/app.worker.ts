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
