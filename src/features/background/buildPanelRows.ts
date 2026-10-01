export type PanelRow<T> =
  | { kind: 'group'; key: string; title: string; titleHint?: string; isFirst: boolean }
  | { kind: 'empty'; key: string; text: string; isError: boolean }
  | { kind: 'item'; key: string; item: T };

export interface PanelGroup<T> {
  title: string;
  /** Voller Text für den Tooltip, wenn der Titel abgeschnitten wird (Pfade). */
  titleHint?: string;
  items: readonly T[];
  /** Text für die leere Gruppe oder ein Hinweis unter den Einträgen; `null`, wenn es nichts zu sagen gibt. */
  emptyText: string | null;
  /** Der Text unter der Gruppe ist ein Fehler, kein Hinweis. */
  isEmptyError?: boolean;
  itemKey: (item: T) => string;
}

/** Der Zeilenschlüssel eines Eintrags — daran findet die Liste die gewählte Zeile. */
export function itemRowKey(itemKey: string): string {
  return `item:${itemKey}`;
}

/** Die flache Zeilenliste eines Panel-Reiters: je Gruppe Überschrift, Einträge, dann der Leer-Satz. */
export function buildPanelRows<T>(groups: readonly PanelGroup<T>[]): PanelRow<T>[] {
  const rows: PanelRow<T>[] = [];
  groups.forEach((group: PanelGroup<T>, index: number) => {
    rows.push({
      kind: 'group',
      key: `group:${String(index)}`,
      title: group.title,
      ...(group.titleHint === undefined ? {} : { titleHint: group.titleHint }),
      isFirst: index === 0,
    });
    for (const item of group.items) {
      rows.push({ kind: 'item', key: itemRowKey(group.itemKey(item)), item });
    }
    if (group.emptyText !== null) {
      rows.push({
        kind: 'empty',
        key: `empty:${String(index)}`,
        text: group.emptyText,
        isError: group.isEmptyError === true,
      });
    }
  });
  return rows;
}
