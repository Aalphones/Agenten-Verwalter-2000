import type { ReactElement, ReactNode, RefObject } from 'react';
import './PanelLayout.css';

interface PanelLayoutProps {
  /** Das scrollende Listen-Element; die virtuelle Liste darin misst daran. */
  listRef: RefObject<HTMLDivElement | null>;
  list: ReactNode;
  /** `null`, solange nichts zu zeigen ist. */
  detail: ReactNode;
}

/** Die zwei Zonen unter dem Kopf des Panels: die Liste (höchstens 330 px, scrollt) und darunter das Detail. */
export function PanelLayout({ listRef, list, detail }: PanelLayoutProps): ReactElement {
  return (
    <>
      <div ref={listRef} className="panel-layout__list">
        {list}
      </div>
      <div className="panel-layout__detail">{detail}</div>
    </>
  );
}
