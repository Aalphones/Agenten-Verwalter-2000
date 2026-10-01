import { useEffect } from 'react';
import type { ReactElement, ReactNode, RefObject } from 'react';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import { itemRowKey } from '@/features/background/buildPanelRows';
import type { PanelRow } from '@/features/background/buildPanelRows';
import './VirtualPanelList.css';

const OVERSCAN = 12;
const ESTIMATED_GROUP_HEIGHT = 22;
const SPACED_GROUP_EXTRA = 10;
const ESTIMATED_EMPTY_HEIGHT = 24;

interface VirtualPanelListProps<T> {
  rows: readonly PanelRow<T>[];
  /** Das scrollende Element (`panel-layout__list`). */
  listRef: RefObject<HTMLDivElement | null>;
  renderItem: (item: T) => ReactNode;
  estimateItem: (item: T) => number;
  /** Schlüssel des gewählten Eintrags; die Liste scrollt ihn ins Bild. */
  selectedKey: string | null;
}

/** Die Zeilen eines Panel-Reiters, nur die sichtbaren im DOM. */
export function VirtualPanelList<T>({
  rows,
  listRef,
  renderItem,
  estimateItem,
  selectedKey,
}: VirtualPanelListProps<T>): ReactElement {
  // Die Warnung gilt dem React Compiler, den das Projekt nicht nutzt; die Bibliothek schreibt ADR 002 vor.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: (): HTMLDivElement | null => listRef.current,
    estimateSize: (index: number): number => estimateHeight(rows[index], estimateItem),
    getItemKey: (index: number): string => rows[index]?.key ?? String(index),
    overscan: OVERSCAN,
  });

  useEffect(() => {
    if (selectedKey === null) {
      return;
    }
    const wanted: string = itemRowKey(selectedKey);
    const index: number = rows.findIndex((row: PanelRow<T>) => row.key === wanted);
    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: 'auto' });
    }
    // Nur eine neue Wahl löst das Scrollen aus; die Liste ändert sich laufend, ohne dass die Ansicht springen soll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  function renderRow(row: PanelRow<T> | undefined): ReactElement | null {
    if (row === undefined) {
      return null;
    }
    switch (row.kind) {
      case 'group':
        return (
          <h3
            className={`background-group__title${row.isFirst ? '' : ' background-group__title--spaced'}`}
            title={row.titleHint}
          >
            {row.title}
          </h3>
        );
      case 'empty':
        return (
          <p
            className={`background-group__empty${row.isError ? ' background-group__empty--error' : ''}`}
            role={row.isError ? 'alert' : undefined}
          >
            {row.text}
          </p>
        );
      case 'item':
        return <>{renderItem(row.item)}</>;
    }
  }

  return (
    <div
      className="virtual-panel-list"
      style={{ height: `${String(virtualizer.getTotalSize())}px` }}
    >
      {virtualizer.getVirtualItems().map((item: VirtualItem) => (
        <div
          key={item.key}
          ref={virtualizer.measureElement}
          data-index={item.index}
          className="virtual-panel-list__row"
          style={{ transform: `translateY(${String(item.start)}px)` }}
        >
          {renderRow(rows[item.index])}
        </div>
      ))}
    </div>
  );
}

function estimateHeight<T>(
  row: PanelRow<T> | undefined,
  estimateItem: (item: T) => number,
): number {
  if (row === undefined) {
    return ESTIMATED_EMPTY_HEIGHT;
  }
  switch (row.kind) {
    case 'group':
      return row.isFirst ? ESTIMATED_GROUP_HEIGHT : ESTIMATED_GROUP_HEIGHT + SPACED_GROUP_EXTRA;
    case 'empty':
      return ESTIMATED_EMPTY_HEIGHT;
    case 'item':
      return estimateItem(row.item);
  }
}
