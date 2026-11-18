import type { ReactElement, ReactNode } from 'react';
import './FilesSegment.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

interface FilesSegmentProps<T extends string> {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Umschalter aus Knöpfen mit Trennlinien; der gewählte trägt eine Akzentlinie unten. */
export function FilesSegment<T extends string>({
  label,
  options,
  value,
  onChange,
}: FilesSegmentProps<T>): ReactElement {
  return (
    <div className="files-segment" role="group" aria-label={label}>
      {options.map((option: SegmentOption<T>) => (
        <button
          key={option.value}
          type="button"
          className="files-segment__button"
          aria-pressed={option.value === value}
          title={option.title}
          onClick={(): void => {
            onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
