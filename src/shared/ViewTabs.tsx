import { useRef } from 'react';

interface Props<Value extends string> {
  id: string;
  label: string;
  options: readonly { value: Value; label: string }[];
  value: Value;
  onChange: (value: Value) => void;
}

/** Related views of one dataset. Panels stay mounted so changing a view never resets the work. */
export function ViewTabs<Value extends string>({ id, label, options, value, onChange }: Props<Value>): React.JSX.Element {
  const buttons = useRef(new Map<Value, HTMLButtonElement>());
  return <div className="view-tabs" role="tablist" aria-label={label} onKeyDown={event => {
    const index = options.findIndex(option => option.value === value);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
      : event.key === 'ArrowRight' ? (index + 1) % options.length
        : event.key === 'ArrowLeft' ? (index - 1 + options.length) % options.length : -1;
    const option = options[next];
    if (!option) return;
    event.preventDefault(); onChange(option.value); buttons.current.get(option.value)?.focus();
  }}>
    {options.map(option => <button key={option.value} type="button" role="tab"
      id={`${id}-${option.value}-tab`} aria-controls={`${id}-${option.value}-panel`}
      aria-selected={value === option.value} tabIndex={value === option.value ? 0 : -1}
      ref={element => { if (element) buttons.current.set(option.value, element); else buttons.current.delete(option.value); }}
      onClick={() => { onChange(option.value); }}>{option.label}</button>)}
  </div>;
}
