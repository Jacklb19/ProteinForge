import { reproduceRun } from './reproduce';
import type { ReproduceRequest, ReproduceResponse } from './messages';
const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = (event: MessageEvent<ReproduceRequest>) => {
  const { id, resultJson } = event.data;
  const send = (value: ReproduceResponse): void => { worker.postMessage(value); };
  void reproduceRun(resultJson, {
    progress: (progress) => { send({ id, type: 'progress', progress }); },
    yield: () => new Promise((resolve) => { setTimeout(resolve, 0); }),
  }).then((result) => { send({ id, type: 'result', result }); }).catch(() => { send({ id, type: 'error' }); });
};
