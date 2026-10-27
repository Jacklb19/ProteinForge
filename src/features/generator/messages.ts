import type { SearchParameters, SearchProgress, SearchResult } from './search';
import type { ReproductionResult } from './reproduce';
export interface SearchRequest { id: number; parameters: SearchParameters }
export type SearchResponse = { id: number; type: 'progress'; progress: SearchProgress } | { id: number; type: 'result'; result: SearchResult } | { id: number; type: 'error' };
export interface ReproduceRequest { id: number; resultJson: string }
export type ReproduceResponse = { id: number; type: 'progress'; progress: SearchProgress } | { id: number; type: 'result'; result: ReproductionResult } | { id: number; type: 'error' };
