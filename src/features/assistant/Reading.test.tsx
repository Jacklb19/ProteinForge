import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import { signedInFixture } from '../../test/authFixture';
import { spanish } from '../../i18n/es';
import { ApiError } from '../api/apiClient';
import { calculateDescriptors } from '../descriptors/descriptors';
import { ReadingSection } from './ReadingSection';
import { analysisFacts, laboratoryFacts } from './facts';
import type { FactWriter } from './facts';
import type { AssistantApi, Fact } from './assistantApi';
import type { LabDraft, LabVariant } from '../design-lab/types';
import { useReading } from './useReading';

const SEQUENCE = 'MQIFVKTLTGKTITLEVE';
const READING = { text: 'Primera frase de entrada.\n\nSegundo párrafo con 4,81 dentro.', model: 'openai/gpt-oss-120b', provider: 'groq', createdAt: '2026-10-23T08:00:00.000Z' };
const WRITER: FactWriter = { t: (key) => key, formatNumber: (value) => String(value) };

/** The client and its spy apart, so a call can be inspected without reading a method off the object. */
function api(behaviour?: () => Promise<typeof READING>) {
  const interpret = vi.fn<AssistantApi['interpret']>().mockImplementation(() => behaviour?.() ?? Promise.resolve(READING));
  return { client: { interpret }, interpret };
}
function mount(client: AssistantApi | null, build: () => Fact[], revision = 'r1', status: 'signed-in' | 'anonymous' = 'signed-in') {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ ...signedInFixture, status, session: status === 'signed-in' ? signedInFixture.session : null }}>
        <ReadingSection subject="analysis" build={build} revision={revision} api={client} />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}
const FACTS: Fact[] = [{ label: 'Punto isoeléctrico', value: '4,81' }, { label: 'Longitud', value: '18', unit: 'residuos' }];

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('VITE_API_BASE_URL', 'https://api.example'); });

it('removes the reading and its facts on sign-out and does not expose them to the next owner', async () => {
  const { client } = api();
  const view = mount(client, () => FACTS);
  fireEvent.click(screen.getByRole('button', { name: spanish['assistant.read.analysis'] }));
  await screen.findByText('Primera frase de entrada.');
  const content = (identity: typeof signedInFixture) => <MemoryRouter><AuthContext.Provider value={identity}>
    <ReadingSection subject="analysis" build={() => FACTS} revision="r1" api={client} />
  </AuthContext.Provider></MemoryRouter>;
  view.rerender(content({ ...signedInFixture, status: 'anonymous', session: null }));
  expect(screen.queryByText('18 residuos')).not.toBeInTheDocument();
  const session = signedInFixture.session;
  if (!session) throw new Error('The signed-in fixture must have a session.');
  view.rerender(content({ ...signedInFixture, session: { ...session, accessToken: 'second-token', user: { id: 'second', email: 'second@example.org' } } }));
  expect(screen.queryByText('Primera frase de entrada.')).not.toBeInTheDocument();
  expect(screen.queryByText('18 residuos')).not.toBeInTheDocument();
});

it('asks for a reading, shows it in paragraphs and lists the figures it sent', async () => {
  const { client, interpret } = api();
  mount(client, () => FACTS);
  fireEvent.click(screen.getByRole('button', { name: spanish['assistant.read.analysis'] }));
  expect(screen.getByText(spanish['assistant.busy'])).toBeVisible();
  await screen.findByText('Primera frase de entrada.');
  expect(screen.getByText('Segundo párrafo con 4,81 dentro.')).toBeVisible();
  expect(interpret).toHaveBeenCalledWith('analysis', 'es', FACTS, signedInFixture.session?.accessToken, expect.any(AbortSignal));
  // The figures that were sent are listed beside the text, so the reading can be checked.
  expect(screen.getByText(spanish['assistant.sources'])).toBeVisible();
  expect(screen.getByText('18 residuos')).toBeVisible();
  expect(screen.getByText(/openai\/gpt-oss-120b/)).toBeVisible();
  expect(screen.getByRole('button', { name: spanish['assistant.again'] })).toBeVisible();
});

