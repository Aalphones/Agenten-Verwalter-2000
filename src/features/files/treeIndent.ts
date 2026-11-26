import type { CSSProperties } from 'react';

/** Einzug und Hilfslinien je Ebene einer Baumzeile (`.repo-tree__row`); sie ergeben sich zur Laufzeit. */
export function treeIndent(depth: number): CSSProperties {
  const style: CSSProperties & Record<'--depth', number> = {
    paddingLeft: `calc(var(--space-md) + ${String(depth)} * 14px)`,
    '--depth': depth,
  };
  return style;
}
