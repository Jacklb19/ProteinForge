import type { SearchParameters, SearchProgress, SearchResult } from './search';
export interface SearchRequest { id: number; parameters: SearchParameters }
export type SearchResponse = { id: number; type: 'progress'; progress: SearchProgress } | { id: number; type: 'result'; result: SearchResult } | { id: number; type: 'error' };
