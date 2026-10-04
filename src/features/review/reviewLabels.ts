import type { DiffLineKind } from '@/lib/bindings/DiffLineKind';
import type { ReviewComment } from '@/lib/bindings/ReviewComment';

/** „Zeile N“; bei einer gelöschten Zeile ist N die alte Nummer: „Zeile N (alt)“. */
export function lineLabel(kind: DiffLineKind, line: number): string {
  if (kind === 'deleted') {
    return `Zeile ${String(line)} (alt)`;
  }
  return `Zeile ${String(line)}`;
}

/** Teil des Pfads nach dem letzten `/`. */
export function fileName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Ortsangabe einer Kommentar-Karte: „<Repository> / <Pfad> · Zeile N“. */
export function whereLabel(comment: ReviewComment): string {
  return `${comment.repositoryName} / ${comment.path} · ${lineLabel(comment.kind, comment.line)}`;
}
