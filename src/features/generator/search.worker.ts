import { searchCandidates } from './search';
import type { SearchRequest, SearchResponse } from './messages';
const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = (event: MessageEvent<SearchRequest>) => {
  const { id, parameters } = event.data;
  const send = (value: SearchResponse): void => { worker.postMessage(value); };
  void searchCandidates(parameters, {
    progress: (progress) => { send({ id, type: 'progress', progress }); },
    yield: () => new Promise((resolve) => { setTimeout(resolve, 0); }),
  }).then((result) => { send({ id, type: 'result', result }); }).catch(() => { send({ id, type: 'error' }); });
};
