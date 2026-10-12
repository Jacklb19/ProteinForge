import { z } from 'zod';
import { ALIGNMENT_MODES, GAP_EXTEND, GAP_OPEN, MATRIX_NAMES, MAX_ALIGNMENT_RESIDUES } from '../alignment/config';
import { HYDROPATHY_WINDOWS } from '../descriptors/config';
import { DESCRIPTOR_METHOD_VERSION, MAX_PROJECT_NAME_LENGTH, MAX_PROJECT_SEQUENCE_LENGTH } from './config';
import { sequenceSourceSchema } from '../editor/source';

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
  schemaVersion: z.literal(1), profileWindow: z.union(HYDROPATHY_WINDOWS.map((value) => z.literal(value))),
  source: sequenceSourceSchema.nullable().optional(),
  descriptors: z.object({ sequence, excluded: z.number().int().nonnegative(), methodVersion: z.literal(DESCRIPTOR_METHOD_VERSION), result: descriptorResultSchema }).nullable(),
  alignment: z.object({ first: sequence.max(MAX_ALIGNMENT_RESIDUES), second: sequence.max(MAX_ALIGNMENT_RESIDUES), matrix: z.enum(MATRIX_NAMES), mode: z.enum(ALIGNMENT_MODES), result: alignmentResultSchema.nullable() }),
});
export const projectSummarySchema = z.object({ id: z.uuid(), name: z.string().min(1).max(MAX_PROJECT_NAME_LENGTH), status: z.string(), createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }) });
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
export const projectListSchema = z.object({ items: z.array(projectSummarySchema), nextOffset: z.number().int().nonnegative().nullable() });
export type Project = z.infer<typeof projectSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type WorkspaceSnapshot = z.infer<typeof workspaceSchema>;
export interface ProjectWrite { name: string; activeSequence: string; workspace: WorkspaceSnapshot }
