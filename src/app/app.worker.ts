/// <reference lib="webworker" />

import { NgxAdvancedImgHeicConverter } from "../../projects/ngx-advanced-img/src/lib/classes/heic-converter";


addEventListener('message', async ({ data }) => {
  const file = data.file as File;
  const mimeType = data.mimeType as string;

  const result = await NgxAdvancedImgHeicConverter.convert(file, mimeType);

  postMessage(result);
});
