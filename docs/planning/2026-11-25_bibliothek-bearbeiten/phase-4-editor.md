# Phase 4 — Oberfläche: Editor, Speichern, Entwürfe

**Rating:** heikel (Lebenszyklus des Editors in React, Entwürfe, Konflikt) · baut auf Phase 1–3 · Entwurf verbindlich

## Kontext (lesen vor dem ersten Edit)

- `README.md` dieses Plans (Kontrakt `VaultText`, `VaultWrite`, `VaultWriteOutcome`, `VaultMirror`); `artifacts/README.md`; Entwurf mit den Zuständen „Konflikt beim Speichern“ und „Spiegeln scheitert“ durchklicken. Der Entwurf nutzt echtes CodeMirror 6 — `mountEditor` und `cmReady` darin zeigen Erweiterungen und Stil.
- Skill `mode-dependencies` vor dem Installieren laden.
- `docs/conventions/react.md` (Effekte, Refs), `docs/conventions/typescript.md`.
- `src/styles/syntax.css` und `src/styles/theme.css` — `--color-code-keyword`, `-string`, `-comment`, `-number`, `-function`, `-type`, `-variable`; `--font-mono`.
- `src/features/vault/LibraryFileView.tsx` (Phase 3), `src/stores/library.ts`, `src/lib/vault.ts`.
- `src/components/Markdown.tsx` (Markdown-Vorschau); `src/features/environment/useEnvironment.ts` und `src/stores/environment.ts` (`setStatus`).
- `src/lib/colorScheme.ts` — Muster für `localStorage` mit `try/catch`.

## AK der Phase

