import { useId } from 'react';

interface Option<T extends string | number> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  legend: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  describedBy?: string;
}

/** Mutually exclusive choices as native radio buttons, styled as a segmented control. */
export function SegmentedControl<T extends string | number>({ legend, options, value, onChange, describedBy }: Props<T>): React.JSX.Element {
  const name = useId();
  return (
    <fieldset className="segmented" aria-describedby={describedBy}>
      <legend>{legend}</legend>
      <div className="segmented-options">
        {options.map((option) => (
          <label key={String(option.value)} className="segmented-option">
            <input
              type="radio"
              name={name}
              value={String(option.value)}
              checked={option.value === value}
              onChange={() => { onChange(option.value); }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
