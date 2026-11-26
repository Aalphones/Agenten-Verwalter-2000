import type { ReactElement } from 'react';

interface FolderIconProps {
  open: boolean;
}

/** Ordner-Symbol einer Baumzeile (Stile: `.repo-tree__folder`). Rein schmückend. */
export function FolderIcon({ open }: FolderIconProps): ReactElement {
  return (
    <svg
      className="repo-tree__folder"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path
        d={
          open
            ? 'M1.5 12V4.2c0-.7.5-1.2 1.2-1.2h3l1.4 1.5h5.2c.7 0 1.2.5 1.2 1.2V7M1.6 12.2 3.4 7.6c.1-.4.5-.6.9-.6h9.9c.5 0 .8.5.6.9l-1.6 4.4c-.1.4-.5.7-.9.7H2.2c-.4 0-.7-.4-.6-.8z'
            : 'M1.5 4.2c0-.7.5-1.2 1.2-1.2h3l1.4 1.5h6.2c.7 0 1.2.5 1.2 1.2v6.1c0 .7-.5 1.2-1.2 1.2H2.7c-.7 0-1.2-.5-1.2-1.2z'
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
