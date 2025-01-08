/// <reference lib="webworker" />

import { NgxAdvancedImgHeicConverter } from "../../projects/ngx-advanced-img/src/lib/classes/heic-converter";


addEventListener('message', async ({ data }) => {
  const response = `worker response to ${data}`;

  const file = data.file as File;

  const result = await NgxAdvancedImgHeicConverter.convert(file);

  console.log(result);

  postMessage(result);
});
