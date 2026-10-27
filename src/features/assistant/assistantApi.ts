import { z } from 'zod';
import { AssistantService, Subject } from '../../gen/proteinforge/assistant/v1/assistant_service_pb';
import { ApiError, validated } from '../api/apiClient';
import { callOptions, createRpcClient, rpc } from '../api/rpc';
import { isoFromTimestamp } from '../api/timestamps';
import { MAX_FACTS, MAX_LABEL_LENGTH, MAX_READING_LENGTH, MAX_UNIT_LENGTH, MAX_VALUE_LENGTH, READING_TIMEOUT_MS } from './config';
import type { ReadingSubject } from './config';

const SUBJECT_MESSAGES: Record<ReadingSubject, Subject> = {
  analysis: Subject.ANALYSIS,
  laboratory: Subject.LABORATORY,
};

export const factSchema = z.object({
  label: z.string().min(1).max(MAX_LABEL_LENGTH),
  value: z.string().min(1).max(MAX_VALUE_LENGTH),
  unit: z.string().min(1).max(MAX_UNIT_LENGTH).optional(),
});
export const readingSchema = z.object({
  text: z.string().min(1).max(MAX_READING_LENGTH),
  model: z.string().min(1),
  provider: z.string().min(1),
  createdAt: z.iso.datetime({ offset: true }),
});
export type Fact = z.infer<typeof factSchema>;
export type Reading = z.infer<typeof readingSchema>;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Readings through AssistantService. Only the figures already on screen travel; the sequence is
 * never part of the request, so this client has no field for it.
 */
export function createAssistantApi(baseUrl: string, fetchImplementation?: FetchLike) {
  const client = createRpcClient(AssistantService, baseUrl, fetchImplementation);
  return {
    async interpret(subject: ReadingSubject, language: string, facts: Fact[], token: string, signal?: AbortSignal): Promise<Reading> {
      if (!token.trim()) throw new ApiError('session');
      // Shape first: a request the contract would reject never reaches the network or the budget.
      if (facts.length === 0 || facts.length > MAX_FACTS) throw new ApiError('validation');
      const checked = facts.map((fact) => validated(factSchema, fact));
      const response = await rpc(() => client.interpret({ subject: SUBJECT_MESSAGES[subject], language, facts: checked }, { ...callOptions(signal, token), timeoutMs: READING_TIMEOUT_MS }));
      return validated(readingSchema, {
        text: response.text,
        model: response.model,
        provider: response.provider,
        createdAt: isoFromTimestamp(response.createTime),
      });
    },
  };
}
export type AssistantApi = ReturnType<typeof createAssistantApi>;
