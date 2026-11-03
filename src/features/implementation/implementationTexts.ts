import type { ImplementationView } from '@/lib/bindings/ImplementationView';
import type { ImplementationViewKind } from '@/stores/sessions';

export const VIEW_LABEL: Record<ImplementationViewKind, string> = {
  flow: 'Ablauf',
  changes: 'Changes',
};

export const REPORT_LABEL = 'Lagebericht';
export const REPORT_LOADING = 'Lagebericht wird geladen …';

/** „Phase 2 von 7 · 6 von 16 Sessions fertig“. */
export function progressLine(implementation: ImplementationView): string {
  return `Phase ${String(implementation.currentPhase)} von ${String(implementation.phases.length)} · ${String(implementation.stationsDone)} von ${String(implementation.stationsTotal)} Sessions fertig`;
}

/** „6/16“ in der Sidebar. */
export function progressShort(implementation: ImplementationView): string {
  return `${String(implementation.stationsDone)}/${String(implementation.stationsTotal)}`;
}

export function implementationTitle(implementation: ImplementationView): string {
  return `Umsetzung ${implementation.name}`;
}
