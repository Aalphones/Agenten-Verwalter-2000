# Plan: Notiz im Vorhaben

**Stand:** 2026-11-26 · **ADR:** 074 (neu, Phase 1) · **Migration:** keine · **Entwurf:** keiner (freihändig nach den Festlegungen unten; die Dock-Leiste und die Kopfzeilen-Reiter bestehen schon und geben Maße und Stil vor)

Jedes Vorhaben bekommt genau eine bearbeitbare Textnotiz, um Befehle zusammenzubauen, die der Agent liefert, und dort Token oder Passwörter von Hand zu ergänzen. Die Notiz steht je nach Einstellung als Reiter „Notiz“ im Terminal-Dock (Standard) oder als Reiter oben neben Chat/Dateien/Artefakte. Sie speichert sich selbst und liegt **außerhalb des Arbeitsordners** unter `%USERPROFILE%\.verwalter\notizen\<Vorhaben-ID>.txt`, damit kein Agent sie beim Suchen oder Auflisten mitliest. Ein Knopf „Ins Terminal“ (und `Strg+Enter`) schreibt die markierte Zeile ins gewählte Terminal, ohne Enter.

## Phasen

| Nr | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Notiz im Dock: Core lesen/schreiben, Reiter mit Stift, Ausblenden, Selbstspeichern | [phase-1-notiz-im-dock.md](phase-1-notiz-im-dock.md) | standard | complete |
| 2 | Einstellung „Notiz“ und Reiter oben | [phase-2-einstellung-und-reiter.md](phase-2-einstellung-und-reiter.md) | standard | pending |
| 3 | Ins Terminal | [phase-3-ins-terminal.md](phase-3-ins-terminal.md) | standard | pending |

Rein sequenziell: Phase 2 und 3 bauen beide auf der Notiz-Fläche aus Phase 1 auf (dieselbe Datei `NotePane.tsx`), Phase 3 braucht beide Anzeigeorte aus Phase 2. Schätzung: 3 Umsetzungs-Sessions, je Phase etwa 40–80 Werkzeugaufrufe.

## Kontrakt (Tauri-Grenze)

Typen in `src-tauri/src/notes/model.rs`, Bindings per `pnpm bindings`.

| Befehl | Eingabe | Rückgabe | Fehler |
|---|---|---|---|
| `note_read` | `project_id: String` | `NoteText` | `internal` mit Satz (unbekanntes Vorhaben, ungültige ID, zu groß), `io` |
| `note_write` | `project_id: String`, `text: String` | `NoteSaved` | `internal` mit Satz (unbekanntes Vorhaben, ungültige ID, zu groß), `io` |

```rust
pub struct NoteText { pub text: String, pub modified_ms: f64 }   // fehlt die Datei: text "", modified_ms 0
pub struct NoteSaved { pub modified_ms: f64 }
```

Einstellung (Phase 2): Schlüssel `note_placement`, Rust `NotePlacement { Dock, Tab }` (serde camelCase → TS `'dock' | 'tab'`), Standard `Dock`, Änderung `SettingsChange::NotePlacement { value }` (TS `{ kind: 'notePlacement', value }`).

Oberfläche: Reiter-Schlüssel `'note'` in `SESSION_VIEWS`, `PROJECT_VIEWS`, `IMPLEMENTATION_VIEWS` (`src/stores/sessions.ts`, Phase 2). Im Dock markiert `NOTE_TAB_ID = 'note'` (`src/stores/terminal.ts`, Phase 1) in `selected[projectId]` den Notiz-Reiter.

## Finale AK

1. In jedem Vorhaben zeigt das Terminal-Dock (Einstellung „Im Terminal-Dock“) einen Reiter „Notiz“ ganz links mit Stift-Symbol und Akzentfarbe, klar abgesetzt von den Terminal-Reitern.
2. Getippter Text liegt spätestens 1 s nach dem letzten Tastendruck in `%USERPROFILE%\.verwalter\notizen\<Vorhaben-ID>.txt` und ist nach App-Neustart wieder da.
3. Unter `<Workspace>` des Vorhabens entsteht keine Notiz-Datei; die Notiz erscheint weder in „Session-Dateien“, noch in „Artefakte“, noch in einer Liste des Hintergrund-Panels, und ihr Pfad steht in keinem Text, den die App einem Agenten übergibt.
4. `×` am Notiz-Reiter blendet ihn aus, die Datei bleibt; ein Stift-Knopf neben `+` blendet ihn wieder ein.
5. Mit der Einstellung „Als Reiter oben“ erscheint „Notiz“ als Reiter in der Kopfzeile von Session, Vorhaben-Übersicht und Umsetzung, und das Dock zeigt keinen Notiz-Reiter.
6. „Ins Terminal“ und `Strg+Enter` schreiben die markierte bzw. die Zeile unter dem Cursor ohne Zeilenende ins gewählte laufende Terminal und zeigen dieses Terminal mit Fokus.
7. `pnpm check` grün nach jeder Phase.