it('drops a reading when the figures change, and never shows it beside other numbers', async () => {
  const view = mount(api().client, () => FACTS);
  fireEvent.click(screen.getByRole('button', { name: spanish['assistant.read.analysis'] }));
  await screen.findByText('Primera frase de entrada.');
  view.rerender(
    <MemoryRouter>
      <AuthContext.Provider value={signedInFixture}>
        <ReadingSection subject="analysis" build={() => FACTS} revision="r2" api={api().client} />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  expect(screen.queryByText('Primera frase de entrada.')).not.toBeInTheDocument();
  expect(screen.queryByText(spanish['assistant.sources'])).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: spanish['assistant.read.analysis'] })).toBeVisible();
});

it('explains a refusal in its own words and keeps the action available', async () => {
  mount(api(() => Promise.reject(new ApiError('rate-limit'))).client, () => FACTS);
  fireEvent.click(screen.getByRole('button', { name: spanish['assistant.read.analysis'] }));
  await screen.findByText(spanish['assistant.rateLimit']);
  expect(screen.queryByText(spanish['assistant.sources'])).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: spanish['assistant.read.analysis'] })).toBeEnabled();
});

it('offers sign-in instead of the action without a session', () => {
  mount(api().client, () => FACTS, 'r1', 'anonymous');
  expect(screen.getByText(spanish['assistant.signInHelp'])).toBeVisible();
  expect(screen.queryByRole('button', { name: spanish['assistant.read.analysis'] })).not.toBeInTheDocument();
});

it('builds the analysis facts from what the screen prints, and never the sequence', () => {
  const facts = analysisFacts(WRITER, SEQUENCE, calculateDescriptors(SEQUENCE), 19);
  const labels = facts.map((item) => item.label);
  expect(labels).toContain('descriptors.mass');
  expect(labels).toContain('assistant.factWindow');
  expect(facts.find((item) => item.label === 'assistant.factLength')?.value).toBe('18');
  expect(JSON.stringify(facts)).not.toContain(SEQUENCE);
});

it('leaves the past figures out of an edited laboratory draft', () => {
  const variant = { id: 'v1', sample: 1, sequence: SEQUENCE, meanPlddt: 93.39, ptm: 0.863, rmsd: 0.822, identicalPositions: 42 } as unknown as LabVariant;
  const untouched = { sequence: SEQUENCE, protectedPositions: [0, 5], history: [] } as LabDraft;
  const edited = { ...untouched, sequence: `A${SEQUENCE.slice(1)}` };
  expect(laboratoryFacts(WRITER, variant, untouched, '1UBQ').map((item) => item.label)).toContain('assistant.factRmsd');
  const changed = laboratoryFacts(WRITER, variant, edited, '1UBQ');
  // A substitution invalidates the prediction, so its figures are not passed off as this draft's.
  expect(changed.map((item) => item.label)).not.toContain('assistant.factRmsd');
  expect(changed.map((item) => item.label)).toContain('assistant.factDraft');
  expect(JSON.stringify(changed)).not.toContain('93.39');
});

it('stays out of the screen when the deployment has no API configured', async () => {
  vi.stubEnv('VITE_API_BASE_URL', '');
  const { container } = mount(api().client, () => FACTS);
  await waitFor(() => { expect(container.querySelector('.reading')).toBeNull(); });
});

it('keeps the newest reading when an aborted provider request resolves late', async () => {
  let finishFirst: (reading: typeof READING) => void = () => undefined;
  const first = new Promise<typeof READING>((resolve) => { finishFirst = resolve; });
  const interpret = vi.fn<AssistantApi['interpret']>()
    .mockReturnValueOnce(first)
    .mockResolvedValueOnce({ ...READING, text: 'Newest reading.' });
  const client = { interpret };
  const { result } = renderHook(() => useReading(client, 'analysis', 'test-token', () => FACTS, 'r1'));
  act(() => { result.current.read(); });
  act(() => { result.current.read(); });
  await waitFor(() => { expect(result.current.reading?.text).toBe('Newest reading.'); });

  await act(async () => { finishFirst(READING); await first; });
  expect(result.current.reading?.text).toBe('Newest reading.');
});
