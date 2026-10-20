import type { CodexModel } from '@/lib/bindings/CodexModel';
import type { Effort } from '@/lib/bindings/Effort';
import { effortLabel } from '@/lib/labels';
import type { ModelOption } from '@/lib/labels';

const DEFAULT_SUFFIX = 'Standard';
const UNKNOWN_DEFAULT_LABEL = 'Codex-Standard';

/** Das Modell, das für `id` gilt: das gewählte, bei `null` das Standardmodell von Codex.
 *  `null`, solange die Liste fehlt oder die Kennung nicht darin steht. */
export function selectedCodexModel(
  models: readonly CodexModel[],
  id: string | null,
): CodexModel | null {
  if (id === null) {
    return models.find((model: CodexModel) => model.isDefault) ?? null;
  }
  return models.find((model: CodexModel) => model.id === id) ?? null;
}

/** Name in der Eingabeleiste: bei `null` der Standard mit Zusatz, sonst die Anzeigebezeichnung. */
export function codexModelLabel(models: readonly CodexModel[], id: string | null): string {
  const model: CodexModel | null = selectedCodexModel(models, id);
  if (id === null) {
    return model === null ? UNKNOWN_DEFAULT_LABEL : `${model.displayName} (${DEFAULT_SUFFIX})`;
  }
  return model === null ? id : model.displayName;
}

/** Zeilen für das Modellmenü. */
export function codexModelOptions(models: readonly CodexModel[]): ModelOption<string>[] {
  return models.map((model: CodexModel) => ({
    id: model.id,
    name: model.displayName,
    hint: model.isDefault ? DEFAULT_SUFFIX : effortRange(model.efforts),
  }));
}

/** Die Stufen, die das Menü anbietet; ohne Liste alle (`undefined`). */
export function codexEfforts(model: CodexModel | null): readonly Effort[] | undefined {
  return model === null || model.efforts.length === 0 ? undefined : model.efforts;
}

/** Was Codex tatsächlich nimmt: bietet das Modell die Stufe nicht an, seinen Standard. */
export function codexEffort(model: CodexModel | null, effort: Effort): Effort {
  if (model === null || model.efforts.length === 0 || model.efforts.includes(effort)) {
    return effort;
  }
  return model.defaultEffort;
}

function effortRange(efforts: readonly Effort[]): string {
  const first: Effort | undefined = efforts[0];
  const last: Effort | undefined = efforts[efforts.length - 1];
  if (first === undefined || last === undefined) {
    return '';
  }
  if (first === last) {
    return `Denkaufwand ${effortLabel(first)}`;
  }
  return `Denkaufwand ${effortLabel(first)} bis ${effortLabel(last)}`;
}
