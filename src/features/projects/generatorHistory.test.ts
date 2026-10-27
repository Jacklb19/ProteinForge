import { beforeAll, describe, expect, it } from 'vitest';
import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { ProjectSummarySchema } from '../../gen/proteinforge/project/v1/project_service_pb';
import { WorkspaceSchema } from '../../gen/proteinforge/project/v1/workspace_pb';
import { toApiError } from '../api/rpc';
import { translate } from '../../i18n/translate';
import type { AlignmentDraftState } from '../alignment/alignmentDraft';
import type { GeneratorHistorySnapshot } from '../generator/history';
import { PROJECT_ERROR_KEYS } from './config';
import { projectSchema } from './contracts';
import type { Project, WorkspaceSnapshot } from './contracts';
import { summaryDocument, workspaceDocument, workspaceMessage } from './rpcMapping';
import { captureWorkspace, withGeneratorHistory, workspaceVersion } from './snapshot';
import { historyFixture, maximumExport, defaultExport } from '../../test/generatorHistoryFixture';

const ALIGNMENT: AlignmentDraftState = { first: '', second: '', matrix: 'BLOSUM62', mode: 'global', result: null, resultInput: null, warnings: [] };
const BASE: WorkspaceSnapshot = { schemaVersion: 1, profileWindow: 9, source: null, descriptors: null, alignment: { first: '', second: '', matrix: 'BLOSUM62', mode: 'global', result: null } };
const LABORATORY = { schemaVersion: 1 as const, documentJson: '{"kind":"proteinforge-laboratory"}', documentSha256: 'a'.repeat(64) };
let history: GeneratorHistorySnapshot;
function project(workspace: Record<string, unknown>): unknown {
  return { id: '00000000-0000-4000-8000-000000000010', name: 'Study', status: 'draft', createdAt: '2026-10-27T08:00:00Z', updatedAt: '2026-10-27T08:00:00.123456Z', activeSequence: 'ACD', workspace: { ...BASE, ...workspace } };
}
beforeAll(async () => { history = await historyFixture([defaultExport, maximumExport]); });

describe('workspace versions 1, 2 and 3 in the client', () => {
  it('reads saved projects of every version and keeps each version meaning', () => {
    const accepted = [{ schemaVersion: 1 }, { schemaVersion: 2, laboratory: LABORATORY }, { schemaVersion: 3 }, { schemaVersion: 3, laboratory: LABORATORY },
      { schemaVersion: 3, generatorHistory: history }, { schemaVersion: 3, laboratory: LABORATORY, generatorHistory: history }];
    for (const workspace of accepted) expect(projectSchema.safeParse(project(workspace)).success, JSON.stringify(Object.keys(workspace))).toBe(true);
    const refused = [{ schemaVersion: 1, generatorHistory: history }, { schemaVersion: 2, laboratory: LABORATORY, generatorHistory: history }, { schemaVersion: 2 },
      { schemaVersion: 4 }, { schemaVersion: 3, generatorHistory: { ...history, documentJson: '{}' } }];
    for (const workspace of refused) expect(projectSchema.safeParse(project(workspace)).success, JSON.stringify(workspace.schemaVersion)).toBe(false);
  });

  it('keeps the history and the run count through the binary RPC mapping', () => {
    const workspace: WorkspaceSnapshot = { ...BASE, schemaVersion: 3, laboratory: LABORATORY, generatorHistory: history };
    const wire = fromBinary(WorkspaceSchema, toBinary(WorkspaceSchema, create(WorkspaceSchema, workspaceMessage(workspace))));
    expect(wire.generatorHistory?.documentJson).toBe(history.documentJson);
    expect(workspaceDocument(wire)).toEqual({ ...workspace, source: null });
    const summary = create(ProjectSummarySchema, { id: 'x', name: 'Study', preview: { sequenceLength: 3, sequencePrefix: 'ACD', generatorRuns: 2 } });
    expect(summaryDocument(fromBinary(ProjectSummarySchema, toBinary(ProjectSummarySchema, summary))).preview).toMatchObject({ generatorRuns: 2 });
  });

  it('preserves laboratory and history when saving the analysis and never lowers the version', () => {
    const saved = (workspace: Record<string, unknown>): Project => projectSchema.parse(project(workspace));
    for (const [workspace, version] of [[{ schemaVersion: 1 }, 1], [{ schemaVersion: 2, laboratory: LABORATORY }, 2], [{ schemaVersion: 3 }, 3],
      [{ schemaVersion: 3, laboratory: LABORATORY, generatorHistory: history }, 3]] as const) {
      const snapshot = captureWorkspace('ACDE', ALIGNMENT, 9, undefined, saved(workspace)).workspace;
      expect(snapshot.schemaVersion).toBe(version);
      expect(snapshot.laboratory ?? null).toEqual('laboratory' in workspace ? LABORATORY : null);
      expect(snapshot.generatorHistory ?? null).toEqual('generatorHistory' in workspace ? history : null);
    }
    expect(workspaceVersion({ laboratory: LABORATORY }, 3)).toBe(3);
    expect(workspaceVersion({ generatorHistory: history }, 1)).toBe(3);
  });

  it('adds or removes the history without touching the laboratory', () => {
    const laboratory: WorkspaceSnapshot = { ...BASE, schemaVersion: 2, laboratory: LABORATORY };
    const added = withGeneratorHistory(laboratory, history);
    expect(added).toMatchObject({ schemaVersion: 3, laboratory: LABORATORY, generatorHistory: history });
    const removed = withGeneratorHistory(added, null);
    expect(removed.schemaVersion).toBe(3);
    expect(removed.laboratory).toEqual(LABORATORY);
    expect(removed).not.toHaveProperty('generatorHistory');
    expect(withGeneratorHistory(BASE, history).schemaVersion).toBe(3);
  });

  it('explains a newer stored project apart from a concurrent change, in both languages', () => {
    expect(toApiError(new ConnectError('project-requires-current-client', Code.Aborted)).code).toBe('requires-current-client');
    expect(toApiError(new ConnectError('project-conflict', Code.Aborted)).code).toBe('conflict');
    for (const locale of ['es', 'en'] as const) {
      expect(translate(locale, PROJECT_ERROR_KEYS['requires-current-client'])).not.toBe(translate(locale, PROJECT_ERROR_KEYS.conflict));
      expect(translate(locale, PROJECT_ERROR_KEYS['generator-history-size'])).toMatch(/10/);
    }
  });
});
