import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../i18n';
import { translate } from '../../i18n/translate';
import type { TranslationKey } from '../../i18n';
import { ProjectCard } from './ProjectCard';
import type { ProjectDestination } from './ProjectCard';
import type { ProjectSummary } from './contracts';

const DATE = '2026-10-19T10:00:00.123456Z';
const message = (key: TranslationKey, variables: Record<string, string | number> = {}): string => translate('es', key, variables);
const summary = (name: string, preview: ProjectSummary['preview']): ProjectSummary =>
  ({ id: '00000000-0000-4000-8000-000000000010', name, status: 'draft', createdAt: DATE, updatedAt: DATE, preview });
const ANALYSIS = { sequenceLength: 110, sequencePrefix: 'ACDE', excluded: 0, descriptors: null, source: { origin: 'catalog' as const, accession: 'P01308' }, alignment: null };
const COMPARISON = { firstLength: 110, secondLength: 105, firstPrefix: 'ACDE', secondPrefix: 'ACDF', matrix: 'BLOSUM80' as const, mode: 'global' as const, result: { identities: 88, similarities: 90, columns: 110 } };

function card(project: ProjectSummary, onOpen: (destination?: ProjectDestination) => void = vi.fn()) {
  return render(<LocaleProvider locale="es"><ProjectCard project={project} busy={false} active={false} dirty={false} onOpen={onOpen} onAction={vi.fn()} /></LocaleProvider>);
}

it('offers one destination for an analysis and both for a mixed project', async () => {
  const user = userEvent.setup();
  const onOpen = vi.fn();
  const view = card(summary('Insulina humana', ANALYSIS), onOpen);
  expect(screen.getByText(message('projects.analysis'))).toBeVisible();
  expect(screen.queryByRole('button', { name: message('projects.openAlignmentNamed', { name: 'Insulina humana' }) })).not.toBeInTheDocument();
  view.unmount();

  card(summary('Mixto', { ...ANALYSIS, alignment: COMPARISON }), onOpen);
  expect(screen.getByText(message('projects.mixed'))).toBeVisible();
  await user.click(screen.getByRole('button', { name: message('projects.openAnalysisNamed', { name: 'Mixto' }) }));
  await user.click(screen.getByRole('button', { name: message('projects.openAlignmentNamed', { name: 'Mixto' }) }));
  expect(onOpen.mock.calls).toEqual([['analyze'], ['alignment']]);
  // Saved evidence is shown as it was stored, never recalculated by the card.
  const metrics = screen.getByRole('region', { name: message('projects.comparison') });
  expect(metrics).toHaveTextContent('80%');
  expect(metrics).toHaveTextContent('81,8%');
  expect(metrics).toHaveTextContent('BLOSUM80');
});

it('announces a comparison without analysis and a laboratory with its variants', async () => {
  const user = userEvent.setup();
  const onOpen = vi.fn();
  const view = card(summary('Comparación', { sequenceLength: 0, sequencePrefix: '', excluded: 0, descriptors: null, source: null, alignment: { ...COMPARISON, result: null } }), onOpen);
  expect(screen.getByText(message('projects.comparison'), { selector: '.project-kind' })).toBeVisible();
  expect(screen.getByText(message('projects.noAlignment'), { exact: false })).toBeVisible();
  expect(screen.queryByRole('button', { name: message('projects.openAnalysisNamed', { name: 'Comparación' }) })).not.toBeInTheDocument();
  view.unmount();

  card(summary('Laboratorio', { ...ANALYSIS, hasLaboratory: true, laboratoryVariants: 1 }), onOpen);
  expect(screen.getByText(message('lab.projectVariantsOne', { count: 1 }))).toBeVisible();
  await user.click(screen.getByRole('button', { name: message('lab.openProjectNamed', { name: 'Laboratorio' }) }));
  expect(onOpen).toHaveBeenCalledWith('laboratory');
});

it('says when a project has no saved evidence instead of inventing it', () => {
  card(summary('Sin vista previa', null));
  expect(screen.getByText(message('projects.noPreview'))).toBeVisible();
  expect(screen.getByRole('button', { name: message('projects.openNamed', { name: 'Sin vista previa' }) })).toBeVisible();
});
