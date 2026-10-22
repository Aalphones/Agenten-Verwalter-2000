# Phase 1 — Core: Quellen sammeln, Angaben ohne Fundstelle ermitteln

Lesen: [README.md](README.md) (Entscheidungen, Kontrakt), `src-tauri/src/agents/claude/translate.rs` (`handle_user` mit der `ToolResult`-Schleife, `result_text`, `used_paths`, `turn_ended`), `src-tauri/src/agents/event.rs` (`AgentEvent`, `ChatEntry::Text`), `src-tauri/src/sessions/registry.rs` (`apply_event` Zweige `Text`, `ToolStarted`, `TurnEnded`; `end_turn`; `note_turn_summary`; `replace_entry`; `push_user`; `send`), `src-tauri/src/notices/model.rs`, `src-tauri/src/tldr/transcript.rs` und `src-tauri/src/archive/search.rs` (nutzen `ChatEntry::Text` — Muster anpassen), [docs/conventions/rust.md](../../conventions/rust.md).

## AK der Phase

1. `translate.rs` sendet für jedes `tool_result` des Hauptagenten (nicht für Zeilen mit `parent_tool_use_id`) zusätzlich `AgentEvent::ToolOutput { text: result_text(content) }`, wenn der Text nicht leer ist — in der bestehenden Schleife, nach `ToolFinished`.
2. `SessionState` hält für die laufende Antwort `turn_sources: Sources` und `turn_texts: Vec<u32>` (Seqs der Text-Einträge). `send` setzt beide beim Senden zurück und legt den gesendeten Text (`agent_text`, also samt Kommentaren) als erste Quelle ab. `ToolOutput` → `push_text`; `ToolStarted` → `push_path` für jeden der `used_paths`; `Text` → Seq merken.
3. `end_turn` ruft vor `note_turn_summary` die neue Methode `note_unsourced(outbox) -> Vec<u32>`: für jede gemerkte Seq `sourcing::unsourced(text, &turn_sources)`; nicht leer → `replace_entry` mit gefülltem `unsourced`. Rückgabe = Seqs mit Marken. Bei `is_overflowing()` sofort leer zurück. Danach beide Felder leeren. Auch bei `cancel_requested` leeren, aber nichts markieren.
4. `note_turn_summary` bekommt die Seqs als dritten Parameter, legt `unsourced` in `Notice::TurnSummary` ab und legt die Zeile auch dann an, wenn nur `unsourced` nicht leer ist.
5. `sourcing::unsourced` erfüllt die Regeln aus den Entscheidungen; Ergebnis ohne Doppelte, in Reihenfolge des ersten Vorkommens, höchstens 50 Einträge.

## Checkliste

