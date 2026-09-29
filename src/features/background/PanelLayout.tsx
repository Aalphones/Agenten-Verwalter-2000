import type { ReactElement, ReactNode } from 'react';
import './PanelLayout.css';

interface PanelLayoutProps {
  list: ReactNode;
  /** `null`, solange nichts zu zeigen ist. */
  detail: ReactNode;
}

/** Die zwei Zonen unter dem Kopf des Panels: die Liste (höchstens 330 px, scrollt) und darunter das Detail. */
export function PanelLayout({ list, detail }: PanelLayoutProps): ReactElement {
  return (
    <>
      <div className="panel-layout__list">{list}</div>
      <div className="panel-layout__detail">{detail}</div>
    </>
  );
}
