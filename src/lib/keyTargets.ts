/** Ein Feld, in das getippt wird: Tasten wie Ziffern, Enter und Pfeile gehören dann ihm. */
export function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !==
    null
  );
}

/** Ein Knopf oder Link: Enter löst dort dessen Klick aus. */
export function isControlTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('button, a, [role="button"]') !== null;
}
