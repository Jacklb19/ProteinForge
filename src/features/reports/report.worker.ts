/// <reference lib="webworker" />
import { createReport, profileCsv, alignmentCsv } from './reportModel';
import { reportPdf } from './reportPdf';
import { CSV_MIME_TYPE } from './config';
import type { ReportRequest, ReportResponse } from './reportMessages';

const context = self as DedicatedWorkerGlobalScope;
context.onmessage = (event: MessageEvent<ReportRequest>) => {
  const { id, format, input, locale } = event.data;
  void (async () => {
    try {
      const report = await createReport(input);
      const content = format === 'pdf' ? reportPdf(report, locale) : format === 'json' ? JSON.stringify(report, null, 2) : format === 'profile' ? profileCsv(report) : alignmentCsv(report);
      const blob = new Blob([content], { type: format === 'pdf' ? 'application/pdf' : format === 'json' ? 'application/json' : CSV_MIME_TYPE });
      const response: ReportResponse = { id, blob };
      context.postMessage(response);
    } catch {
      const response: ReportResponse = { id, error: true };
      context.postMessage(response);
    }
  })();
};
