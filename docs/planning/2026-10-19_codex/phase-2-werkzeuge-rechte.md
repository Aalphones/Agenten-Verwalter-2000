# Phase 2 — Werkzeuge, Rechte, Rückfragen

## Kontext

Lesen: [README.md](README.md) (Entscheidungen „Modi → Codex-Freigaben“, „Rückfragen“, Kontrakt-Tabelle „Ausgehende Zeilen“), Phase 1 (`src-tauri/src/codex/`).

Code-Stellen:

- `src-tauri/src/agents/claude/translate.rs` — was der Verwalter aus `tool_use`/`tool_result` liest (`target_of`, `used_paths`, Exit-Code aus `Exit code <n>\n`, `TodoWrite`, `AskUserQuestion`, `can_use_tool`).
- `src-tauri/src/standalone/output.rs` (`assistant`, `tool_results`, `can_use_tool`).
- `src-tauri/src/standalone/paths.rs` — wie Standalone die `--allowedTools`-Muster (`Edit(//c/…/repo-wt-*/**)`) in Ordner übersetzt; diese Funktion wiederverwenden.
- `src-tauri/src/standalone/turn.rs` — Vermittlung von Rückfragen nach Request-ID (Muster).
- Protokoll-Schema: `codex app-server generate-json-schema --out <Scratch-Ordner>` erzeugen und für `ThreadItem`, `CommandExecutionRequestApproval*`, `FileChangeRequestApproval*`, `ToolRequestUserInput*`, `SandboxPolicy`, `TurnPlanUpdatedNotification` nachlesen — Feldnamen von dort, nicht raten.

Fehlerklassen geprüft: keine einschlägig.

## AK der Phase

1. Befehle, Dateiänderungen, MCP-Aufrufe, Websuche und Plan-Schritte von Codex erscheinen im Chat als Werkzeug-Aktivität mit den Namen aus der Kontrakt-Tabelle; geänderte Dateien landen in den Changes der Session.
2. Ein Befehl mit Exit-Code ≠ 0 zeigt im Chat den Exit-Code (wie bei Claude).
3. Manuell: jede Befehlsausführung fragt; Erlauben führt aus, Ablehnen meldet Codex `decline`, der Turn läuft weiter. Planen: Codex ändert keine Datei (Sandbox `readOnly`). Auto: keine Rückfrage an den Benutzer.
4. Eine Rückfrage `item/tool/requestUserInput` erscheint als AskUserQuestion-Karte; die Antwort geht an Codex.
5. `set_permission_mode` wirkt ab dem nächsten Turn.
6. Ein Ticket-Worktree, den die `--allowedTools`-Muster treffen und der vor dem Turn existiert, ist beschreibbar.

## Checkliste

- [ ] `codex/policy.rs`: `fn turn_policy(mode, cwd, add_dirs, scratchpad, allowed_rules) -> Value` liefert `approvalPolicy`, `approvalsReviewer` (nur Auto: `"auto_review"`, sonst `"user"`) und `sandboxPolicy` nach README; `writableRoots` = cwd + add_dirs + scratchpad + vorhandene Ordner aus den Mustern (Funktion aus `standalone/paths.rs`, Ordner mit `std::fs::read_dir` des Elternordners gegen das Muster prüfen). Jeder `turn/start` bekommt diese Felder.
- [ ] `codex/items.rs`: Übersetzung je `ThreadItem`-Typ gemäß Kontrakt-Tabelle; `item/started` erzeugt `tool_use` (ein `assistant`-Block), `item/completed` erzeugt `tool_result`. Für `commandExecution`: Ausgabe = `aggregatedOutput` (Feldname im Schema prüfen), gekürzt auf 30 000 Zeichen wie Standalone; Exit-Code ≠ 0 → `is_error: true` und `Exit code <n>\n` vorn. `fileChange`: je Eintrag in `changes` ein `tool_use` mit ID `<item.id>-<n>`; `add` → `Write`, sonst `Edit`; `file_path` absolut (relativ → gegen `cwd` auflösen). Unbekannte Typen ignorieren (stderr-Zeile).
- [ ] `turn/plan/updated` → `TodoWrite` gemäß Tabelle (Zuordnung der Status-Werte im Schema prüfen).
- [ ] `item/agentMessage/delta` und `item/reasoning/*Delta` ignorieren — der Verwalter zeigt fertige Blöcke (wie Standalone); `reasoning` beim `item/completed` als `thinking`-Block, wenn `summary` nicht leer.
- [ ] Rückfragen: `codex/approvals.rs` hält `HashMap<String /*codex-<n>*/, (rpc_id, Art)>`. Server-Anfrage → `output::can_use_tool("codex-<n>", Name, Input)`; `control_response` mit `behavior: allow` → `respond(rpc_id, {"decision":"accept"})`, `deny` → `{"decision":"decline"}` (Antwortform je Art im Schema prüfen; `requestUserInput` bekommt die Antworten aus `updatedInput.answers` in der Form des Schemas). Interrupt → offene Anfragen mit `cancel` beantworten.
- [ ] `set_permission_mode` speichern, beim nächsten `turn/start` anwenden.
- [ ] Probe von Hand mit `verwalter.exe codex …` in einem Test-Ordner: Befehl in Manuell, Datei anlegen in Automatisch bearbeiten, Datei ändern in Planen (muss scheitern). Ergebnisse in FINDINGS.
- [ ] ADR 031: Abschnitt Rechte/Sandbox ergänzen (insbesondere `networkAccess: true` und `auto_review`).
- [ ] `docs/code-map.md` Zeile „Codex“ um `policy`, `items`, `approvals` ergänzen.

## Report-Back
