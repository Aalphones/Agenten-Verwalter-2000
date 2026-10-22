export const UNSOURCED_TITLE = 'Ohne Fundstelle';

export function unsourcedTip(needle: string): string {
  return `„${needle}“ kommt in keiner Werkzeug-Ausgabe dieser Antwort vor. Das heißt nicht, dass es falsch ist — nur, dass der Agent es hier nicht nachgesehen hat.`;
}
