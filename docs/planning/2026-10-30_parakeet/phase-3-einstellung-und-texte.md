# Phase 3 — Spracheinstellung und Whisper-Texte entfernen

Rating **standard** · Wave 3 · Aufwand S

## Kontext

- [README.md](README.md): Entscheidungen („Wegfall ohne Ersatz“: keine Sprachwahl); Voraussetzung: Phase 2 ist auf `main`.
- Zu ändern, vorher lesen: `src-tauri/src/settings/model.rs` (Feld `voice_language` ~Zeile 42, Variante `SettingsChange::VoiceLanguage` ~Zeile 91), `src-tauri/src/settings/mod.rs` (`KEY_VOICE_LANGUAGE`, `DEFAULT_SETTINGS.voice_language`, Block in `load`, Arm in `update`), `src/features/settings/SettingsView.tsx` (Sektion „Spracheingabe“, Zeilen 332–345, und der Import in Zeile 27), `src/features/settings/VoiceLanguageSegment.tsx`, `src/features/voice/VoiceSetup.tsx` (Zeile 12 `MODEL_SIZE_LABEL`, Zeile 92 Text), `src/features/voice/VoiceButton.tsx` (Zeile 161, Text bleibt: „Sprachmodell“ ist kein Whisper-Wort).
- `docs/conventions/typescript.md`, `react.md`, `rust.md`, ADR 012 (Einstellungen: wie Schlüssel gespeichert werden — `setting_rows`, kein Migrationszwang für verwaiste Schlüssel).
- Fehlerklassen geprüft (Vault: Rust, TypeScript, React): keine einschlägig über die üblichen Punkte hinaus; ungenutzter Import nach dem Löschen fängt `pnpm check`.
- Chesterton's Fence: `voice_language` wurde je Diktat gelesen, um Whisper die Sprache vorzugeben; mit Parakeet gibt es keinen Parameter dafür — Feld, Variante, Schlüssel und Oberfläche sind ohne Wirkung und fallen ganz. Der Datenbank-Eintrag alter Installationen bleibt liegen (harmlos, keine Migration, siehe README „Rahmen“).

## AK der Phase

- [ ] `grep -rn "voice_language\|voiceLanguage\|VoiceLanguage" src src-tauri/src` liefert nichts.
- [ ] Einstellungen zeigt keine Sektion „Spracheingabe“ mehr; die übrigen Sektionen stehen unverändert (Beleg: `pnpm tauri dev` starten, Einstellungen öffnen, Screenshot wie im Phasen-Report üblich; ist kein Browser-Werkzeug da, Beleg per Quelltext: die Sektionsreihenfolge in `SettingsView.tsx` ohne den Block).
- [ ] `pnpm bindings` erzeugt `Settings.ts` ohne `voiceLanguage` und `SettingsChange.ts` ohne Variante `voiceLanguage`; `git diff --stat src/lib/bindings` zeigt genau diese zwei Dateien.
- [ ] Das Einrichten-Menü des Mikrofons nennt die tatsächliche Modellgröße: `MODEL_SIZE_LABEL` entspricht der Summe der Bytes aus der README-Tabelle, gerundet auf ganze MB (Beleg: Summe nachgerechnet im Report-Back).
- [ ] `pnpm check` grün.

## Checkliste

Implementation
- [ ] Rust: `voice_language` aus `Settings` (`model.rs`), `SettingsChange::VoiceLanguage` aus dem Enum (`model.rs`), `KEY_VOICE_LANGUAGE`, Default-Feld, Lese-Block in `load` und Arm in `update` (`mod.rs`) entfernen.
- [ ] `pnpm bindings` ausführen (Befehl und Voraussetzungen: `AGENTS.md`), die zwei Binding-Dateien mitcommitten.
- [ ] TS: Sektion „Spracheingabe“ aus `SettingsView.tsx` samt Import von `VoiceLanguageSegment` löschen; `VoiceLanguageSegment.tsx` löschen (und seine CSS, falls es eine eigene gibt: `Glob src/features/settings/VoiceLanguageSegment*`).
- [ ] `VoiceSetup.tsx`: `MODEL_SIZE_LABEL` auf `'<gerundete MB> MB'` aus der Tabelle (Erwartung: `'670 MB'`); Text bleibt sonst.

Doku
- [ ] Keine; Doku-Nachzug sammelt Phase 4.

Definition of Done
- [ ] Alle AK erfüllt, Zitate im Report-Back.
- [ ] Sichtbares Ergebnis: Einstellungsseite ohne Spracheingabe; Mikrofon-Menü „Diktieren einrichten“ mit neuer Größe.
- [ ] Artefakt: Ausgabe der `grep`-Prüfung, `git diff --stat`, letzte Zeilen von `pnpm check`; Screenshot, wenn ein Werkzeug dafür da ist.
- [ ] Seven-Goals-Sanity je ein Satz.
- [ ] Ein Commit `refactor(settings): Spracheingabe-Einstellung entfernt`.

## Report-Back