1. **Pakete** (genaue aktuelle Versionen per `pnpm add`, keine Bereiche, die zwei Fassungen erlauben): `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/search`, `@codemirror/autocomplete` (nur Klammern schließen), `@lezer/highlight`, `@codemirror/lang-markdown`, `-html`, `-css`, `-javascript`, `-json`, `-yaml`, `-python`, `-xml`. Nicht das Sammelpaket `codemirror`. `pnpm why @codemirror/state @codemirror/language @lezer/highlight` zeigt je genau eine Version.
2. **`src/features/vault/editor/setup.ts`:** `languageFor(path)` (md → `yamlFrontmatter({ content: markdown() })`; html/htm/svg/xml; css; js/mjs/cjs/jsx; ts/tsx mit `typescript: true`; json; yaml/yml; py; sonst keine), `highlightStyle` (Tags → CSS-Variablen wie im Entwurf: keyword/heading/tagName → `--color-code-keyword`; string/attributeValue → string; comment/quote → comment; number/bool/atom → number; function/link/url → function; typeName/className/propertyName/attributeName → type; variableName/monospace → variable; heading und strong fett, emphasis kursiv), `editorTheme` (`EditorView.theme` nur mit Tokens: Hintergrund `--color-bg-base`, Rinne ohne eigene Fläche mit Linie `--color-border-subtle`, Cursor, Auswahl `--color-bg-selected`, Suchleiste in den Farben der App, Schrift `--font-mono` 12,5 px, Zeilenhöhe 1,55, `font-variant-ligatures: none`), `baseExtensions(onSave)`: Zeilennummern, Faltung, aktive Zeile, Verlauf (Rückgängig), Klammern hervorheben und schließen, Einrücken mit Tab (`indentWithTab`), Suchen/Ersetzen (Strg F / Strg H), Mehrfachauswahl, `EditorView.lineWrapping`, Keymap `Mod-s` → `onSave` (gibt `true` zurück).
3. **`LibraryEditor.tsx`:** genau ein `EditorView` pro Einhängen (in `useEffect` mit leerem Abhängigkeits-Array erzeugen, beim Aushängen `destroy`); Datei-Wechsel tauscht den Inhalt per `view.setState(EditorState.create(…))` statt neu einzuhängen; die Sprache sitzt in einem `Compartment`. Tippen löst kein Neu-Rendern des Editors aus: Änderungen gehen per `updateListener` an `library.ts` (`setDraft(path, text)` bzw. `clearDraft`, wenn der Text wieder dem geladenen gleicht), entprellt 300 ms nur für das Schreiben nach `localStorage`.
4. **Entwürfe** in `library.ts`: `drafts: Record<path, { text, baseHash, lineEnding, bom }>`, gespiegelt nach `localStorage` unter `verwalter.library.drafts` (lesen beim Start, jedes Lesen/Schreiben in `try/catch`, kaputtes JSON → leer). Öffnen einer Datei mit Entwurf zeigt den Entwurf. Seitenleiste: Punkt `sidebar__settings-dot`-Muster am Knopf „Bibliothek“ mit `aria-label="<n> ungespeichert"`, solange `drafts` nicht leer ist. Baum und Übersicht zeigen „● ungespeichert“ an Datei und Eintrag.
5. **Kopf:** Segment „Bearbeiten | Vorschau“ nur für md/html/htm; „Speichern“ (primär, mit `kbd` „Strg S“) nur aktiv mit Entwurf, sonst deaktiviert mit Text „Gespeichert“; „Verwerfen“ (leise) nur mit Entwurf — verwirft ohne Rückfrage, Rückgängig gibt es über den Verlauf des Editors nicht mehr, daher Text des Entwurfs vorher in `lastDiscarded` halten und in der Meta-Zeile „Verworfen · Rückgängig“ anbieten, bis eine andere Datei geöffnet wird.
6. **Speichern:** `writeVaultText({ path, text, expectedHash: baseHash, force: false, lineEnding, bom })`. `Saved` → Entwurf löschen, neuen Hash als Basis, Meta-Zeile „✓ gespeichert HH:MM“ in `--color-status-completed` und Spiegel-Hinweis nach `mirror` („gespiegelt nach ~\.claude“ · `Pending` → Satz in `--color-status-waiting` · `Failed` → Leiste unter dem Kopf in Fehlerfarbe „Gespeichert, aber nicht gespiegelt: <message>“ mit Knopf „Erneut spiegeln“ (`useEnvironment().mirror`)); `environment` → `useEnvironmentStore.getState().setStatus`. `Changed` → Dialog „Datei wurde inzwischen geändert“ (Entwurf: Text, Knöpfe „Abbrechen“ leise, „Neu laden, meine verwerfen“ destruktiv, „Meine Fassung speichern“ primär → erneut mit `force: true`). `Exists` kommt hier nicht vor. Fehler → Leiste mit Satz aus `commandErrorText`, Entwurf bleibt.
7. **Vorschau:** Markdown rendert den aktuellen Text (Entwurf oder gespeichert) mit `<Markdown text=… />` in einer Spalte von max. 760 px; HTML zeigt `vaultPreviewUrl(path)` in `iframe sandbox="allow-scripts"` mit Leiste „Vorschau mit den Dateien aus <ordner>/“, Knopf „Neu laden“ (setzt einen Zähler als `?v=<n>`) und bei Entwurf „zeigt den gespeicherten Stand — erst speichern“. Nach `Saved` lädt die HTML-Vorschau automatisch neu.
8. **Sprung zur Fundstelle:** ist `openLine` gesetzt, setzt der Editor nach dem Laden den Cursor an den Anfang dieser Zeile, scrollt sie in die Mitte (`EditorView.scrollIntoView(pos, { y: 'center' })`) und leert `openLine`.
9. **Nicht bearbeitbar** bleibt Ansicht aus Phase 3 (Bild, PDF, > 2 MiB, Endung nicht in der Liste).

## Checkliste

- [ ] Pakete installieren (AK 1), `pnpm why` prüfen, Ergebnis im Report-Back.
- [ ] `src/features/vault/editor/setup.ts`, `src/features/vault/LibraryEditor.tsx` + `.css`.
- [ ] `library.ts` um Entwürfe, `loaded: { path, hash, text, lineEnding, bom } | null`, `lastSaved`, `lastDiscarded` erweitern; `useLibraryFile(path)` lädt `readVaultText` beim Öffnen.
- [ ] `LibraryFileView.tsx`: Segment, Knöpfe, Meta-Zeile, Leiste, Editor/Vorschau-Weiche; `LibraryConflictDialog.tsx` mit `Dialog` aus `src/components/Dialog.tsx` (Muster: `src/app/SessionDeleteDialog.tsx`).
- [ ] Seitenleiste: Punkt am Knopf (AK 4).
- [ ] In der laufenden App prüfen und im Report-Back nennen: CRLF-Datei speichern → `git diff` in der Bibliothek zeigt nur die geänderte Zeile; Skill speichern → Datei in `~\.claude\skills\…` hat den neuen Inhalt; App mit Entwurf schließen und öffnen → Entwurf da.
- [ ] `docs/code-map.md`: Editor-Bausteine in die Zeile „Bibliothek“; Abhängigkeiten in der Tabelle „Stack“ von `AGENTS.md` nicht nötig (kein neuer Layer).
- [ ] `pnpm check` grün.

## Report-Back
