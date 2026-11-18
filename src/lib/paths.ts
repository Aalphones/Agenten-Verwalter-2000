/** Windows-Ordnerpfad: Laufwerksbuchstabe (`C:`) oder UNC-Präfix (`\\`). */
const WINDOWS_PATH_PATTERN = /^(?:[A-Za-z]:|\\\\)/;

/** Hängt einen relativen Pfad (mit `/`) an einen Ordner, mit dem Trenner, den der Ordnerpfad selbst trägt. */
export function joinPath(folder: string, relativePath: string): string {
  const separator: string = WINDOWS_PATH_PATTERN.test(folder) ? '\\' : '/';
  return `${folder}${separator}${relativePath.split('/').join(separator)}`;
}
