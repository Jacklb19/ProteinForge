import { z } from 'zod';
import { ALIGNMENT_MODES, GAP_EXTEND, GAP_OPEN, MATRIX_NAMES, MAX_ALIGNMENT_RESIDUES } from '../alignment/config';
import { HYDROPATHY_WINDOWS } from '../descriptors/config';
import { DESCRIPTOR_METHOD_VERSION, MAX_PROJECT_NAME_LENGTH, MAX_PROJECT_SEQUENCE_LENGTH, PROJECT_PREVIEW_RESIDUES } from './config';
import { sequenceSourceSchema } from '../editor/sourceSchema';
import { GENERATOR_HISTORY_CONFIG } from '../generator/config';
import { generatorHistorySnapshotSchema } from '../generator/history';

const sequence = z.string().max(MAX_PROJECT_SEQUENCE_LENGTH).regex(/^[ACDEFGHIKLMNPQRSTVWYUOBZX]*$/);
export const descriptorResultSchema = z.object({
  massDa: z.number().positive(), isoelectricPoint: z.number().min(0).max(14), instabilityIndex: z.number(),
  aliphaticIndex: z.number().nonnegative(), gravy: z.number().min(-4.5).max(4.5), length: z.number().int().positive(),
});
export const alignmentResultSchema = z.object({
  alignedFirst: z.string().max(MAX_ALIGNMENT_RESIDUES * 2).regex(/^[ACDEFGHIKLMNPQRSTVWYBZX-]+$/),
  alignedSecond: z.string().max(MAX_ALIGNMENT_RESIDUES * 2).regex(/^[ACDEFGHIKLMNPQRSTVWYBZX-]+$/),
  marks: z.string().max(MAX_ALIGNMENT_RESIDUES * 2).regex(/^[|: ]+$/), score: z.number(), identities: z.number().int().nonnegative(), similarities: z.number().int().nonnegative(), columns: z.number().int().positive(),
  parameters: z.object({ matrix: z.enum(MATRIX_NAMES), mode: z.enum(ALIGNMENT_MODES), gapOpen: z.literal(GAP_OPEN), gapExtend: z.literal(GAP_EXTEND), terminalGaps: z.enum(['free', 'not-applicable']) }),
}).refine((value) => value.alignedFirst.length === value.columns && value.alignedSecond.length === value.columns && value.marks.length === value.columns && value.identities <= value.similarities && value.similarities <= value.columns);
export const workspaceSchema = z.object({
  // 1: analysis and comparison; 2: requires a laboratory; 3: laboratory and generator history optional.
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]), profileWindow: z.union(HYDROPATHY_WINDOWS.map((value) => z.literal(value))),
  laboratory: z.object({ schemaVersion: z.literal(1), documentJson: z.string().max(1_000_000), documentSha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict().nullish(),
  generatorHistory: generatorHistorySnapshotSchema.nullish(),
  source: sequenceSourceSchema.nullable().optional(),
  descriptors: z.object({ sequence, excluded: z.number().int().nonnegative(), methodVersion: z.literal(DESCRIPTOR_METHOD_VERSION), result: descriptorResultSchema }).nullable(),
  alignment: z.object({ first: sequence.max(MAX_ALIGNMENT_RESIDUES), second: sequence.max(MAX_ALIGNMENT_RESIDUES), matrix: z.enum(MATRIX_NAMES), mode: z.enum(ALIGNMENT_MODES), result: alignmentResultSchema.nullable() }),
}).refine(value => value.schemaVersion === 3 || ((value.schemaVersion === 2) === Boolean(value.laboratory) && !value.generatorHistory));
const previewPrefix = z.string().max(PROJECT_PREVIEW_RESIDUES).regex(/^[ACDEFGHIKLMNPQRSTVWYUOBZX]*$/);
const alignmentMetricsSchema = z.object({ identities: z.number().int().nonnegative(), similarities: z.number().int().nonnegative(), columns: z.number().int().positive().max(MAX_ALIGNMENT_RESIDUES * 2) }).refine(value => value.identities <= value.similarities && value.similarities <= value.columns);
export const projectPreviewSchema = z.object({
  hasLaboratory: z.boolean().optional(), laboratoryVariants: z.number().int().min(0).max(3).optional(),
  generatorRuns: z.number().int().min(0).max(GENERATOR_HISTORY_CONFIG.maxRuns).optional(),
  sequenceLength: z.number().int().nonnegative().max(MAX_PROJECT_SEQUENCE_LENGTH), sequencePrefix: previewPrefix,
  excluded: z.number().int().nonnegative(), descriptors: descriptorResultSchema.nullable(),
  source: sequenceSourceSchema.pick({ origin: true, accession: true }).nullable(),
  alignment: z.object({
    firstLength: z.number().int().nonnegative().max(MAX_ALIGNMENT_RESIDUES), secondLength: z.number().int().nonnegative().max(MAX_ALIGNMENT_RESIDUES),
    firstPrefix: previewPrefix, secondPrefix: previewPrefix, matrix: z.enum(MATRIX_NAMES), mode: z.enum(ALIGNMENT_MODES), result: alignmentMetricsSchema.nullable(),
  }).refine(a => a.firstLength + a.secondLength > 0 && a.firstPrefix.length === Math.min(a.firstLength, PROJECT_PREVIEW_RESIDUES) && a.secondPrefix.length === Math.min(a.secondLength, PROJECT_PREVIEW_RESIDUES) && (!a.result || (a.firstLength > 0 && a.secondLength > 0))).nullable(),
}).refine(p => p.sequencePrefix.length === Math.min(p.sequenceLength, PROJECT_PREVIEW_RESIDUES) && p.excluded <= p.sequenceLength && (!p.descriptors || p.descriptors.length + p.excluded === p.sequenceLength));
export const projectSummarySchema = z.object({ id: z.uuid(), name: z.string().min(1).max(MAX_PROJECT_NAME_LENGTH), status: z.string(), createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }), preview: projectPreviewSchema.nullable().optional() });
export const projectSchema = projectSummarySchema.extend({ activeSequence: sequence, workspace: workspaceSchema }).refine((project) => {
  const source = project.workspace.source;
  const descriptors = project.workspace.descriptors;
  const alignment = project.workspace.alignment;
  if (source && source.sequence !== project.activeSequence) return false;
  const excluded = project.activeSequence.match(/[UOBZX]/g)?.length ?? 0;
  if (descriptors && (descriptors.sequence !== project.activeSequence || descriptors.excluded !== excluded || descriptors.result.length + descriptors.excluded !== project.activeSequence.length)) return false;
  if (alignment.result) {
    const result = alignment.result;
    if (result.parameters.matrix !== alignment.matrix || result.parameters.mode !== alignment.mode || result.parameters.terminalGaps !== (alignment.mode === 'global' ? 'free' : 'not-applicable')) return false;
    const normalize = (value: string) => value.replaceAll('U', 'C').replaceAll('O', 'K');
    if (!alignment.first || !alignment.second) return false;
    const pairs = [[result.alignedFirst, alignment.first], [result.alignedSecond, alignment.second]] as const;
    if (pairs.some(([aligned, input]) => alignment.mode === 'global' ? aligned.replaceAll('-', '') !== normalize(input) : !normalize(input).includes(aligned.replaceAll('-', '')))) return false;
    if (result.identities !== result.marks.split('|').length - 1 || result.similarities !== result.identities + result.marks.split(':').length - 1) return false;
  }
  return true;
});
export const projectListSchema = z.object({ items: z.array(projectSummarySchema), nextPageToken: z.string().min(1).nullable() });
export type Project = z.infer<typeof projectSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ProjectPreview = z.infer<typeof projectPreviewSchema>;
export type WorkspaceSnapshot = z.infer<typeof workspaceSchema>;
export interface ProjectWrite { name: string; activeSequence: string; workspace: WorkspaceSnapshot }
