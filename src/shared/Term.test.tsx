import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { LocaleProvider } from '../i18n';
import { spanish } from '../i18n/es';
import { Glossed } from './Term';

function mount(text: string) {
  return render(<LocaleProvider locale="es"><p><Glossed text={text} terms={['asymmetricUnit', 'plddt']} /></p></LocaleProvider>);
}

it('turns each term of a sentence into a button that opens its definition below', () => {
  mount(`Primer modelo de la ${spanish['glossary.asymmetricUnitPhrase']} y su ${spanish['glossary.plddtPhrase']} local.`);
  const unit = screen.getByRole('button', { name: spanish['glossary.asymmetricUnitPhrase'] });
  expect(unit).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByText('Primer modelo de la', { exact: false })).toBeInTheDocument();
  fireEvent.click(unit);
  expect(unit).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('note')).toHaveTextContent(spanish['glossary.asymmetricUnit']);
  expect(unit).toHaveAttribute('aria-controls', screen.getByRole('note').id);
});

it('keeps one definition open at a time and closes with Escape, leaving the focus on the term', () => {
  mount(`${spanish['glossary.asymmetricUnitPhrase']} · ${spanish['glossary.plddtPhrase']}`);
  const unit = screen.getByRole('button', { name: spanish['glossary.asymmetricUnitPhrase'] });
  const plddt = screen.getByRole('button', { name: spanish['glossary.plddtPhrase'] });
  fireEvent.click(unit);
  fireEvent.click(plddt);
  expect(unit).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getAllByRole('note')).toHaveLength(1);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('note')).toBeNull();
  expect(plddt).toHaveFocus();
});

it('leaves a sentence without terms as plain text', () => {
  const { container } = mount('Sin términos aquí.');
  expect(container.querySelector('button')).toBeNull();
  expect(container).toHaveTextContent('Sin términos aquí.');
});
