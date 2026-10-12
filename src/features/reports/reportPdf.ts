import { jsPDF } from 'jspdf';
import { translate } from '../../i18n/translate';
import type { Locale } from '../../i18n/config';
import { languageTags } from '../../i18n/locale';
import { DESCRIPTOR_FIELDS } from '../descriptors/config';
import { MODE_LABEL_KEYS, TERMINAL_GAP_LABEL_KEYS } from '../alignment/config';
import { countGapColumns } from '../alignment/alignmentSummary';
import type { ScientificReport } from './reportModel';
import { PDF_LAYOUT as layout } from './config';

/** Paginated vector/text PDF. Never uses HTML rendering, screenshots or an external service. */
export function reportPdf(report: ScientificReport, locale: Locale): ArrayBuffer {
  const t = (key: Parameters<typeof translate>[1], vars?: Parameters<typeof translate>[2]) => translate(locale, key, vars);
  const format = (value: number, digits = 3) => new Intl.NumberFormat(languageTags[locale], { maximumFractionDigits: digits }).format(value);
  const document = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  document.setProperties({ title: 'ProteinForge', subject: t('report.pdfSubject'), creator: 'ProteinForge' });
  const width = layout.width - layout.margin * 2;
  let y: number = layout.margin;
  function room(height: number): void { if (y + height > layout.bottom) { document.addPage(); y = layout.margin; } }
  function text(value: string, mono = false): void {
    document.setFont(mono ? 'courier' : 'helvetica', 'normal'); document.setFontSize(mono ? layout.mono : layout.body); document.setTextColor(layout.ink);
    const lines = mono ? [value] : document.splitTextToSize(value, width) as string[];
    if (lines.length * layout.line < layout.bottom - layout.margin) room(lines.length * layout.line);
    for (const line of lines) { room(layout.line); document.text(line, layout.margin, y); y += layout.line; }
  }
  function heading(value: string, followingHeight: number = layout.line * 2): void {
    room(layout.gap * 2 + followingHeight); y += layout.gap;
    document.setFont('helvetica', 'bold'); document.setFontSize(layout.section); document.setTextColor(layout.accent); document.text(value, layout.margin, y); y += layout.gap;
  }
  document.setFont('helvetica', 'bold'); document.setFontSize(layout.title); document.setTextColor(layout.ink); document.text('ProteinForge', layout.margin, y); y += layout.gap * 2;
  text(t('report.pdfTitle')); text(report.generatedAt); text(t('report.scope')); y += layout.gap;
  if (report.source) text(t('report.source', { accession: report.source.accession, version: report.source.sequenceVersion === null ? t('report.unknownVersion') : String(report.source.sequenceVersion) }));
  if (report.sequence) {
    heading(t('editor.label'));
    text(t('report.sequenceSummary', { count: format(report.sequence.length, 0), excluded: format(report.excluded, 0) }));
    text(`SHA-256: ${report.sequenceSha256}`, true);
    for (let start = 0; start < report.sequence.length; start += layout.sequenceColumns) text(`${String(start + 1).padStart(6, ' ')}  ${report.sequence.slice(start, start + layout.sequenceColumns)}`, true);
  }
  if (report.descriptors) {
    heading(t('editor.results'));
    for (const field of DESCRIPTOR_FIELDS) {
      room(layout.line * 3);
      const value = report.descriptors[field.key];
      text(`${t(field.labelKey)}: ${format(value)}${field.unitKey ? ` ${t(field.unitKey)}` : ''}`);
      document.setTextColor(layout.muted); text(t(field.methodKey)); y += layout.line / 2;
    }
  }
  if (report.sequence) {
    heading(t('profile.title')); text(t('report.profileMethod', { window: String(report.profile.window) }));
    const numeric = report.profile.points.filter((point) => point.value !== null);
    if (numeric.length) {
      room(layout.graphHeight + layout.line * 3);
      const top = y + layout.line; const left = layout.margin + layout.gap; const graphWidth = width - layout.gap * 2;
      const min = numeric.reduce((bound, point) => Math.min(bound, point.value ?? 0), 0); const max = numeric.reduce((bound, point) => Math.max(bound, point.value ?? 0), 0);
      const span = max - min || 1;
      const x = (position: number) => left + (position - 1) / Math.max(1, report.sequence.length - 1) * graphWidth;
      const axisY = (value: number) => top + layout.graphHeight * (max - value) / span;
      document.setDrawColor(layout.border); document.line(left, axisY(0), left + graphWidth, axisY(0));
      document.setDrawColor(layout.accent); document.setLineWidth(0.4);
      const stride = Math.max(1, Math.ceil(report.profile.points.length / layout.graphMaxPoints));
      let previous: { position: number; value: number } | null = null;
      for (let index = 0; index < report.profile.points.length; index += stride) {
        const point = report.profile.points[index];
        if (!point || point.value === null) { previous = null; continue; }
        // Never bridge a missing window when drawing a sampled line.
        const gap = report.profile.points.slice(Math.max(0, index - stride), index).some((candidate) => candidate.value === null);
        if (previous && !gap) document.line(x(previous.position), axisY(previous.value), x(point.position), axisY(point.value));
        previous = { position: point.position, value: point.value };
      }
      y = top + layout.graphHeight + layout.line; text(t('report.graphAxis', { min: format(min), max: format(max), count: format(report.sequence.length, 0) }));
      text(t('report.graphSampling'));
    } else text(t('report.noProfile'));
  }
  const alignment = report.alignment?.result;
  if (alignment) {
    heading(t('alignment.result'));
    text(t('alignment.parameters', { matrix: alignment.parameters.matrix, mode: t(MODE_LABEL_KEYS[alignment.parameters.mode]), open: format(alignment.parameters.gapOpen), extend: format(alignment.parameters.gapExtend), ends: t(TERMINAL_GAP_LABEL_KEYS[alignment.parameters.terminalGaps]) }));
    text(`${t('alignment.score')}: ${format(alignment.score)} · ${t('alignment.identity')}: ${format(alignment.identities, 0)}/${format(alignment.columns, 0)} · ${t('alignment.similarity')}: ${format(alignment.similarities, 0)}/${format(alignment.columns, 0)} · ${t('alignment.gaps')}: ${format(countGapColumns(alignment), 0)}/${format(alignment.columns, 0)}`);
    for (let index = 0; index < alignment.columns; index += layout.alignmentColumns) {
      room(layout.line * 4);
      text(`${String(index + 1).padStart(6, ' ')}  ${alignment.alignedFirst.slice(index, index + layout.alignmentColumns)}`, true);
      text(`        ${alignment.marks.slice(index, index + layout.alignmentColumns)}`, true);
      text(`        ${alignment.alignedSecond.slice(index, index + layout.alignmentColumns)}`, true); y += layout.line;
    }
    text(t('alignment.legend'));
  }
  heading(t('report.methodsTitle'), layout.line * (report.references.length + 5)); text(t('report.propensityScope'));
  for (const reference of report.references) text(reference);
  const pages = document.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    document.setPage(page); document.setFont('helvetica', 'normal'); document.setFontSize(layout.small); document.setTextColor(layout.muted);
    document.text(`ProteinForge · ${String(page)} / ${String(pages)}`, layout.margin, layout.height - layout.margin / 2);
  }
  return document.output('arraybuffer');
}