- [x] `agents/event.rs`: `AgentEvent::ToolOutput { text: String }`; `ChatEntry::Text` bekommt `#[serde(default)] unsourced: Vec<String>`. Alle Stellen, die `ChatEntry::Text { seq, text }` bauen oder zerlegen, auf `..` bzw. `unsourced: Vec::new()` umstellen (`cargo check` findet sie).
- [x] `notices/model.rs`: `TurnSummary` bekommt `#[serde(default)] unsourced: Vec<u32>`.
- [x] Neues Modul `src-tauri/src/sourcing/mod.rs` (in `lib.rs` als `mod sourcing;`), Modul-Kommentar: „Angaben einer Antwort ohne Fundstelle in den Werkzeug-Ausgaben derselben Antwort (ADR 036). Rein mechanisch.“ Inhalt:
  - `pub struct Sources { text: String, paths: Vec<String>, bytes: usize }` mit `MAX_SOURCE_BYTES: usize = 4 * 1024 * 1024`; `push_text(&mut self, text: &str)` hängt kleingeschrieben mit `\n` an und zählt Bytes; `push_path(&mut self, path: &str)` legt `normalize(path)` ab; `is_overflowing(&self) -> bool`. Beim Anhängen zusätzlich `numbers: HashSet<String>` aus allen Zahlfolgen der Quelle füllen (Funktion `number_key`).
  - `fn strip_fences(text: &str) -> String`: entfernt Code-Blöcke mit Zaun (Zeilen zwischen ` ``` ` bzw. `~~~` gleicher Länge), lässt Inline-Code stehen.
  - Erkennung über drei `regex::Regex` in einer `LazyLock` (Rust 2024, std): Pfad `(?:[A-Za-z]:)?(?:[\w.~@-]+[\\/])+[\w.@-]+\.[A-Za-z0-9]{1,8}(?::\d+(?::\d+)?)?`; Datei:Zeile ohne Ordner `\b[\w.-]+\.[A-Za-z0-9]{1,8}:\d+\b`; Zahl `\d[\d.,]*\d%?`. Das `regex`-Paket kennt keine Lookarounds: die Grenzen prüft der Code am Treffer selbst — das Zeichen davor darf kein Buchstabe, keine Ziffer, kein `_`, `.` oder `,` sein, das Zeichen danach kein Buchstabe, keine Ziffer, kein `_`; sonst Treffer verwerfen. Ein abschließendes `.` oder `,` (Satzende) gehört nicht zur Zahl und wird vor dem Prüfen abgeschnitten.
  - Ausschlüsse für Zahlen: Datum `^\d{1,2}\.\d{1,2}\.(\d{2,4})?$`, Uhrzeit (Treffer, dem `:\d{2}` folgt oder vorangeht), Version (zwei oder mehr Punkte ohne Komma), Teil eines Pfad-Treffers (Bereiche der Pfad-Treffer zuerst sammeln und Zahlen darin überspringen).
  - `fn number_key(raw: &str) -> String`: nur Ziffern behalten. Zahl belegt, wenn `number_key` in `numbers`.
  - `fn normalize(path: &str) -> String`: `\` → `/`, klein, ohne `:<zeile>`. Pfad belegt, wenn sein letzter Abschnitt (Dateiname) im Quelltext oder in `paths` vorkommt; bei `:<zeile>` zusätzlich `number_key(zeile)` in `numbers`.
  - `pub fn unsourced(text: &str, sources: &Sources) -> Vec<String>` nach AK 5; zurückgegeben wird jeweils der Treffer **wie im Antworttext** (unverändert), damit die Oberfläche ihn wiederfindet.
- [x] `translate.rs`: AK 1.
- [x] `registry.rs`: Felder, `send`, `apply_event`-Zweige, `note_unsourced`, `end_turn`, `note_turn_summary` nach AK 2–4. Die Prüfung läuft unter der Session-Sperre, die `end_turn` ohnehin hält; keine Datenbank, keine zweite Sperre.
- [x] `src-tauri/examples/gen-bindings.rs`: nichts Neues zu exportieren (Felder an vorhandenen Typen); `pnpm bindings`.
- [x] `docs/decisions/036-ohne-fundstelle.md`: Optionen (a) Modell prüft die Antwort — verworfen, neuer Ratgeber, der selbst falsch liegen kann, und Kosten je Antwort; (b) mechanischer Abgleich mit den Werkzeug-Ausgaben — gewählt; (c) Werkzeug-Ausgaben dauerhaft speichern — verworfen, Datenbank wächst mit jeder gelesenen Datei; nur die Liste der Treffer wird gespeichert. Konsequenzen: Ausgaben von Subagenten zählen nicht als Quelle; über 4 MB Quellen wird nicht markiert; die Regeln stehen nur in `sourcing/mod.rs`.
- [x] `pnpm check` grün, Commit `feat(chat): Angaben ohne Fundstelle im Core ermitteln`.

## Wackelstellen (nur Plan, kein Prüfauftrag)

- 🟡 Die Zahl-Regex fängt auch Dinge wie Tokens (`64000`) oder Prozentwerte, die der Agent aus der Kontext-Anzeige des Systems kennt, nicht aus einem Werkzeug — sie werden markiert. Bewusst so: auch das ist „nicht nachgesehen“.
- 🟡 Read-Ergebnisse der Claude-Kommandozeile tragen Zeilennummern im Format `   88→`; `number_key` trifft sie, damit belegt jede gelesene Zeilennummer eine Datei:Zeile-Angabe. Großzügig, gewollt.

## Report-Back
