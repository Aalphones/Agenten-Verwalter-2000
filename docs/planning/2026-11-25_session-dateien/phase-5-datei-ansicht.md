# Phase 5 — Datei-Ansicht: Betrachter, vier Knöpfe, Sperre in „Artefakte“, Doku

Rating: standard. Die Datei rechts im Reiter „Dateien“ zeigt jede Datei passend zu ihrem Typ — Bild, Video, Ton und PDF im abgeschotteten Betrachter, Markdown & Co. als Text mit Schalter „Vorschau“, HTML und Unbekanntes als Karte — und trägt vier Knöpfe. Das gilt für Session-Dateien und für Dateien in Repositories. Im Reiter „Artefakte“ ist „Mit Standardprogramm öffnen“ für ausführbare Typen gesperrt. Aussehen: Entwurf, Bildschirme „Dateien“ (Dateien `nachweis-labor01.sh`, `screenshot-chat.png`, `management-interface.mp4`, `Sicherungskonzept.pdf`, `AGENTS.md`, `restore-labor.log`, `bericht.html`, `model.bak`, Repository-Datei `ablauf-dateilink.webm`) und „Artefakte“ (`pruefen.cmd`).

## Kontext (lesen)

- [README.md](README.md) → Kontrakt (Befehle, `FileRef`), „Von mir gesetzt“, Risiken
- [artifacts/entwurf-session-dateien.html](artifacts/entwurf-session-dateien.html), [artifacts/README.md](artifacts/README.md)
- `src/features/files/FileViewer.tsx` — `renderHead`, `renderCrumbs`, `renderState`, `FileContentView`, Bildzweig (`file-viewer__image`), `openEditor`, `copyPath`; `src/features/files/FileViewer.css`; `src/features/files/useFileContent.ts`; `src/lib/files.ts` (`openInEditor` o. ä.)
- `src/features/artifacts/ArtifactFrame.tsx` (`FRAME_SANDBOX`), `src/features/artifacts/ArtifactsView.tsx` (Knöpfe `openLabel`, `runOnFile`), `src/features/artifacts/ArtifactsView.css`
- `src-tauri/src/files/read.rs` (`IMAGE_EXTENSIONS`, `MAX_IMAGE_BYTES`, `image_mime`), `src-tauri/src/files/model.rs` (`FileContent`), `src-tauri/src/commands/files.rs` (`files_open_in_editor`)
- `src/lib/sessionFiles.ts` (Phase 4), Befehle `file_view_url`, `file_reveal`, `file_open_default`, `file_open_in_editor` (Phase 2/3)
- `docs/conventions/react.md`, `docs/conventions/tailwind.md`
- Fehlerklassen geprüft (Vault `frameworks/react`, `sprachen/typescript`): keine einschlägig.

## AK

