# Phase 6 — Dateilinks im Chat

Rating: standard. Ein Klick auf einen Dateilink im Chat öffnet die Datei im Reiter „Dateien“ und springt zur genannten Zeile. HTML und PDF öffnen weiter im Standardprogramm. Links auf Quelltext-Dateien werden überhaupt erst als Link erkannt. Dazu zwei Fehler unter Linux an den bestehenden Links. Aussehen: Entwurf, Bild `05-chat-links.png`.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt (`FileLinkTarget`, Abschnitt „Dateilink“, `EXTERNAL_EXTENSIONS`, Linux und macOS)
- [ADR 023](../../decisions/023-dateiverweise-im-chat.md) (Sicherheitsgrenze, Erkennung), [ADR 067](../../decisions/067-dateien-ansicht.md)
- `src-tauri/src/file_links/mod.rs` — `OPENABLE_EXTENSIONS`, `LinkRoots`, `roots`, `resolve`, `clean`, `strip_line_number`, `check_extension`
- `src-tauri/src/commands/file_links.rs` — `file_link_open`
- `src-tauri/examples/file-link-probe.rs` — Prüfprogramm für `resolve` (Aufruf in `AGENTS.md`)
- `src/lib/fileLinks.ts` — `OPENABLE_EXTENSIONS`, `filePathOf`, `fileHrefOf`, `openFileLink`
- `src/components/FileLink.tsx`, `src/components/Markdown.tsx` (wo `filePathOf` Inline-Code und Markdown-Links zu `FileLink` macht)
- `src/features/files/` — `stores/files.ts` (`OpenTarget`), `useRepoTrees.ts` (`loadAll`), `searchFiles.ts`
- `src/stores/sessions.ts` (`showView`), `src/stores/sessionErrors.ts`
- Fehlerklassen geprüft (Vault `frameworks/react`, `sprachen/typescript`): keine einschlägig.

## AK

1. `file_link_resolve` liefert nach den sechs Regeln der README: für `src/app/App.tsx:42` in einem Repository des Vorhabens `View { key, path: "src/app/App.tsx", line: 42 }`; für `bericht.html` `External`; für `App.tsx` ohne Ordner, wenn es die Datei in keiner relativen Basis gibt, `Name { name: "App.tsx" }`; für `../anderes/x.md` `FileNotAllowed` mit „Liegt außerhalb des Vorhabens“; für eine Datei im Ticket-Worktree mit absolutem Pfad den Schlüssel dieses Ticket-Worktrees.
2. Klick auf einen Link mit `View`: der Reiter „Dateien“ öffnet, die Datei steht in „Ganze Datei“ mit hervorgehobener Zeile; ohne Zeile öffnet sie wie aus dem Baum (geändert: „Änderung“, sonst „Ganze Datei“).
3. Klick mit `External`: `file_link_open` wie heute.
4. Klick mit `Name`: genau ein Pfad im Vorhaben endet auf diesen Dateinamen → er öffnet; mehrere → der Reiter „Dateien“ öffnet mit dem Namen im Suchfeld und offener Liste; keiner → Fehlerleiste „Datei nicht gefunden: <Name>“.
5. Inline-Code und Markdown-Links mit einer Endung aus `VIEWABLE_EXTENSIONS` werden zu Links (`src/lib/bindings/…ts`, `registry.rs:120`); Text wie `state.open` oder `v1.2` nicht.
6. Der `title` eines Links nennt das Ziel: „In Dateien öffnen: <Pfad>“ bzw. „Im Standardprogramm öffnen: <Pfad>“ (HTML, PDF); externe Links tragen zusätzlich das Zeichen ↗ nach dem Text.
7. Linux: `file:///home/u/x.md` wird als `/home/u/x.md` aufgelöst; ein Pfad mit Doppelpunkt im Dateinamen wird unter Unix nicht abgelehnt; `fileHrefOf('/home/u/x.md')` liefert `file:///home/u/x.md`.
8. Fehler beim Öffnen stehen wie heute in der Fehlerleiste der Session.
9. `pnpm bindings` (neu: `FileLinkTarget.ts`), `pnpm check` grün.

## Checkliste

- [ ] `file_links/mod.rs`: `EXTERNAL_EXTENSIONS`; `pub fn target(raw: &str, roots: &LinkRoots, entries: &[(String, PathBuf)]) -> Result<FileLinkTarget, CommandError>` nach den sechs Regeln (`entries` = `(key, dir)` aller Einträge aus `sources::sources`). Die Auflösung aus `resolve` in eine gemeinsame Funktion `locate(cleaned, roots) -> Result<(PathBuf, PathBuf), CommandError>` (gefundener und kanonischer Pfad, Grenze geprüft) ziehen; `resolve` = Endungsprüfung + `locate` + Endungsprüfung des kanonischen Pfads, Verhalten unverändert.
- [ ] `file_links/mod.rs`: `pub fn line_of(raw: &str) -> Option<u32>` (erste angehängte Zahl); `clean` und die Doppelpunkt-Prüfung nach Regel 1 der README mit `cfg!(windows)`.
- [ ] `commands/file_links.rs`: `file_link_resolve`; im `invoke_handler` eintragen.
- [ ] `examples/file-link-probe.rs`: Ausgabe um das Ergebnis von `target` ergänzen (`ZIEL view <key> <Pfad> <Zeile>` | `ZIEL external` | `ZIEL name <Name>`); Zeile in `AGENTS.md` anpassen.
- [ ] `src/lib/fileLinks.ts`: `VIEWABLE_EXTENSIONS` = `ts tsx js jsx mjs cjs rs py json jsonc css scss sass less vue svelte yml yaml toml ini sh ps1 cmd bat sql kt kts java gradle xml cs go rb php c h cpp hpp swift dart proto graphql csv log lock`; `filePathOf` erkennt `OPENABLE_EXTENSIONS` und `VIEWABLE_EXTENSIONS`; `resolveFileLink(sessionId, path): Promise<FileLinkTarget>`; `fileHrefOf` zusätzlich für Pfade, die mit `/` beginnen; `isExternalLink(path)` für `html`, `htm`, `pdf`.
- [ ] `src/components/FileLink.tsx`: Klick ruft `resolveFileLink` und verzweigt nach AK 2 bis 4; `title` und ↗ nach AK 6.
- [ ] `src/features/files/openFromLink.ts`: `openFromLink(sessionId, target)` setzt `OpenTarget` (Gruppe aus den geladenen Changes über den Eintrags-Schlüssel; sind sie noch nicht geladen, merkt der Zustand das Ziel als `pendingLink` und `FilesView` löst es nach dem Laden auf) und ruft `showView('files')`; `openByName(sessionId, name)` nach AK 4 über `loadAll()`.
- [ ] `pnpm bindings`, `pnpm check`.
- [ ] Doku: in `docs/glossary.md` den Eintrag zu Dateiverweisen anpassen; in ADR 023 unter dem Titel die Zeile „Geändert durch ADR 067: Ziel des Klicks“ ergänzen.

## Report-Back
