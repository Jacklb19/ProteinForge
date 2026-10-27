import type { MessageInitShape } from '@bufbuild/protobuf';
import { ProjectStatus } from '../../gen/proteinforge/project/v1/project_service_pb';
import type { Project as ProjectMessage, ProjectSummary as SummaryMessage } from '../../gen/proteinforge/project/v1/project_service_pb';
import { AlignmentMode, SourceOrigin, SubstitutionMatrix, TerminalGaps } from '../../gen/proteinforge/project/v1/workspace_pb';
import type { Workspace as WorkspaceMessage, WorkspaceSchema } from '../../gen/proteinforge/project/v1/workspace_pb';
import { isoFromTimestamp, timestampFromIso } from '../api/timestamps';
import type { MatrixName, AlignmentMode as ModeName } from '../alignment/config';
import type { SequenceSource } from '../editor/source';
import type { WorkspaceSnapshot } from './contracts';

type TerminalGapsName = 'free' | 'not-applicable';

const MATRICES: Record<MatrixName, SubstitutionMatrix> = { BLOSUM45: SubstitutionMatrix.BLOSUM45, BLOSUM62: SubstitutionMatrix.BLOSUM62, BLOSUM80: SubstitutionMatrix.BLOSUM80 };
const MODES: Record<ModeName, AlignmentMode> = { global: AlignmentMode.GLOBAL, local: AlignmentMode.LOCAL };
const TERMINAL_GAPS: Record<TerminalGapsName, TerminalGaps> = { free: TerminalGaps.FREE, 'not-applicable': TerminalGaps.NOT_APPLICABLE };
const ORIGINS: Record<SequenceSource['origin'], SourceOrigin> = { catalog: SourceOrigin.CATALOG, uniprot: SourceOrigin.UNIPROT };
const STATUSES: Partial<Record<ProjectStatus, string>> = { [ProjectStatus.DRAFT]: 'draft' };

/** Reverse lookup; an unknown wire value becomes undefined and fails the contract validation. */
function nameOf<Name extends string>(mapping: Record<Name, number>, value: number): Name | undefined {
  return (Object.keys(mapping) as Name[]).find((name) => mapping[name] === value);
}

export function workspaceMessage(workspace: WorkspaceSnapshot): MessageInitShape<typeof WorkspaceSchema> {
  const { source, descriptors, alignment } = workspace;
  const result = alignment.result;
  return {
    schemaVersion: workspace.schemaVersion,
    profileWindow: workspace.profileWindow,
    laboratory: workspace.laboratory ?? undefined,
    generatorHistory: workspace.generatorHistory ?? undefined,
    source: source ? {
      origin: ORIGINS[source.origin], accession: source.accession, sequence: source.sequence,
      entryVersion: source.entryVersion ?? undefined, sequenceVersion: source.sequenceVersion ?? undefined,
      retrieveTime: source.retrievedAt ? timestampFromIso(source.retrievedAt) : undefined,
    } : undefined,
    descriptors: descriptors ? { sequence: descriptors.sequence, excluded: descriptors.excluded, methodVersion: descriptors.methodVersion, result: descriptors.result } : undefined,
    alignment: {
      first: alignment.first, second: alignment.second, matrix: MATRICES[alignment.matrix], mode: MODES[alignment.mode],
      result: result ? {
        alignedFirst: result.alignedFirst, alignedSecond: result.alignedSecond, marks: result.marks, score: result.score,
        identities: result.identities, similarities: result.similarities, columns: result.columns,
        parameters: {
          matrix: MATRICES[result.parameters.matrix], mode: MODES[result.parameters.mode], gapOpen: result.parameters.gapOpen,
          gapExtend: result.parameters.gapExtend, terminalGaps: TERMINAL_GAPS[result.parameters.terminalGaps],
        },
      } : undefined,
    },
  };
}