1. Kopf jeder Datei: „← Übersicht“, Pfadkette, (nur Markdown, CSV, JSON, JSON Lines, YAML, XML, Mermaid) Schalter „Text | Vorschau“, rechts die Knöpfe „In VS Code öffnen“, „Im Dateisystem anzeigen“, „Mit Standardprogramm öffnen“, „Pfad kopieren“. Ist der Detailbereich schmaler als 600 px, heißen sie „VS Code“, „Ordner“, „Öffnen“, „Pfad kopieren“. Bei Repository-Dateien bleiben „Änderung | Ganze Datei“ und die Schritte wie heute.
2. Unter dem Kopf eine Zeile: Ordner der Datei (Monospace, links gekürzt, voller Pfad im Tooltip), Größe, Änderungszeit, bei Session-Dateien die Herkunft („erstellt von #<Nr>“ bei `written`, „verlinkt von #<Nr>“ bei nur `linked`, „im Scratchpad von #<Nr>“ sonst).
3. Ausführbare Datei (`executable`; bei Repository-Dateien per Endung aus `file_links::EXECUTABLE_EXTENSIONS`, gespiegelt in `src/lib/fileLinks.ts`): „Mit Standardprogramm öffnen“ ist deaktiviert (gestrichelter Rand) und per `aria-describedby` mit der Zeile „⚠ Standardprogramm gesperrt: würde das Skript ausführen“ (Farbe `--waiting`) verbunden.
4. Inhalt nach Typ: Bild, Video, Ton, PDF → Betrachter-Rahmen (Leiste „Betrachter · <Typ>“ mit Größe, darunter `iframe` mit `file_view_url`); Bild auf Schachbrett, die übrigen auf ruhiger Fläche. Markdown & Co. → Text wie heute, „Vorschau“ → Betrachter-Rahmen. Code, Text, Log, Konfiguration, Diff → Text wie heute. HTML → Karte mit Name, Typ, Größe, Änderung und primärem Knopf „Im Browser öffnen“ (`file_open_default`). Typ ohne Betrachter und Binärdatei → Karte „Für diesen Typ gibt es keine Ansicht.“ mit Typ, Größe, Änderung. Fehlt die Datei → „Datei gibt es nicht mehr“ mit dem Ordner; nur „Pfad kopieren“ aktiv.
5. Bilder in Repositories gehen ebenfalls über den Betrachter; `FileContent::Image` und die 2-MB-Grenze entfallen.
6. Alle Knöpfe rufen die `FileRef`-Befehle (`Entry` für Repository-Dateien, `Absolute` für Session-Dateien); Fehler stehen in der Fehlerzeile der Ansicht wie heute. Rückmeldung „Pfad kopiert“ wie heute.
7. Reiter „Artefakte“: bei `executable` ist „Mit Standardprogramm öffnen“ deaktiviert, darunter dieselbe Hinweiszeile wie in AK 3.
8. Ein 20-MB-Video im Betrachter lässt sich ans Ende spulen.
9. `pnpm bindings`, `pnpm check` grün.

## Checkliste

- [ ] `src/lib/sessionFiles.ts`: `fileViewUrl(sessionId, file: FileRef)`, `revealFile`, `openFileDefault`, `openFileInEditor(sessionId, file, line)`; `src/lib/fileLinks.ts`: `EXECUTABLE_EXTENSIONS` als Spiegel und `isExecutablePath(path)`.
- [ ] `src/features/artifacts/ArtifactFrame.tsx`: `FRAME_SANDBOX` exportieren. `src/features/files/ViewerFrame.tsx` (+ `.css`, BEM `viewer-frame__…`): Props `sessionId`, `file: FileRef`, `kindLabel`, `bytes`, `isImage`; holt die Adresse mit `fileViewUrl` (Laden/Fehler wie `useFileContent`), rendert Leiste und `<iframe sandbox={FRAME_SANDBOX} src={url} title={…}>` (Schachbrett nur bei `isImage`). Kein `srcdoc`.
- [ ] `src/features/files/FileActions.tsx`: die vier Knöpfe nach AK 1, 3, 6 mit Kurzbeschriftung über eine Container-Abfrage des Detailbereichs (`@container` in `FileViewer.css`, Grenze 600 px); `isGone` deaktiviert alle außer „Pfad kopieren“.
- [ ] `FileViewer.tsx`: `renderHead` ersetzt die Knöpfe „In VS Code öffnen“/„Pfad kopieren“ durch `FileActions`; neue Metazeile nach AK 2 (für Repository-Dateien Ordner des Eintrags + Größe/Zeit, wenn `FileContent` sie liefert, sonst nur Ordner); Typwahl nach AK 4 über die Endung (Zuordnung wie `artifacts::kind_of`: als Tabelle `KIND_BY_EXTENSION` in `src/features/files/fileTypes.ts`, mit Verweis auf die Rust-Quelle) bzw. über `SessionFile.kind`/`viewer` bei Session-Dateien; Zustand „Text | Vorschau“ flüchtig im Store (`FilesSelection.preview: boolean`, beim Öffnen einer anderen Datei `false`).
- [ ] `src-tauri/src/files/read.rs`/`model.rs`: Bildzweig, `MAX_IMAGE_BYTES`, `IMAGE_EXTENSIONS`, `image_mime`, `FileContent::Image` entfernen, wenn `grep -rn "FileContent::Image\|IMAGE_EXTENSIONS\|MAX_IMAGE_BYTES" src-tauri/src src` außer diesen Stellen und `FileViewer.tsx` nichts findet; sonst die übrigen Nutzer im Report-Back nennen und den Zweig für sie stehen lassen. Bild-Dateien liefert `read` dann als `Binary`; `FileViewer` fragt für Bilder `read` gar nicht erst ab.
- [ ] `commands/files.rs` `files_open_in_editor` und seinen Eintrag im `invoke_handler` entfernen; `src/lib/files.ts` entsprechend.
- [ ] `ArtifactsView.tsx`: Knopf `openLabel` `disabled={selected.executable}` mit `aria-describedby` auf die Hinweiszeile nach AK 7 (Klassen aus `ArtifactsView.css`, Farbe `--waiting`).
- [ ] Ansehen in `pnpm tauri dev` gegen den Entwurf: jede Datei aus der Einleitung (eigene Beispieldateien anlegen bzw. verlinken lassen), hell und dunkel, 1366 px und schmal; Video spulen (AK 8). Abweichungen im Report-Back.
- [ ] Doku: `docs/code-map.md` Zeile „Dateien“ (`ViewerFrame`, `FileActions`, Typwahl, Wegfall des Bildzweigs), Zeile „Artefakte“ (Sperre); `docs/glossary.md` „ausführbar (Sperre)“, „Betrachter-Adresse“; `AGENTS.md` (Prüfprogramme aus Phase 2 stehen schon); in [ADR 023](../../decisions/023-dateiverweise-im-chat.md) und [ADR 067](../../decisions/067-dateien-ansicht.md) je eine Zeile „Teilweise abgelöst durch ADR 071“.

## Report-Back
