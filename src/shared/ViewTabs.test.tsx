import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it } from 'vitest';
import { ViewTabs } from './ViewTabs';

function Example() {
  const [view, setView] = useState('summary');
  return <><ViewTabs id="test" label="Views" options={[{ value: 'summary', label: 'Summary' }, { value: 'sequence', label: 'Sequence' }]} value={view} onChange={setView} />
    <section id="test-summary-panel" role="tabpanel" aria-labelledby="test-summary-tab" hidden={view !== 'summary'}><input aria-label="Draft" defaultValue="ACD" /></section>
    <section id="test-sequence-panel" role="tabpanel" aria-labelledby="test-sequence-tab" hidden={view !== 'sequence'}>ACD</section></>;
}

it('uses roving focus, wraps arrow navigation and retains work in hidden panels', async () => {
  const user = userEvent.setup(); render(<Example />);
  await user.type(screen.getByRole('textbox', { name: 'Draft' }), 'E');
  const summary = screen.getByRole('tab', { name: 'Summary' });
  summary.focus(); await user.keyboard('{ArrowLeft}');
  expect(screen.getByRole('tab', { name: 'Sequence' })).toHaveFocus();
  expect(screen.getByRole('tabpanel', { name: 'Sequence' })).toBeVisible();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  await user.keyboard('{Home}');
  expect(summary).toHaveFocus(); expect(summary).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveValue('ACDE');
  await user.keyboard('{End}{ArrowRight}'); expect(summary).toHaveFocus();
  expect(screen.getAllByRole('tab').filter(tab => tab.tabIndex === 0)).toEqual([summary]);
});
