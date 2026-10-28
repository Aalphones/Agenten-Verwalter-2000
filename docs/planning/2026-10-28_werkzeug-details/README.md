# Werkzeug-Details im Chat + Prozess-Ausgabe

Zwei Anliegen aus einer Beobachtung: (1) Der Reiter „Prozesse" zeigt bei einem laufenden Befehl „Ausgabe nicht mehr verfügbar", obwohl die Ausgabe nur noch nicht vorliegt. (2) Der Chat zeigt Werkzeug-Aufrufe nur als Kurzzeile (`Grep "x" in …`); wie in der VS-Code-Erweiterung von Claude soll sich jeder Aufruf **optional** aufklappen lassen und dann den vollständigen Befehl bzw. die vollständige Eingabe und die ganze Ausgabe zeigen. **Eingeklappt bleibt der Standard.**

## Phasen

| # | Phase | Rating | Wave | Status |
|---|---|---|---|---|
| 1 | [Prozess-Ausgabe: ehrlicher Text, Pfad früher](phase-1-prozess-ausgabe.md) | standard | 1 | complete (AK 3 Rohzeile offen) |
| 2 | [Kern: Eingabe und Ausgabe je Aufruf speichern und liefern](phase-2-speicher-und-command.md) | heikel | 2 | complete |
| 3 | [Oberfläche: Aufruf aufklappen](phase-3-aufklappen.md) | standard | 3 | complete (App-Lauf offen) |

Rein sequenziell, weil alle drei Phasen `sessions/registry.rs` (`apply_event`, `Outbox`) anfassen und Phase 3 den Command aus Phase 2 braucht; Phase 1 und 2 überlappen schreibend in `registry.rs`.

## Entscheidungen (alle im Plan gefallen)

- **Speicherort:** neue Tabelle `tool_details` (Migration 015), **nicht** in `ChatEntry`. Grund: der Verlauf wird mit `chat_entries::load_all` komplett in den Speicher geladen — große Ausgaben dort widersprächen Critical Rule 3 (Speicher wächst mit dem Sichtbaren). Die UI holt ein Detail erst beim Aufklappen per Command.
- **Deckel:** Eingabe höchstens 32 KiB, Ausgabe höchstens 128 KiB je Aufruf. Bei Bash/PowerShell bleibt das **Ende** der Ausgabe (`tail_text`, wie bei Befehlen), bei allen anderen Werkzeugen der **Anfang**. Gekürzt wird sichtbar gemeldet („Gekürzt — …"), nie still.
- **Eingabe-Text:** Bash/PowerShell → der Wert von `command` unverändert; alle anderen → `serde_json::to_string_pretty` der ganzen Eingabe.
- **Alte Verläufe:** Aufrufe von vor dieser Änderung haben keine Zeile → Antwort `missing: true` → die UI schreibt „Für diesen Aufruf wurde nichts gespeichert (älterer Verlauf)."
- **Nicht im Scope:** Schritte von Subagenten, Suche im Archiv über Ausgaben (`archive/search.rs` ignoriert Werkzeuge weiter), Nachrüsten alter Verläufe.
- **ADR 042** `docs/decisions/042-werkzeug-details.md` (Nummer geprüft: Platte bis 041, reserviert in geparkten Plänen 034/037/038 → nächste frei ist 042) — entsteht in Phase 2.

## Kontrakt (Rust ↔ TypeScript)

Command `tool_detail(session_id: String, tool_use_id: String) -> Result<ToolDetail, CommandError>`; TS-Wrapper `loadToolDetail(sessionId, toolUseId)` in `src/lib/toolDetails.ts` (Muster: `loadBackgroundOutput` in `src/lib/background.ts:19`, Command `background_output`).

```rust
#[derive(Serialize, TS)] #[serde(rename_all = "camelCase")]
pub struct ToolDetail {
    pub input: String,
    pub input_truncated: bool,
    pub output: String,
    pub output_truncated: bool,
    /// Es gibt keine Zeile zu diesem Aufruf (älterer Verlauf oder Aufruf ohne Ergebnis).
    pub missing: bool,
}
```

`output` ist leer, solange der Aufruf läuft. Neue Ereignisse in `agents/event.rs`: `ToolStarted` bekommt `input: String` und `input_truncated: bool`; `ToolOutput` bekommt `tool_use_id: String`, `detail: String` (gekürzt) und `truncated: bool`; `text` bleibt ungekürzt, weil er den Abgleich aus ADR 036 speist. `ToolDetail` liegt in `agents/event.rs`.

## Finale AK (fürs Ganze)

1. Im Reiter „Prozesse" steht bei einem laufenden Befehl ohne bekannte Ausgabedatei nicht mehr „nicht mehr verfügbar", sondern ein Satz, der sagt, dass die Ausgabe erst nach dem Ende vorliegt.
2. Im Chat lässt sich jede Zeile eines Werkzeug-Aufrufs einzeln aufklappen; aufgeklappt stehen dort der vollständige Befehl/die vollständige Eingabe und die vollständige Ausgabe (bis zum Deckel).
3. Beim Öffnen eines Verlaufs ist **nichts** aufgeklappt; Aufklappen lädt erst dann (kein Mehrverbrauch an Speicher im Verlauf).
4. `pnpm check` grün.

## Summary

Der Reiter „Prozesse" sagt bei einem laufenden Befehl ohne Ausgabedatei jetzt, dass die Ausgabe erst nach dem Ende vorliegt. Im Chat lässt sich jeder Werkzeug-Aufruf einzeln aufklappen und zeigt Befehl bzw. Eingabe und Ausgabe; gespeichert wird je Aufruf in der neuen Tabelle `tool_details` (Migration 015, ADR 042), geladen erst beim Aufklappen.

## Files touched

Rust: `agents/event.rs`, `agents/claude/translate.rs`, `background/output.rs`, `sessions/registry.rs`, `db/tool_details.rs` + Migration 015, `commands/tool_details.rs`. TypeScript: `features/chat/` (`ToolDetail.tsx`, `ToolDetail.css`, `useToolDetail.ts`, `ToolGroup.tsx`, `ToolGroup.css`, `ChatTimeline.tsx`), `features/background/ProcessesTab.tsx`, `lib/toolDetails.ts`. Doku: ADR 042, Glossar, `code-map.md`.

## Commits

`d87bd11` Prozess-Ausgabe, `7ba3da3` Speicher und Command, `d890153` Aufklappen.

## Deviations from plan

- Phase 3 ohne App-Lauf abgeschlossen (vom User bewusst so entschieden): AK 2 und 3 sind nur per Lint/Typecheck/Build belegt, nicht gesehen. Das gilt auch für den Weg über `persist` und den Command aus Phase 2.
- Phase 1, AK 3 (Rohzeile `task_started`) bleibt offen.
- `cargo clippy` lief in Phase 3 nicht (kein Rust-Code geändert).

## Follow-ups

- App-Lauf nachholen: Bash/Grep/Read aufklappen, langes Ergebnis (Gekürzt-Hinweis), alter Verlauf („älterer Verlauf"), laufender Aufruf lädt nach dem Ende nach.
- Schritte von Subagenten und die Archiv-Suche über Ausgaben bleiben außen vor (siehe Entscheidungen).
