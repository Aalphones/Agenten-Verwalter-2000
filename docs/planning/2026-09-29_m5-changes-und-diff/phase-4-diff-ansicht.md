# Phase 4 — Oberfläche: Diff-Ansicht und Doku-Abschluss

**Status:** pending · **Rating:** standard (Entwurf und Kontrakt stehen; Sorgfalt bei virtualisierten Zeilen mit horizontalem Scrollen)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — „Festgelegte Entscheidungen“ (Eigener Diff statt Monaco, Grenzen, Aktualisieren, Artefakte) und „Kontrakt“
- [ADR 006](../../decisions/006-changes-und-diff.md)
- Entwurf: `docs/design/2026-09-28_hauptansichten/canvas/Main.dc.html` Zeilen ~483–503 (Diff-Kopf und -Zeilen, alle Maße) und ~1154–1192 (Farben je Zeilenart, Beispiel-Diff); [Entwurfs-README](../../design/2026-09-28_hauptansichten/README.md) Abschnitte „Tafeln“ und „Abweichungen bis Meilenstein 3“
- [docs/conventions/react.md](../../conventions/react.md), [tailwind.md](../../conventions/tailwind.md)
- Bestand aus Phase 3: `src/features/changes/ChangesView.tsx` (rechter Bereich), `changesScope.ts`, `src/stores/changes.ts`, `src/lib/errors.ts`; aus Phase 2: `loadFileDiff` in `src/lib/changes.ts`, `src/lib/bindings/{FileDiff,DiffLine,DiffLineKind}.ts`; Muster `useVirtualizer`: `src/features/chat/ChatTimeline.tsx`
- Fehlerklassen: Vault `frameworks/react.md` gelesen — keine einschlägig. Projekteigen:
  - **Horizontales Scrollen in einer virtualisierten Liste:** absolut positionierte Zeilen geben dem Container keine Breite. Die innere Fläche bekommt ihre Breite aus der längsten Zeile (`ch`-Einheit, Tabs als 4 Zeichen) — prüfen per AK 3.
  - **Flackern beim Nachladen:** Lädt der Diff derselben Datei neu (Zahlen haben sich geändert), bleibt der alte sichtbar, bis der neue da ist; nur beim Wechsel der Datei erscheint „Diff wird geladen …“.

## Abnahmekriterien der Phase

1. `pnpm check` grün.
2. Klick auf eine Datei zeigt rechts den Diff statt der Übersicht: Kopf 40 px (Innenabstand 0 10 px 0 16 px, untere Linie `border-subtle`) mit „<Repository> /“ `fg-muted`, Pfad Mono 12.5 px, +/− Mono 11.5 px, rechts die Vergleichs-Angabe Mono 11.5 px `fg-muted` und × (28 × 28 px, `aria-label` „Diff schließen“). × schließt, die Übersicht erscheint, die Datei ist im Baum nicht mehr markiert.
3. Zeilen: 20 px hoch, Mono 12 px, Spalten alte Nummer 48 px und neue Nummer 48 px (rechtsbündig, 10 px rechter Innenabstand, `fg-muted`), Vorzeichen 20 px zentriert, Text `white-space: pre`. Hinzugefügt: `diff-add-bg`, Vorzeichen `+` in `diff-add-fg`, Text `fg-primary`; gelöscht: `diff-del-bg`, `-` in `diff-del-fg`; Kontext: transparent, Text `fg-secondary`; Abschnittskopf: `diff-hunk-bg`, Text `fg-muted`, ohne Nummern. Eine 300 Zeichen lange Zeile lässt sich horizontal ganz lesen; die Nummernspalten scrollen mit.
4. Vergleichs-Angabe: „Alle“ → `<baseRef> → Arbeitsverzeichnis`, „Committed“ → `<baseRef> → <branch>`, „Uncommitted“ → `<branch> → Arbeitsverzeichnis`. Umschalten des Segments bei offener Datei lädt deren Diff im neuen Blickwinkel; gibt es die Datei dort nicht, erscheint die Übersicht.
5. Binärdatei: „Kein Textvergleich: Binärdatei oder größer als 8 MB.“; Diff ohne Zeilen: „Keine Textänderungen.“; `truncated`: letzte Zeile im Stil eines Abschnittskopfs „Gekürzt: nur die ersten 20.000 Zeilen werden angezeigt.“; Fehler: Meldung in `status-error`.
6. Ändert der Agent die geöffnete Datei, zeigt der Diff die neue Fassung nach dem nächsten Nachladen der Changes, ohne zwischendurch leer zu werden.
7. Doku: ADR 006, PROJECT.md, AGENTS.md, `react.md`, Code-Map, Glossar und Entwurfs-README beschreiben den Stand (Checkliste unten); kein Treffer mehr für „Monaco“ in `AGENTS.md`, `docs/PROJECT.md`, `docs/conventions/`.