/** Plain document in the shape of the client contract; projectSchema validates it afterwards. */
export function workspaceDocument(workspace: WorkspaceMessage | undefined): unknown {
  if (!workspace) return null;
  const { source, descriptors, alignment } = workspace;
  const result = alignment?.result;
  return {
    schemaVersion: workspace.schemaVersion,
    profileWindow: workspace.profileWindow,
    ...(workspace.laboratory ? { laboratory: { schemaVersion: workspace.laboratory.schemaVersion, documentJson: workspace.laboratory.documentJson, documentSha256: workspace.laboratory.documentSha256 } } : {}),
    ...(workspace.generatorHistory ? { generatorHistory: { schemaVersion: workspace.generatorHistory.schemaVersion, documentJson: workspace.generatorHistory.documentJson, documentSha256: workspace.generatorHistory.documentSha256 } } : {}),
    source: source ? {
      origin: nameOf(ORIGINS, source.origin), accession: source.accession, sequence: source.sequence,
      entryVersion: source.entryVersion ?? null, sequenceVersion: source.sequenceVersion ?? null, retrievedAt: isoFromTimestamp(source.retrieveTime),
    } : null,
    descriptors: descriptors ? {
      sequence: descriptors.sequence, excluded: descriptors.excluded, methodVersion: descriptors.methodVersion,
      result: descriptors.result ? { massDa: descriptors.result.massDa, isoelectricPoint: descriptors.result.isoelectricPoint, instabilityIndex: descriptors.result.instabilityIndex, aliphaticIndex: descriptors.result.aliphaticIndex, gravy: descriptors.result.gravy, length: descriptors.result.length } : null,
    } : null,
    alignment: alignment ? {
      first: alignment.first, second: alignment.second, matrix: nameOf(MATRICES, alignment.matrix), mode: nameOf(MODES, alignment.mode),
      result: result ? {
        alignedFirst: result.alignedFirst, alignedSecond: result.alignedSecond, marks: result.marks, score: result.score,
        identities: result.identities, similarities: result.similarities, columns: result.columns,
        parameters: result.parameters ? {
          matrix: nameOf(MATRICES, result.parameters.matrix), mode: nameOf(MODES, result.parameters.mode), gapOpen: result.parameters.gapOpen,
          gapExtend: result.parameters.gapExtend, terminalGaps: nameOf(TERMINAL_GAPS, result.parameters.terminalGaps),
        } : null,
      } : null,
    } : null,
  };
}

export function summaryDocument(summary: SummaryMessage | undefined): Record<string, unknown> {
  const preview = summary?.preview;
  const alignment = preview?.alignment;
  const descriptors = preview?.descriptors;
  return {
    id: summary?.id, name: summary?.name, status: summary ? STATUSES[summary.status] : undefined,
    createdAt: isoFromTimestamp(summary?.createTime), updatedAt: isoFromTimestamp(summary?.updateTime),
    ...(preview ? { preview: {
      sequenceLength: preview.sequenceLength, sequencePrefix: preview.sequencePrefix, excluded: preview.excluded,
      hasLaboratory: preview.hasLaboratory, laboratoryVariants: preview.laboratoryVariants, generatorRuns: preview.generatorRuns,
      descriptors: descriptors ? { massDa: descriptors.massDa, isoelectricPoint: descriptors.isoelectricPoint, instabilityIndex: descriptors.instabilityIndex, aliphaticIndex: descriptors.aliphaticIndex, gravy: descriptors.gravy, length: descriptors.length } : null,
      source: preview.source ? { origin: nameOf(ORIGINS, preview.source.origin), accession: preview.source.accession } : null,
      alignment: alignment ? {
        firstLength: alignment.firstLength, secondLength: alignment.secondLength, firstPrefix: alignment.firstPrefix, secondPrefix: alignment.secondPrefix,
        matrix: nameOf(MATRICES, alignment.matrix), mode: nameOf(MODES, alignment.mode),
        result: alignment.result ? { identities: alignment.result.identities, similarities: alignment.result.similarities, columns: alignment.result.columns } : null,
      } : null,
    } } : {}),
  };
}

export function projectDocument(project: ProjectMessage | undefined): unknown {
  return { ...summaryDocument(project?.summary), activeSequence: project?.activeSequence, workspace: workspaceDocument(project?.workspace) };
}
