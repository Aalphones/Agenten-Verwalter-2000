# Phase 4 — Einstellungsseite „Skins“ mit Paketliste und Editoren

Rating: standard (Entwurf liegt vor und ist verbindlich). Neue Kategorie „Skins“ in der Leiste der Einstellungen; darin Schalter, Paketliste und – als Unteransicht – der Editor eines Figuren- oder Stilpakets.

## Kontext (lesen)

- **Entwurf** [artifacts/entwurf-skins.html](artifacts/entwurf-skins.html) – mit `#beispiel`, `#editor`, `#stil` direkt im jeweiligen Zustand öffnen; JS-Funktionen `renderSettings`, `packRow`, `renderEditor`, `renderStyleEditor`, `matchText`, `contrast` sind die Vorlage für Aufbau und Texte
- `src/features/settings/settingsCatalog.ts` (Kategorien, `ENTRY_DATA` mit `info`), `SettingsView.tsx` (`renderRow`, eigene Zeilen-Komponenten wie `EnvironmentMirrorRow`), `SettingRow.tsx`, `SettingsNav.tsx`, `useSettingsUpdate.ts`, vorhandene `Switch`-Komponente (Aufruf in `renderRow`, Fall `markUnsourced`)
- `src/features/attachments/useAttachmentInput.ts` — Hineinziehen über `onDragDropEvent` (Pfade, Position)
- `tauri-plugin-dialog` (Aufruf „Datei wählen“ wie in `MasterDirRow`)
- Phase 2 (`src/lib/skins.ts`), Phase 3 (`SkinStage`, `motionCatalog`, `stores/skins.ts`)
- Fehlerklassen geprüft (Vault `frameworks/react`): Radix-Zuklappen/Tests nicht einschlägig (keine Tests im Profil).

## AK

1. Leiste: neue Kategorie `skins` „Skins“, Zusammenfassung „Figuren · Stil · Pakete“, zwischen „Skills & Umgebung“ und „App“.
2. Abschnitt **Figuren**: Zeile „Figurenpaket“ (Auswahl „Aus“ + Figurenpakete), „Animationen“, „Feier-Momente“ (beide gesperrt mit Satz „Wirkt erst mit einem Figurenpaket“, solange „Aus“), „Easter Eggs“. Abschnitt **Stil**: „Stilpaket“ (Auswahl „Standard“ + Stilpakete). Abschnitt **Pakete**: Knöpfe „Neues Figurenpaket“, „Neues Stilpaket“ (ZIP-Knöpfe kommen in Phase 6), Liste je Paket: Vorschaubild 36 × 30 (Figuren: Bild; Stil: vier Farbstreifen), Name, Marke „Figuren“/„Stil“, Marke „aktiv“, Zeile „zuletzt geändert: …“ (violetter Punkt, wenn ein Agent), darunter „Bearbeiten“, „Duplizieren“, „Löschen“. Leere Liste: „Noch keine Pakete. Lege eins an oder importiere eine ZIP-Datei.“ Abschnitt **Agent**: „Agent darf Skins bearbeiten“, „Werkzeug-Namen zeigen“ (nur flüchtig im Store).
3. Jede Zeile hat ein ⓘ mit Erklärung (Texte aus dem Entwurf, Attribut `title` dort); jeder Schalter einen Zustandssatz (Texte aus dem Entwurf).
4. „Löschen“ löscht sofort; 8 s steht „Paket „X“ gelöscht.“ mit „Rückgängig“ (`skinsUndelete`).
5. Editor (Unteransicht statt der Abschnitte, solange `editingPackId` gesetzt): Zurück-Zeile „‹ Skins“ + Name + Marke, Feld „Name“ (speichert beim Verlassen).
6. **Figuren-Editor**: Gruppe „Eigene Fächer – zuerst geprüft“ mit „Eigenes Fach anlegen“ (neues Fach oben, aufgeklappt, Name „Neues Fach“, Bewegung `bob`, Text „Arbeitet mit {ziel} …“); ohne eigene Fächer Hinweis wie im Entwurf. Gruppe „Vorgegebene Fächer“ mit den 11 Fächern. Fachzeile aufklappbar (eine offen), Kopf: Pfeil, Vorschaubild, Name, Muster/Werkzeuge, Zusammenfassung „Bild · Bewegung · n Texte“. Körper: bei eigenen Fächern Name, Werkzeuge (Muster), Eingabe (Muster, freiwillig), Zeile „Trifft in deinen letzten Sessions: …“ (bis 5 Treffer aus `skinsToolUsage(30)` gegen die Muster, sonst „Trifft in deinen letzten Sessions nichts.“), „↑ nach oben“, „↓ nach unten“, „Fach entfernen“ (mit Rückgängig, 8 s). Bei allen: Bild (Vorschaubild, „Datei wählen“, Adressfeld + „Laden“, „Entfernen“, Zone „oder Bild hierher ziehen“, Fehlerzeile), bei `station` zweites Bild, Bewegung (Auswahl, passende mit „(passt)“), Texte (eine pro Zeile, Hinweis auf `{ziel}`, `{zeit}`, `{commit}`), Vorschau mit `SkinStage` und erstem Text.
7. **Stil-Editor**: Abschnitt Farben mit Umschalter Dunkel/Hell, sieben Farbfelder (Hintergrund Inhalt, Hintergrund Seitenleiste, Flächen, Text, Text gedämpft, Akzent, Rahmen); Warnmarke „Kontrast x,x:1 – unter 4,5:1“ für Text/Text gedämpft gegen Hintergrund Inhalt und Flächen, „… unter 3:1“ für Akzent gegen Hintergrund Inhalt; „Farben auf Standard“. Abschnitt Hintergrundbilder: Seitenleiste und Inhalt rechts je Bildfeld + Schieber „Deckkraft n %“ (0–60). Abschnitt App-Symbol: Bildfeld (PNG oder ICO) + Satz „Wechselt im Fenster und in der Taskleiste, solange der Verwalter läuft; die Verknüpfung behält das Original.“ Änderungen wirken sofort, wenn das Paket aktiv ist (Phase 5).
8. Mitgelieferte Grenzen werden vor dem Speichern in der Oberfläche geprüft (Zeichenzahl, Anzahl), der Fehlersatz des Kerns erscheint unter dem Feld.
9. „Werkzeug-Namen zeigen“ an → neben jeder Aktion klein und gestrichelt der Werkzeugname (Liste im Entwurf: `skin_activate`, `skin_create`, `skin_import`, `skin_rename`, `skin_slot_set`, `skin_slot_remove`, `skin_image_set`, `skin_style_set`, `skin_delete`, `skin_export`).
10. Breiten: unter 576 px Fachkopf ohne Zusammenfassung, Fachkörper ohne Einzug, Paketaktionen umbrechen; keine waagerechte Bildlaufleiste bei 390 px Fensterinhalt.

