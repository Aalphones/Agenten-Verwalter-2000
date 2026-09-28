import type { Effort } from '@/lib/bindings/Effort';
import type { Mode } from '@/lib/bindings/Mode';
import type { ModelId } from '@/lib/bindings/ModelId';

export interface ModelOption {
  readonly id: ModelId;
  readonly name: string;
  readonly hint: string;
}

export interface ModeOption {
  readonly id: Mode;
  readonly icon: string;
  readonly label: string;
  readonly hint: string;
}

export interface EffortOption {
  readonly id: Effort;
  readonly label: string;
}

export const MODEL_OPTIONS: readonly ModelOption[] = [
  { id: 'fable', name: 'Fable 5.1', hint: 'Am stärksten, für Planung und Architektur' },
  { id: 'opus', name: 'Opus 5.5', hint: 'Gründlich, für schwierige Umsetzung' },
  { id: 'sonnet', name: 'Sonnet 5', hint: 'Schnell und ausgewogen' },
  { id: 'haiku', name: 'Haiku 4.5', hint: 'Am schnellsten, für Kleinkram' },
] as const;

export const MODE_OPTIONS: readonly ModeOption[] = [
  {
    id: 'manual',
    icon: '✋',
    label: 'Manuell',
    hint: 'Claude fragt vor jeder Änderung um Erlaubnis',
  },
  {
    id: 'edit',
    icon: '</>',
    label: 'Automatisch bearbeiten',
    hint: 'Claude ändert Dateien ohne Rückfrage, fragt aber vor Befehlen',
  },
  {
    id: 'plan',
    icon: '☰',
    label: 'Planen',
    hint: 'Claude untersucht den Code und legt einen Plan vor, bevor er etwas ändert',
  },
  {
    id: 'auto',
    icon: 'ϟ',
    label: 'Auto',
    hint: 'Claude führt aus, was eine Sicherheitsprüfung besteht, und hält bei Riskantem an',
  },
] as const;

export const EFFORT_OPTIONS: readonly EffortOption[] = [
  { id: 'low', label: 'Niedrig' },
  { id: 'medium', label: 'Mittel' },
  { id: 'high', label: 'Hoch' },
  { id: 'xhigh', label: 'Sehr hoch' },
  { id: 'max', label: 'Max' },
] as const;

export function modelName(id: ModelId): string {
  const option: ModelOption | undefined = MODEL_OPTIONS.find(
    (candidate: ModelOption) => candidate.id === id,
  );
  return option === undefined ? id : option.name;
}

export function effortLabel(id: Effort): string {
  const option: EffortOption | undefined = EFFORT_OPTIONS.find(
    (candidate: EffortOption) => candidate.id === id,
  );
  return option === undefined ? id : option.label;
}

export function modeOption(id: Mode): ModeOption {
  const option: ModeOption | undefined = MODE_OPTIONS.find(
    (candidate: ModeOption) => candidate.id === id,
  );
  if (option === undefined) {
    throw new Error(`Unbekannter Modus: ${id}`);
  }
  return option;
}
