import type { ReactElement } from 'react';
import './TldrSkeleton.css';

export type TldrSkeletonKind = 'session' | 'project';

interface TldrSkeletonProps {
  kind: TldrSkeletonKind;
  text: string;
}

/** Drei Platzhalterbalken und ein Satz, solange noch kein TL;DR da ist und eins entsteht. */
export function TldrSkeleton({ kind, text }: TldrSkeletonProps): ReactElement {
  return (
    <div className={`tldr-skeleton tldr-skeleton--${kind}`}>
      <span className="tldr-skeleton__bar" />
      <span className="tldr-skeleton__bar" />
      <span className="tldr-skeleton__bar" />
      <p className="tldr-skeleton__text">{text}</p>
    </div>
  );
}