## Checkliste

- [ ] `settingsCatalog.ts`: `SettingsCategoryId` um `'skins'`; Kategorie einfügen (AK 1); Einträge `skinFigures`, `skinAnimations`, `skinCelebrations`, `skinEasterEggs` (Abschnitt „Figuren“), `skinStyle` („Stil“), `skinPacks` („Pakete“), `skinAgentTools`, `skinToolNames` („Agent“) mit `info`-Texten aus dem Entwurf.
- [ ] `SettingsView.tsx`: Zweige in `renderRow`; ist Kategorie `skins` aktiv und `editingPackId !== null`, statt der Zeilen `<SkinPackEditor />` rendern; Suche zeigt nur die Zeilen.
- [ ] `src/features/skins/SkinPackList.tsx` (+ `.css`), `useSkinPacks.ts` (Liste + Abo `skins://changed`), `SkinUndoBar.tsx` (8 s, „Rückgängig“).
- [ ] `src/features/skins/SkinPackEditor.tsx` (Zurück-Zeile, Name, Weiche nach Art), `FiguresEditor.tsx`, `FigureSlotRow.tsx`, `CustomSlotFields.tsx`, `SlotMatchLine.tsx` (`skinsToolUsage(30)` einmal je Editor laden), `StyleEditor.tsx`, `ColorField.tsx`, `contrast.ts` (WCAG-Formel wie `contrast` im Entwurf), `ImageField.tsx`.
- [ ] `ImageField.tsx`: „Datei wählen“ → Dialog (Filter `gif, png, webp`; beim Symbol `png, ico`) → `skinsSetImage(id, target, { kind: 'path', path })`; „Laden“ → nur `https://`, sonst Fehlersatz „Nur https-Adressen.“ → `{ kind: 'url', url }`; Hineinziehen über `onDragDropEvent` (Muster `useAttachmentInput.ts`), nur wenn der Abwurfpunkt im Rechteck der Zone liegt → `{ kind: 'path' }`; „Entfernen“ → `skinsRemoveImage`.
- [ ] Speichern: Figuren-/Stil-Änderungen über `skinsSave(id, data)` – Texte und Muster beim Verlassen des Feldes, Auswahl/Farbe/Schieber sofort (Schieber und Farbe entprellt 300 ms).
- [ ] `src/features/skins/toolNames.ts`: Zuordnung Aktion → Werkzeugname für AK 9; Komponente `ToolName`.
- [ ] Doku: `docs/code-map.md` (Seite, Editoren), `docs/glossary.md` („Paketliste“, „Editor“).

## Report-Back
