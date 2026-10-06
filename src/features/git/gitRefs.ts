const LOCAL_PREFIX = 'refs/heads/';
const REMOTE_PREFIX = 'refs/remotes/';
const TAG_PREFIX = 'tag: refs/tags/';

export type RefKind = 'local' | 'remote' | 'tag';

export interface RefMark {
  kind: RefKind;
  label: string;
}

const KIND_ORDER: readonly RefKind[] = ['local', 'remote', 'tag'];

/** Marken eines Commits aus den vollen Ref-Namen des Core; was weder Branch noch Tag ist (Stash, Pull-Requests),
 *  fällt weg. Lokale Branches zuerst, dann Remote-Branches, dann Tags. */
export function refMarks(refs: readonly string[]): RefMark[] {
  const marks: RefMark[] = [];
  for (const reference of refs) {
    if (reference.startsWith(LOCAL_PREFIX)) {
      marks.push({ kind: 'local', label: reference.slice(LOCAL_PREFIX.length) });
    } else if (reference.startsWith(REMOTE_PREFIX)) {
      marks.push({ kind: 'remote', label: reference.slice(REMOTE_PREFIX.length) });
    } else if (reference.startsWith(TAG_PREFIX)) {
      marks.push({ kind: 'tag', label: reference.slice(TAG_PREFIX.length) });
    }
  }
  return marks.sort(
    (left: RefMark, right: RefMark) =>
      KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind),
  );
}
