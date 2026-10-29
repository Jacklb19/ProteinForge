import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorPage } from '../editor/EditorPage';
import { calculateDescriptors } from './descriptors';
import type { DescriptorResponse, DescriptorRequest } from './messages';
import { WorkspaceProviders } from '../../test/WorkspaceProviders';
import { spanish } from '../../i18n/es';
import { DEFAULT_LOCALE, languageTags } from '../../i18n/config';
import { translate } from '../../i18n/translate';

class MockWorker {
  static instances: MockWorker[] = [];
  url: string;
  onmessage: ((event: MessageEvent<DescriptorResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn<(message: DescriptorRequest) => void>();
  terminate = vi.fn();

  constructor(url: URL | string) {
    this.url = String(url);
    MockWorker.instances.push(this);
  }
}

function descriptorWorker(): MockWorker {
  const worker = MockWorker.instances.find((instance) => instance.url.includes('descriptors.worker'));
  if (!worker) throw new Error('The descriptor worker was not created.');
  return worker;
}

function requestAt(worker: MockWorker, index: number): DescriptorRequest {
  const request = worker.postMessage.mock.calls[index]?.[0];
  if (!request) throw new Error('The expected request is missing.');
  return request;
}

/** Definition paired with a descriptor label: its value, unit and short reading. */
function definition(panel: HTMLElement, label: string): HTMLElement {
  const element = within(panel).getByText(label, { selector: 'dt' }).nextElementSibling;
  if (!(element instanceof HTMLElement)) throw new Error('The descriptor value is missing.');
  return element;
}

afterEach(() => {
  vi.unstubAllGlobals();
  MockWorker.instances = [];
});

describe('descriptors in the editor', () => {
  it('keeps prior values faded and does not calculate invalid input', () => {
    vi.stubGlobal('Worker', MockWorker);
    render(<EditorPage />, { wrapper: WorkspaceProviders });
    const editor = screen.getByRole('textbox', { name: spanish['editor.label'] });
    fireEvent.change(editor, { target: { value: 'ACDE' } });
    const worker = descriptorWorker();
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    const request = requestAt(worker, 0);
    expect(request.sequence).toBe('ACDE');
    act(() => {
      worker.onmessage?.(new MessageEvent('message', {
        data: { id: request.id, result: calculateDescriptors('ACDE') },
      }));
    });
    const panel = screen.getByRole('region', { name: spanish['descriptors.title'] });
    const mass = new Intl.NumberFormat(languageTags[DEFAULT_LOCALE], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(calculateDescriptors('ACDE').massDa);
    const previousMass = definition(panel, spanish['descriptors.mass']).textContent;
    expect(previousMass).toBe(`${mass} ${spanish['units.dalton']}${spanish['guide.mass']}`);
    expect(definition(panel, spanish['descriptors.mass']).querySelector('.property-unit')).toHaveTextContent(spanish['units.dalton']);
    expect(panel.querySelector('dl')).toHaveClass('property-list');
    expect(panel.querySelector('dl')).not.toHaveClass('stale-descriptors');
    expect(within(panel).getByText(spanish['guide.methods'], { selector: 'summary' }).closest('details')).toHaveTextContent(`${spanish['descriptors.mass']}: ${spanish['descriptors.massMethod']}`);

    fireEvent.change(editor, { target: { value: 'AC-DE' } });
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect(within(panel).getByText(spanish['descriptors.invalid'])).toBeInTheDocument();
    expect(definition(panel, spanish['descriptors.mass']).textContent).toBe(previousMass);
    expect(panel.querySelector('dl')).toHaveClass('stale-descriptors');
  });

  it('excludes additional residues and shows their count', () => {
    vi.stubGlobal('Worker', MockWorker);
    render(<EditorPage />, { wrapper: WorkspaceProviders });
    fireEvent.change(screen.getByRole('textbox', { name: spanish['editor.label'] }), { target: { value: 'ACXDO' } });
    expect(requestAt(descriptorWorker(), 0).sequence).toBe('ACD');
    expect(screen.getByText(translate(DEFAULT_LOCALE, 'descriptors.excluded', { count: 2 }))).toBeInTheDocument();
  });

  it('ignores a response older than the latest valid edit', () => {
    vi.stubGlobal('Worker', MockWorker);
    render(<EditorPage />, { wrapper: WorkspaceProviders });
    const editor = screen.getByRole('textbox', { name: spanish['editor.label'] });
    fireEvent.change(editor, { target: { value: 'ACDE' } });
    const worker = descriptorWorker();
    const first = requestAt(worker, 0);
    fireEvent.change(editor, { target: { value: 'ACDF' } });
    const second = requestAt(worker, 1);
    act(() => {
      worker.onmessage?.(new MessageEvent('message', {
        data: { id: first.id, result: calculateDescriptors('ACDE') },
      }));
    });
    // The stale answer is discarded: the fields keep their place, marked as pending and busy.
    const fields = screen.getByText(spanish['descriptors.mass']).closest('dl');
    expect(fields).toHaveAttribute('aria-busy', 'true');
    expect(within(fields as HTMLElement).getAllByText(spanish['descriptors.pendingValue'])).toHaveLength(5);
    expect(screen.getByText(spanish['descriptors.calculating'])).toHaveAttribute('role', 'status');
    act(() => {
      worker.onmessage?.(new MessageEvent('message', {
        data: { id: second.id, result: calculateDescriptors('ACDF') },
      }));
    });
    expect(fields).not.toHaveAttribute('aria-busy');
    expect(within(fields as HTMLElement).queryByText(spanish['descriptors.pendingValue'])).not.toBeInTheDocument();
  });
});
