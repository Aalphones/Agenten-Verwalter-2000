# Review-Bericht: Zustand des Ordnens und Bericht ohne Einträge

Folgeplan zu „Review-Bericht abschaltbar“ (`docs/archive/2026-11/2026-11-27_review-bericht-schalter.md`, Umsetzung `73cb952b-6cdf-4e41-bae2-a3300187e377`). Anlass: deren Phase 2 (Station #14) hatte keinen Eintrag im Bericht, Haiku lief nicht, und die Seite sagte nur „Zu dieser Phase gibt es noch kein geordnetes Ergebnis“ — ohne zu zeigen, ob noch etwas kommt. Entscheidungen: ADR 075 (reserviert, Phase 1 schreibt es). Entwurf (verbindlich, Vorschlag C): [artifacts/bericht-ohne-eintraege.html](artifacts/bericht-ohne-eintraege.html).

## Overview

| Phase | Titel | Rating | Modell | Status |
|---|---|---|---|---|
| 1 | Core: Ordnen sichtbar, jederzeit, abbrechbar; Fertigmeldung ohne Bericht | heikel | opusplan | complete |
| 2 | Core: Repos außerhalb des Vorhabens, Stopps aus dem Diff, Weg aus dem Verlauf | heikel | opusplan | complete |
| 3 | Core: Haiku erklärt den Diff | standard | sonnet | complete |
| 4 | Oberfläche: Zustandsleiste, Seite nach Vorschlag C | standard | sonnet | pending |
| 5 | Kontrast im Theme, Plan fertig | mechanisch | sonnet | pending |

## Kontrakt (Core ↔ Oberfläche)

Typen in `src-tauri/src/report/model.rs` (ts-rs, `camelCase`, `pnpm bindings` nach `src/lib/bindings/`), Wrapper in `src/lib/report.ts`. Neue Felder sind Pflichtfelder der Ansicht (kein `Option` am Feld selbst, wo nicht angegeben).

```rust
pub struct ReportPhase {
    // … bestehende Felder unverändert …
    pub tidying_since: Option<f64>,      // ms seit Epoche: Haiku ordnet diese Phase gerade (Phase 1)
    pub tidied_at: Option<f64>,          // ms: Zeitpunkt der gültigen Ordnung = report_phases.tidy_at (Phase 1)
    pub files_since: u32,                // Dateien der Phase, geschrieben nach tidied_at; 0 ohne Ordnung (Phase 1)
    pub entries_since: u32,              // Einträge mit Nummer > report_phases.tidy_entries; 0 ohne Ordnung (Phase 1)
    pub station_result: Option<String>,  // Ergebnis der Fertigmeldung der Spur-Stationen, mit "\n" verbunden (Phase 1)
    pub station_session_id: Option<String>, // Session der ersten Spur-Station: Ziel von „Station nachfragen“ (Phase 1)
    pub repositories: Vec<ReportRepository>, // je Repository der Phase, Reihenfolge wie die Stopps (Phase 2)
}

pub struct ReportRepository {            // Phase 2
    pub label: String,                   // Ordnername des Repositorys bzw. Name des Repository-Eintrags
    pub outside: bool,                   // nicht im Vorhaben eingetragen
    pub files: u32, pub added: u32, pub removed: u32,
    pub commits: Vec<String>,            // Kurz-Hashes
}

pub struct ReportStop {
    // … bestehende Felder …
    pub derived: bool,                   // aus dem Diff gebaut, nicht aus Einträgen (Phase 2)
    pub outside: bool,                   // Repository außerhalb des Vorhabens (Phase 2)
}

pub struct ReportCode {
    // … bestehende Felder …
    pub fresh: bool,                     // Datei nach tidied_at geschrieben (Phase 2)
    pub omitted_rows: u32,               // >0: Diff zu lang, rows ist leer (Phase 2)
}

pub struct ReportWayStep {
    // … bestehende Felder text, files, detour, stop …
    pub at: Option<f64>,                 // ms: erster Aufruf der Etappe; nur im Weg aus dem Verlauf (Phase 2)
    pub location: Option<String>,        // Repository-Label der Etappe (Phase 2)
    pub commit: Option<String>,          // Kurz-Hash, mit dem die Etappe endet (Phase 2)
    pub calls: Vec<String>,              // Beschreibungen der Befehls-Aufrufe (Phase 2)
    pub reads: u32,                      // Lese-/Such-Aufrufe ohne eigene Zeile (Phase 2)
    pub writes: u32,                     // Schreib-Aufrufe (Phase 2)
    pub running: bool,                   // letzte Etappe einer laufenden Phase (Phase 2)
}

pub struct ReportChangedEvent {
    pub implementation_id: String,
    pub tidying_phase_ids: Vec<String>,  // Phasen der Umsetzung, die Haiku gerade ordnet (Phase 1)
}
```

`ReportCode.repository_key` eines Repositorys, das nicht aus den Changes kommt, ist `extern:<Pfad>` (Phase 2).

ReportNote bekommt kein neues Feld: eine Notiz von Haiku hat `entry: None`, `kind: Why`, `label: "H"`, `by: "Haiku · aus dem Diff"` (Phase 3).

Tauri-Befehle (Phase 1): `report_retidy(phaseId)` bleibt und ordnet jetzt auch laufende Phasen (ohne Prüfwerte); neu `report_cancel_tidy(phaseId) -> ()` und `report_tidying(implementationId) -> string[]`.

## Finale AK

1. Während eine Station arbeitet, zeigt die Phasen-Seite „Läuft · noch nicht geordnet“ mit dem Knopf „Zwischenstand ordnen“; nach dem Ordnen „Läuft · Zwischenstand von HH:MM“, die Zahl der seitdem geänderten Dateien und neuen Erklärungen, und „Neu ordnen“, sobald etwas neu ist.
2. Solange Haiku ordnet, zeigen Phasen-Seite (Leiste mit Laufzeit und „Abbrechen“), Inhaltsverzeichnis (Zeile „Haiku ordnet …“) und Reiter „Review“ (Punkt) das an; danach erscheint im Bericht der Hinweis „Phase N geordnet“.
3. Am Phasenende ordnet Haiku auch ohne einen einzigen Eintrag, aus Verlauf und Diff; das Ergebnis trägt die Herkunft „Haiku · aus Verlauf und Diff“, darunter steht die Meldung der Station.
4. Jede geänderte Datei der Phase erscheint im Bericht, auch in Repositorys außerhalb des Vorhabens: Dateien ohne Erklärung als Stopp „aus dem Diff“ je Repository, mit Haiku-Notiz am Rand oder „Keine Erklärung der Station · Haiku erklären lassen“.
5. Ohne Ordnung zeigt die Seite den Weg aus dem Verlauf: Etappen mit Uhrzeit, Ort, Commit, Befehls-Beschreibungen.
6. Meldet eine Station mit Dateiänderungen fertig, ohne je einen Bericht-Eintrag geschrieben zu haben, lehnt der Verwalter die erste Meldung mit einem Hinweis ab; die zweite geht durch.
7. Kein Text der Seite sagt mehr „Zu dieser Phase gibt es noch kein geordnetes Ergebnis“.
8. Bernstein als Schrift und weiße Schrift auf Akzentflächen erreichen im hellen Theme mindestens 4,5:1.

## Abweichungen vom Entwurf (bei der Freigabe gesehen)

- Repositorys heißen nach ihrem Ordner (`U104_Agents`), nicht „Regelwerk (U104_Agents)“ — der Verwalter kennt keinen Anzeigenamen für fremde Repos.
- Etappen-Titel im Weg aus dem Verlauf sind die Beschreibung des ersten Befehls der Etappe, nicht frei formuliert (kein Modell im Spiel).
- „Zahl der neuen Änderungen“ zählt geänderte Dateien und neue Erklärungen getrennt statt einzelner Edits.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
