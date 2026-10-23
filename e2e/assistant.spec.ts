import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { spanish } from '../src/i18n/es';
import { InterpretRequestSchema, InterpretResponseSchema, Subject } from '../src/gen/proteinforge/assistant/v1/assistant_service_pb';
import { ROUTES } from '../src/shared/navigation';
import { required } from '../src/features/design-lab/config';
import { assertFits, message, storeSession } from './helpers';
import { fulfillRpc, fulfillRpcError, GRPC_CODES, isRpc, rpcMethod, rpcRequest } from './rpc';

const READING = 'Estos son los resultados de un análisis computacional.\n\nEl punto isoeléctrico es 4,81, el pH en el que la carga neta sería cero.';
const MODEL = 'openai/gpt-oss-120b';

interface Calls { requests: { subject: Subject; language: string; facts: { label: string; value: string; unit?: string }[] }[] }

/** Answers AssistantService; every other RPC keeps failing loudly, as in the other suites. */
async function mockAssistant(page: Page, outcome: 'ok' | 'rate-limit' = 'ok'): Promise<Calls> {
  const calls: Calls = { requests: [] };
  await storeSession(page);
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!isRpc(url)) { await route.fallback(); return; }
    if (rpcMethod(route) !== 'AssistantService/Interpret') { await route.abort(); return; }
    const request = rpcRequest(route, InterpretRequestSchema);
    calls.requests.push({ subject: request.subject, language: request.language, facts: request.facts.map((fact) => ({ label: fact.label, value: fact.value, unit: fact.unit })) });
    if (outcome === 'rate-limit') { await fulfillRpcError(route, GRPC_CODES.resourceExhausted, 'assistant-rate-limit'); return; }
    await fulfillRpc(route, InterpretResponseSchema, { text: READING, model: MODEL, provider: 'groq', createTime: { seconds: 1792800000n, nanos: 0 } });
  });
  return calls;
}

test('reads the analysis, sends only its figures and lists them beside the text', async ({ page }) => {
  const calls = await mockAssistant(page);
  await page.goto(ROUTES.analyze);
  const reading = page.locator('.reading');
  await expect(reading.getByRole('heading', { name: spanish['assistant.title'] })).toBeVisible();
  await reading.getByRole('button', { name: spanish['assistant.read.analysis'] }).click();
  await expect(reading.getByText('El punto isoeléctrico es 4,81, el pH en el que la carga neta sería cero.')).toBeVisible();
  await expect(reading.getByText(spanish['assistant.sources'])).toBeVisible();
  await expect(reading.getByText(MODEL, { exact: false })).toBeVisible();

  const sent = required(calls.requests[0]);
  expect(sent.subject).toBe(Subject.ANALYSIS);
  expect(sent.language).toBe('es');
  // The figures carry the labels and the formatting of the screen, and the sequence is not among them.
  expect(sent.facts.map((fact) => fact.label)).toContain(spanish['descriptors.isoelectricPoint']);
  const payload = JSON.stringify(sent.facts);
  expect(payload).not.toContain('MALWMRLLPLLALLALWGPDPAAA');
  expect(payload).toMatch(/\d+,\d+/);
});

test('a reading does not survive the figures it describes', async ({ page }) => {
  await mockAssistant(page);
  await page.goto(ROUTES.analyze);
  const reading = page.locator('.reading');
  await reading.getByRole('button', { name: spanish['assistant.read.analysis'] }).click();
  await expect(reading.getByText(spanish['assistant.sources'])).toBeVisible();
  // Changing the profile window changes the figures; the previous reading stops being shown.
  await page.getByRole('radio', { name: '19', exact: true }).click();
  await expect(reading.getByText(spanish['assistant.sources'])).toHaveCount(0);
  await expect(reading.getByRole('button', { name: spanish['assistant.read.analysis'] })).toBeVisible();
});

test('a refused reading is explained and leaves the action usable', async ({ page }) => {
  await mockAssistant(page, 'rate-limit');
  await page.goto(ROUTES.analyze);
  const reading = page.locator('.reading');
  await reading.getByRole('button', { name: spanish['assistant.read.analysis'] }).click();
  await expect(reading.getByText(spanish['assistant.rateLimit'])).toBeVisible();
  await expect(reading.getByText(spanish['assistant.sources'])).toHaveCount(0);
  await expect(reading.getByRole('button', { name: spanish['assistant.read.analysis'] })).toBeEnabled();
});

test('the laboratory reading leaves the figures of an edited draft out', async ({ page }) => {
  const calls = await mockAssistant(page);
  await page.goto(ROUTES.laboratory);
  await expect(page.locator('.lab-table tbody tr')).toHaveCount(3);
  const reading = page.locator('.reading');
  await reading.getByRole('button', { name: spanish['assistant.read.laboratory'] }).click();
  await expect(reading.getByText(spanish['assistant.sources'])).toBeVisible();
  expect(required(calls.requests[0]).subject).toBe(Subject.LABORATORY);
  expect(required(calls.requests[0]).facts.map((fact) => fact.label)).toContain(message('assistant.factRmsd'));

  // After a substitution the past prediction no longer describes the draft, so its figures are not sent.
  await page.getByRole('combobox', { name: spanish['lab.replaceWith'] }).selectOption('A');
  await page.getByRole('button', { name: spanish['lab.applyReplacement'], exact: true }).click();
  await reading.getByRole('button', { name: spanish['assistant.read.laboratory'] }).click();
  await expect(reading.getByText(spanish['assistant.sources'])).toBeVisible();
  const second = required(calls.requests[1]);
  expect(second.facts.map((fact) => fact.label)).not.toContain(message('assistant.factRmsd'));
  expect(second.facts.map((fact) => fact.label)).toContain(message('assistant.factDraft'));
});

test('without a session the reading offers to sign in instead of the action', async ({ page }) => {
  const calls: Calls = { requests: [] };
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!isRpc(url)) { await route.fallback(); return; }
    await route.abort();
  });
  await page.goto(ROUTES.analyze);
  const reading = page.locator('.reading');
  await expect(reading.getByText(spanish['assistant.signInHelp'])).toBeVisible();
  await expect(reading.getByRole('button', { name: spanish['assistant.read.analysis'] })).toHaveCount(0);
  expect(calls.requests).toHaveLength(0);
});

test('reopening a laboratory dataset retires its reading even when variant identifiers are reused', async ({ page }) => {
  await mockAssistant(page);
  await page.goto(ROUTES.laboratory);
  const reading = page.locator('.reading');
  await reading.getByRole('button', { name: spanish['assistant.read.laboratory'] }).click();
  await expect(reading.getByText(spanish['assistant.sources'])).toBeVisible();

  await page.getByRole('button', { name: spanish['lab.openExample'] }).click();
  await expect(reading.getByText(spanish['assistant.sources'])).toHaveCount(0);
  await expect(reading.getByRole('button', { name: spanish['assistant.read.laboratory'] })).toBeEnabled();
});

for (const width of [360, 1280]) {
  test(`the reading fits ${String(width)}px with AA in both themes`, async ({ page }) => {
    await mockAssistant(page);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(ROUTES.analyze);
    const reading = page.locator('.reading');
    await reading.getByRole('button', { name: spanish['assistant.read.analysis'] }).click();
    await expect(reading.getByText(spanish['assistant.sources'])).toBeVisible();
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      await assertFits(page);
      expect((await new AxeBuilder({ page }).include('.reading').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
      await reading.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `artifacts/assistant-reading-${String(width)}-${theme}.png`, fullPage: true });
    }
  });
}