## Von mir gesetzt

- **Ablage `%USERPROFILE%\.verwalter\notizen\<Vorhaben-ID>.txt`** — der Benutzer wählte „außerhalb des Arbeitsordners“; der Datenordner des Verwalters wird keinem Agenten freigegeben (Critical Rule 5).
- **Einfaches `<textarea>`, Festbreitenschrift, kein Umbruch, keine Rechtschreibprüfung** — Befehlszeilen brauchen keine Syntaxfarben; CodeMirror kommt erst mit dem Bibliotheks-Plan und wäre eine Abhängigkeit über Pläne hinweg.
- **Selbstspeichern 500 ms nach dem letzten Tastendruck, zusätzlich beim Verlassen** (Reiterwechsel, Ausblenden, Vorhabenwechsel) — „direkt mit gespeichert“; kein Speichern-Knopf.
- **Höchstens 1 MiB** — eine Notiz, kein Datenlager; darüber Fehlersatz statt Schreiben.
- **Keine Erkennung fremder Änderungen** — nur die App schreibt die Datei; letzter Stand gewinnt.
- **Ausgeblendet-Zustand nur im Speicher** (`src/stores/terminal.ts`) — nach Neustart ist der Reiter wieder da; Bedienzustand, kein Datum (Critical Rule 3 betrifft Daten).
- **Archivieren lässt die Notiz liegen** — Wiederherstellen bringt sie zurück; es gibt keinen Lösch-Pfad.
- **Standard der Einstellung: „Im Terminal-Dock“** — der erste Wunsch des Benutzers.
- **„Ins Terminal“ nur einzeilig** — eine Auswahl mit Zeilenumbruch würde in `cmd` Zeile für Zeile ausgeführt; der Knopf ist dann gesperrt mit Erklärung.

## Risiken (Top 3)

- 🟡 **Die Notiz liegt im Klartext auf der Platte.** Wer den Datenordner liest (auch ein Agent, der den Pfad gezielt aufruft), sieht Token. Mitigation: Ablage außerhalb jedes freigegebenen Ordners, Pfad nirgends an Agenten; mehr nicht zugesagt.
- 🟡 **Fokus-Klau zwischen `<textarea>` und xterm:** `Strg+Enter` darf nicht im Terminal landen und das Terminal nach dem Senden den Fokus bekommen. Check in Phase 3: Senden, dann sofort tippen — Zeichen erscheinen im Terminal, nicht in der Notiz.
- 🟡 **Verlorene letzte Tastendrücke beim Schließen der App** innerhalb der 500 ms. Mitigation: Speichern beim Unmount; ein Rest bei hartem Beenden bleibt.

## Konfidenz-Ausweis

- Ob die drei Kopfzeilen den Reiter ohne Sonderregel aufnehmen (sie filtern Reiter nach Bedingungen, z. B. `artifactCount > 0`). Check in Phase 2: `views`-Filter in `SessionHeader.tsx:110`, `ProjectHeader.tsx:79`, `ImplementationHeader.tsx:49` lesen.
- Ob das App-Ende den Unmount noch erlebt (Speichern beim Verlassen). Check in Phase 1: Text tippen, sofort App schließen, neu starten.
- Fehlerklassen geprüft: `sprachen/typescript` und `frameworks/react` — keine einschlägig (HTTP-Lebendprüfung, Testwerkzeuge); für Rust und Tauri gibt es keinen Eintrag.

## Prüfung

Privates Profil: keine automatisierten Tests, keine Test- und Review-Sessions. Jede Phase endet mit grünem `pnpm check`; getestet wird im laufenden Betrieb.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