## Checkliste

- [ ] `src/features/changes/useFileDiff.ts` (neu): `useFileDiff(sessionId: string, file: OpenFile, scope: ChangeScope, stamp: string): { diff: FileDiff | null; error: string | null; isLoading: boolean }`. Identität `key = \`${String(file.position)}:${file.path}:${scope}\``. Zustand `{ key, diff, error } | null`, gesetzt nur im Promise-Callback. Effekt über `[sessionId, key, stamp]` ruft `loadFileDiff` mit `AbortController` (Antwort nach Abbruch verwerfen). Rückgabe: stimmt `state.key` mit `key` überein → `diff`/`error` daraus, `isLoading: false`; sonst `null`/`null`/`true` (ein Nachladen wegen geänderter `stamp` zeigt also den bisherigen Diff weiter).
- [ ] `changesScope.ts`: `statStamp(stat: LineStat | null): string` → `'none'` oder `\`${stat.kind}:${String(stat.added)}:${String(stat.deleted)}\``; `compareLabel(scope, baseRef, branch): string` nach AK 4.
- [ ] `src/features/changes/DiffView.tsx` + `.css` (Block `diff-view`, Spalte, füllt den rechten Bereich). Props: `sessionId`, `repository: RepositoryChanges`, `file: FileChange`, `scope`, `onClose`.
  - Kopf `diff-view__header` nach AK 2; Zahlen aus `statOf(file, scope)` (bei `binary` „binär“ statt +/−); Vergleichs-Angabe mit `title` „Links der ältere, rechts der neuere Stand“; ×-Knopf mit dem Symbol aus dem Entwurf, Hover `bg-hover`, Fokus-Ring 2 px `accent`.
  - Körper `diff-view__body`: `flex-grow: 1`, `min-height: 0`, `overflow: auto`, Innenabstand 6 px 0, `font-family: var(--font-mono)`, 12 px, Zeilenhöhe 20 px, `tab-size: 4`. Zustände vor den Zeilen (Satz, Innenabstand 12 px 16 px, 12.5 px `fg-muted`, Sans): `isLoading` → „Diff wird geladen …“; `error` → Meldung in `status-error`; `diff.binary` → „Kein Textvergleich: Binärdatei oder größer als 8 MB.“; `diff.lines.length === 0` → „Keine Textänderungen.“.
  - Zeilen: `useVirtualizer` mit `count = lines.length + (truncated ? 1 : 0)`, `estimateSize: () => 20` (fest, kein `measureElement`), `overscan: 20`. Innere Fläche `diff-view__canvas` (`position: relative`) mit Laufzeit-Stil `height: <getTotalSize()>px` und `width: max(100%, calc(116px + <maxChars>ch + 16px))`; `maxChars` per `useMemo` = längster `text` mit Tabs als 4 Zeichen. Zeile `diff-view__line diff-view__line--<kind>` absolut, `top: 0`, `transform: translateY(<start>px)`, Höhe 20 px, `width: 100%`, `display: flex`; Zellen `__old`, `__new` (48 px, rechtsbündig, Innenabstand rechts 10 px, `fg-muted`), `__sign` (20 px, zentriert), `__text` (`white-space: pre`). Farben nach AK 3 über die Modifier `--added`, `--deleted`, `--context`, `--hunk`; die Zusatzzeile für `truncated` nutzt `--hunk` mit dem Text aus AK 5.
  - `DiffView` bekommt in `ChangesView` `key={\`${String(file.position)}:${file.path}:${scope}\`}`, damit ein Dateiwechsel oben beginnt.
