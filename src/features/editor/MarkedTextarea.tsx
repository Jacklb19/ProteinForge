import { useRef } from 'react';

/** Splits the text so each invalid character can be marked in place, as the sequence editor does. */
function markInvalid(text: string, invalidPositions: readonly number[]): React.ReactNode[] {
  const fragments: React.ReactNode[] = [];
  let start = 0;
  for (const position of invalidPositions) {
    if (position > start) fragments.push(text.slice(start, position));
    fragments.push(<mark key={position} className="invalid-residue">{text[position]}</mark>);
    start = position + 1;
  }
  if (start < text.length) fragments.push(text.slice(start));
  return fragments;
}

interface MarkedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'onScroll'> {
  value: string;
  invalidPositions: readonly number[];
  onValueChange: (value: string) => void;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
}

/**
 * A sequence box with its invalid characters marked in place: a transparent textarea over a copy of the
 * text, the same overlay the sequence editor in Analyze uses. The copy follows the box when it scrolls.
 */
export function MarkedTextarea({ value, invalidPositions, onValueChange, textareaRef, ...textarea }: MarkedTextareaProps): React.JSX.Element {
  const highlight = useRef<HTMLPreElement>(null);
  return (
    <div className="editor-layer">
      <pre aria-hidden="true" className="editor-highlight" ref={highlight}>{markInvalid(value, invalidPositions)}{'\n'}</pre>
      <textarea
        {...textarea}
        ref={textareaRef}
        value={value}
        aria-invalid={invalidPositions.length > 0}
        onChange={(event) => { onValueChange(event.target.value); }}
        onScroll={(event) => {
          if (!highlight.current) return;
          highlight.current.scrollTop = event.currentTarget.scrollTop;
          highlight.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
      />
    </div>
  );
}
