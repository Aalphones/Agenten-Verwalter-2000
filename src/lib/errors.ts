import type { CommandError } from '@/lib/bindings/CommandError';

export function isCommandError(reason: unknown): reason is CommandError {
  return typeof reason === 'object' && reason !== null && 'kind' in reason;
}

/** Der Anzeige-Text eines Core-Fehlers. `message` ist der Inhalt der Variante (bei `repositoryMissing` nur der Pfad),
 *  deshalb setzt sich der Text je `kind` zusammen. */
export function commandErrorText(reason: unknown): string {
  if (!isCommandError(reason)) {
    return String(reason);
  }
  switch (reason.kind) {
    case 'gitNotFound':
      return 'Git nicht gefunden.';
    case 'repositoryMissing':
      return `Repository nicht gefunden: ${reason.message}`;
    case 'sessionNotFound':
      return 'Session nicht gefunden.';
    case 'attachmentsWhileWaiting':
      return 'Anhänge gehen erst, wenn die Rückfrage beantwortet ist.';
    default:
      return 'message' in reason ? reason.message : reason.kind;
  }
}
