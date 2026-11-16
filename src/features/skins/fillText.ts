export interface TextValues {
  ziel: string;
  zeit: string;
  commit: string;
}

/** Ersetzt jedes `{ziel}`, `{zeit}` und `{commit}` im Text. */
export function fillText(template: string, values: TextValues): string {
  return template
    .split('{ziel}')
    .join(values.ziel)
    .split('{zeit}')
    .join(values.zeit)
    .split('{commit}')
    .join(values.commit);
}
