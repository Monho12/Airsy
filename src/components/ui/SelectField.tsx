// Шошготой сонголтын талбар (`<select>`) — шүүлтийн мөрөнд (CLAUDE.md §8.8: шошго үргэлж холбогдсон, гараар удирдана).
import { useId } from 'react';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  const id = useId();
  return (
    <span className="ui-select-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="ui-select"
        value={value}
        onChange={(event) => {
          // Сонголт зөвхөн options-ийн утгаас ирнэ
          const next = options.find((option) => option.value === event.target.value);
          if (next !== undefined) onChange(next.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  );
}
