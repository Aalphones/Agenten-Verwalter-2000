import type { ReactElement } from 'react';

interface TreeToggleProps {
  /** `null`: die Zeile klappt nicht; der Platz bleibt, damit die Spalten fluchten. */
  open: boolean | null;
}

/** Das Dreieck einer Baumzeile (Stile: `.repo-tree__toggle`). */
export function TreeToggle({ open }: TreeToggleProps): ReactElement {
  const modifier: string =
    open === null ? ' repo-tree__toggle--none' : open ? ' repo-tree__toggle--open' : '';
  return (
    <span className={`repo-tree__toggle${modifier}`}>
      {open !== null && (
        <svg className="repo-tree__chevron" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M4.5 2.5 8 6l-3.5 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}
