export interface TextValues {
  ziel: string;
  befehl: string;
  zeit: string;
  commit: string;
  fortschritt: string;
  rest: string;
}

/** Ersetzt jeden Platzhalter (`{ziel}`, `{befehl}`, `{zeit}`, `{commit}`, `{fortschritt}`, `{rest}`) im Text. */
export function fillText(template: string, values: TextValues): string {
  return template
    .split('{ziel}')
    .join(values.ziel)
    .split('{befehl}')
    .join(values.befehl)
    .split('{zeit}')
    .join(values.zeit)
    .split('{commit}')
    .join(values.commit)
    .split('{fortschritt}')
    .join(values.fortschritt)
    .split('{rest}')
    .join(values.rest);
}
