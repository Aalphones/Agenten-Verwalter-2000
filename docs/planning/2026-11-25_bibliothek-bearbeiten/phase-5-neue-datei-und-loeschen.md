# Phase 5 — Oberfläche: Neue Datei und Löschen

**Rating:** standard · baut auf Phase 1–4 · Entwurf verbindlich (Dialog „Neue Datei“, Mülleimer an Dateizeilen, „Löschen“ im Kopf, Leiste „Gelöscht … Rückgängig“)

## Kontext (lesen vor dem ersten Edit)

- `README.md` dieses Plans (Kontrakt `VaultDeleted`, `MirrorCopy`, `VaultRestoreOutcome`); Entwurf: „+“ an Ordnerzeilen, Dialog mit Prüfung beim Tippen, Löschen an einer Datei ausprobieren.
- `src/features/vault/LibraryTree.tsx`, `libraryRows.ts`, `libraryPaths.ts`, `src/stores/library.ts`, `src/lib/vault.ts` (`writeVaultText`).
- `src-tauri/src/vault/edit.rs` — `EDITABLE_EXTENSIONS`; die Liste im Frontend als `EDITABLE_EXTENSIONS` in `libraryPaths.ts` spiegeln, Kommentar mit Verweis auf die Rust-Quelle.
- Dialog-Baustein `src/components/Dialog.tsx`, Muster `src/app/SessionDeleteDialog.tsx`.

## AK der Phase

1. Jede Zeile eines Ordner-Artefakts und jeder Unterordner hat rechts einen Knopf „+“ (sichtbar bei Überfahren, Fokus in der Zeile und an der ausgewählten Zeile; bei `pointer: coarse` immer, 36 px), Titel und `aria-label` „Neue Datei in <Name>“. Datei-Artefakte (eine einzelne Datei) haben keinen. Untergruppen haben keinen (dort liegt kein gemeinsamer Ordner).
2. Dialog „Neue Datei“: Zeile „Ort“ mit dem Ordnerpfad (Schrift mono, umbrechend), Feld „Name“ mit Fokus, Hinweiszeile darunter; Knöpfe „Abbrechen“ (leise) und „Anlegen“ (primär, deaktiviert bis gültig). Esc schließt.
3. Prüfung beim Tippen (reine Funktion `validateNewName(folder, name, existingPaths)` in `libraryPaths.ts`), Texte wörtlich: verbotene Zeichen → „Ohne \ / : * ? " < > |“; Punkt am Anfang → „Dateien mit Punkt am Anfang liest die Bibliothek nicht.“; ohne Endung → „Endung fehlt, z. B. .md“; Endung nicht in der Liste → „.<endung> bearbeitet der Verwalter nicht.“; Pfad existiert → „Gibt es schon — öffne sie im Baum.“; gültig → „Wird angelegt als <ordner>/<name>“; leer → „Mit Endung: .md, .html, .css, .js, .py, .yaml …“. Fehlertexte in Fehlerfarbe, Feld mit `aria-invalid`.
4. „Anlegen“ ruft `writeVaultText({ path, text: '', expectedHash: null, force: false, lineEnding: 'lf', bom: false })`. `Saved` → Datei in den Baum einfügen (lokal, bis `vault://changed` den Index nachliefert; Zeile mit Zusatz „· neu“ in `--color-status-completed`), öffnen im Modus „Bearbeiten“ mit Fokus im Editor. `Exists` → Hinweiszeile „Gibt es schon — öffne sie im Baum.“; Fehler (Satz aus dem Kern) → Hinweiszeile in Fehlerfarbe, Dialog bleibt offen.

5. **Löschen an der Zeile:** jede Dateizeile im Baum (auch Datei-Artefakte) hat rechts einen Mülleimer-Knopf (Sichtbarkeit wie „+“), Titel und `aria-label` „<Dateiname> löschen“, Hover-Rahmen in Fehlerfarbe. Ordner und Untergruppen haben keinen.
6. **Löschen im Kopf:** leiser Knopf „Löschen“ in Fehlerfarbe mit Mülleimer-Symbol hinter „Extern öffnen“, Titel „In den Papierkorb des Verwalters, Rückgängig möglich“; unter 640 px nur das Symbol mit `aria-label`.
7. **Ablauf:** kein Dialog. `deleteVaultFile(path)` → Entwurf der Datei verwerfen, Datei aus dem Baum nehmen (lokal, bis `vault://changed`), war sie offen → Übersicht. Über der Detailspalte erscheint die Leiste „Gelöscht: <pfad>“ (+ „ · auch aus ~\.claude entfernt“ bei `Removed`, + „ · Kopie in ~\.claude weicht ab und bleibt“ bei `Kept`) mit Knopf „Rückgängig“. Die Leiste bleibt bis zum nächsten Löschen oder bis der Bereich verlassen wird; danach hilft nur der Papierkorb-Ordner (30 Tage).
8. **Rückgängig:** `restoreVaultFile(trashId)` → `Restored` öffnet die Datei; `Exists` → Leiste „Am alten Ort liegt wieder eine Datei — nichts überschrieben.“; Spiegel-Ergebnis in der Meta-Zeile wie beim Speichern.

## Checkliste

- [ ] `libraryPaths.ts`: `EDITABLE_EXTENSIONS`, `validateNewName`.
- [ ] `LibraryNewFileDialog.tsx` + `.css`; „+“ in `LibraryTree.tsx`; `library.ts`: `pendingNew: string[]` für lokal eingefügte Pfade, beim nächsten Baum aus dem Index bereinigen.
- [ ] `LibraryUndoBar.tsx`; Mülleimer in `LibraryTree.tsx`, Knopf in `LibraryFileView.tsx`; `library.ts`: `lastDeleted: VaultDeleted | null`, Aktionen `deleteFile`, `undoDelete`.
- [ ] In der laufenden App prüfen: Skill-Datei löschen → weg aus Bibliothek und `~\.claude`, Rückgängig → in beiden wieder da; neue `notizen.md` in einem Skill-Ordner → erscheint, öffnet, Speichern spiegelt nach `~\.claude\skills\<skill>\notizen.md`; Name `.x.md` und `x.exe` werden abgewiesen.
- [ ] `pnpm check` grün.

## Report-Back
