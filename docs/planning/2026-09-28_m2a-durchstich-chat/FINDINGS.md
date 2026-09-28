# Findings — Meilenstein 2a Durchstich & Chat

Erkenntnisse aus der Umsetzung, getaggt nach Ziel-Phase:

```text
- [ ] → Phase N: <Erkenntnis>
```

- [ ] → Phase 2: `ToolFinished` kommt auch für `tool_use_id`s ohne vorheriges `ToolStarted` — `TodoWrite` und `AskUserQuestion` erzeugen kein `ToolStarted`, ihr `tool_result` aber ein `ToolFinished`. Unbekannte IDs still ignorieren, nicht als Fehler behandeln.
- [ ] → Phase 2: `QuestionAsked.input` je `request_id` aufbewahren — `protocol::allow` braucht es als `updatedInput` (bei `AskUser` zusätzlich `answers: { "<question>": "<label>" }`, siehe Wissensdatei).
- [ ] → Phase 2: `on_output` läuft auf zwei Threads gleichzeitig (stdout, stderr). `Stderr`-Zeilen können nach `Exited` eintreffen — das Session-Protokoll muss sie danach noch annehmen, der Status darf davon nicht mehr abhängen.
- [ ] → Phase 2: `Exited` kommt erst nach Dateiende auf stdout. Erbt ein vom Agenten gestarteter Kindprozess dessen stdout, kann das Dateiende später kommen als das Prozessende (nicht geprüft) — fällt im Smoke „Absturz“ auf, falls der Fehlerkasten ausbleibt.
- [ ] → Vault: sprachen/rust — Sperre lebt länger als gedacht · Ursache: Temporäre Werte im `match`-Kopf (`match mutex.lock().x() { … }`) leben bis zum Ende des ganzen `match`, auch in Edition 2024 — ein `sleep` in einem Arm hält die Sperre mit · Fix: Ergebnis erst in eine eigene Variable (`let status = mutex.lock().x();`), dann `match status`.
