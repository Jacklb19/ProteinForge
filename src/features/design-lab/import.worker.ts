/// <reference lib="webworker" />
import { LabError } from './config';
import { loadExample } from './validate';
import { exportWorkspace, importLab } from './workspace';
import type { LabRequest, LabResponse } from './types';

const send = (response: LabResponse, transfer: Transferable[] = []): void => { self.postMessage(response,transfer); };
self.onmessage = (event: MessageEvent<LabRequest>): void => {
  const request = event.data;
  void (async () => {
    if (request.type === 'export') {
      const bytes = await exportWorkspace(request.archive,request.state); send({id:request.id,type:'export',bytes},[bytes.buffer]); return;
    }
    const result = request.type === 'example' ? await loadExample() : await importLab(request.bytes,progress => { send({id:request.id,type:'progress',progress}); });
    send({id:request.id,type:'result',result},result.archive ? [result.archive] : []);
  })().catch((error: unknown) => { send({id:request.id,type:'error',code:error instanceof LabError ? error.code : 'schema'}); });
};