- [ ] `ChangesView.tsx`: aus der Auswahl `openFile` das Repository (`position`) und die Datei (`path`) in `changes` suchen; nur wenn beide existieren und `statOf(file, scope) !== null`, rechts `DiffView` (mit `stamp = statStamp(statOf(file, scope))` an `useFileDiff` durchgereicht), sonst `ChangesOverview`. `onClose` → `closeFile(sessionId)`. `FileTree` markiert die Datei nur, wenn der Diff tatsächlich angezeigt wird.
- [ ] `docs/PROJECT.md`: Stack-Zeile „Diff“ → „eigene Unified-Diff-Ansicht; der Core zerlegt den Diff, die Oberfläche zeigt nur sichtbare Zeilen ([ADR 006](decisions/006-changes-und-diff.md))“ mit Begründung „Entwurf verlangt Nummern- und Vorzeichenspalten, die Monaco nicht abbildet; kein Editor-Paket von mehreren MB“.
- [ ] `AGENTS.md`: Stack-Zeile „Diff“ → „eigene Unified-Diff-Ansicht (virtualisiert)“.
- [ ] `docs/conventions/react.md`: Stack-Zeile „Diff“ → „eigene Diff-Zeilen aus dem Core, virtualisiert ([ADR 006](../decisions/006-changes-und-diff.md))“; Performance-Punkt „Monaco wird per `lazy()` …“ → „Der Diff kommt vom Core fertig zerlegt (Art, Nummern, Text) und wird wie jede lange Liste virtualisiert; höchstens 20 000 Zeilen je Datei“.
- [ ] Code-Map: Zeile „Changes“ um `DiffView`, `useFileDiff` ergänzen; der Einleitungssatz nennt die Changes-Ansicht als gebaut.
- [ ] Glossar: **Base ref** → „Der Git-Stand, gegen den die Changes-Ansicht misst: der beim Anlegen der Session ausgecheckte Stand des Haupt-Checkouts, gespeichert als `base_ref` (Branch-Name) und `base_commit` (Commit-ID). Pro RepositoryWorkspace.“ (bisher fälschlich „z.B. `origin/main`“, siehe ADR 005). **Committed / Uncommitted** → Uncommitted umfasst auch gestagte und neue, nicht ignorierte Dateien. **Changes-Ansicht** → „… geänderte Repositories, Dateien und Diffs gegen die Basis, im gewählten Blickwinkel.“
- [ ] Entwurfs-README: Tafel `Artifacts.dc.html` „Gebaut in“ → „offen (GAPS: Artefakte)“. Abschnitt „Abweichungen bis Meilenstein 3“ → „Abweichungen vom Entwurf“, Einleitungssatz um „und Meilenstein 5 ([Plan-README](../../planning/2026-09-29_m5-changes-und-diff/README.md))“ ergänzen; unter „Fehlt ganz“ „Reiter „Artefakte“ (offen)“ statt „(M5)“, dazu „Reiter „Changes“ bei Sessions ohne Repository“. Neue Punkte:
  - **Basis-Angabe:** nennt `base_ref` (der beim Anlegen ausgecheckte Branch) statt `origin/main`; haben die Repositories verschiedene Basen, „gegen die Basis je Repository“ mit Liste beim Überfahren.
  - **Repository-Chips** erst ab zwei Repositories; ihre Zahlen folgen dem gewählten Commit-Stand.
  - **Vergleichs-Angabe im Diff-Kopf** je Commit-Stand (`Basis → Arbeitsverzeichnis`, `Basis → Branch`, `Branch → Arbeitsverzeichnis`) statt immer `Basis → Branch`.
  - **Binärdateien:** „binär“ statt +/− im Baum, im Diff „Kein Textvergleich …“. **Fehlerzeile** je Repository im Baum und in der Übersicht. **Sätze** für Laden, leeren Commit-Stand, leeren Diff und „Gekürzt“. Lange Diff-Zeilen scrollen horizontal.
- [ ] `pnpm check`, Commit `feat(changes): show the unified diff of the selected file`.

## Report-Back
