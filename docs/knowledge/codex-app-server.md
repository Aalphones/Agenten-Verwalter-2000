# Codex App-Server — Schnittstelle für den Übersetzer

Stand: `codex-cli 0.162.0-alpha.2` (aus der VS-Code-Erweiterung `openai.chatgpt-26.1007.21434`), belegt am 2026-10-19/20. OpenAI sagt keine Stabilität zu; bei einer neuen Version das Schema neu erzeugen und gegen diese Datei halten.

**Schema:** `codex.exe app-server generate-json-schema --out <Ordner>` schreibt alle Anfrage-, Antwort- und Benachrichtigungstypen.

## Aufruf und Rahmen

- `codex.exe app-server` liest und schreibt je Zeile eine JSON-Nachricht über stdio, ohne `"jsonrpc"`-Feld. Anfragen tragen `id` und `method`, Antworten `id` und `result` bzw. `error`, Benachrichtigungen nur `method`.
- Ohne vorherige Begrüßung nimmt Codex nichts an: `initialize` (`clientInfo: {name, version}`), Antwort abwarten, dann die Benachrichtigung `initialized`. Dauer rund 1,2 s.
- Standardeingabe schließen beendet den Server; der Verwalter wartet 3 s und beendet ihn sonst hart.
- Stderr trägt nur Protokolle; der Verwalter reicht sie mit Präfix `codex:` durch.

## Benutzte Methoden

| Methode | Zweck | Wichtige Felder |
|---|---|---|
| `thread/start` | Thread anlegen | `cwd`, `model`, `approvalPolicy`, `approvalsReviewer`, `sandbox` (`read-only`/`workspace-write`), `developerInstructions`, `baseInstructions`, `ephemeral`; Antwort `thread.id`, `model` |
| `thread/resume` | Thread fortsetzen | `threadId`, `cwd`, `developerInstructions` |
| `turn/start` | Nachricht senden | `threadId`, `input` (Einträge `text`, `image`, `skill`), `model`, `effort`, `approvalPolicy`, `sandboxPolicy`, `outputSchema`; Antwort `turn.id` |
| `turn/interrupt` | Turn abbrechen | `threadId`, `turnId`; der Turn endet danach mit `turn/completed` `interrupted` |
| `model/list` | Modelle | `id`, `displayName`, `isDefault`, `hidden`, `supportedReasoningEfforts`, `defaultReasoningEffort` |
| `account/read` | Konto | `account.type` (`chatgpt`), `planType`, `email` |
| `account/login/start` | Anmeldung | `type: "chatgpt"`; Antwort enthält die Anmelde-Adresse; Ende über `account/login/completed` |
| `account/login/cancel` | Anmeldung abbrechen | `loginId` |
| `account/rateLimits/read` | Kontingent | `primary`/`secondary` mit `usedPercent`, `windowDurationMins`, `resetsAt`; im Probelauf nur `primary` (30 Tage), `secondary` ist `null` |

## Benutzte Benachrichtigungen

`item/started`, `item/completed` (Elemente `agentMessage`, `reasoning`, `commandExecution`, `fileChange`, `mcpToolCall`, `webSearch`), `turn/plan/updated`, `thread/tokenUsage/updated` (`last.inputTokens`, `last.outputTokens`, `modelContextWindow`), `turn/completed` (`status` `completed`/`failed`/`interrupted`, `error.message`), `error` (`willRetry`), `serverRequest/resolved`, `account/login/completed`. Alles andere — Stück-für-Stück-Ausgaben (`…/delta`), Statusmeldungen (`thread/status/changed`, `mcpServer/startupStatus/updated`), `turn/started`, `turn/diff/updated` — überliest der Übersetzer still. Eine unbekannte Benachrichtigung steht einmal auf stderr.

`thread/tokenUsage/updated` kommt **nach** der `agentMessage` des Turns, nicht davor.

## Anfragen von Codex an den Client

| Methode | Antwort des Übersetzers |
|---|---|
| `item/commandExecution/requestApproval` | `accept` / `decline` aus der Rückfrage des Verwalters |
| `item/fileChange/requestApproval` | `accept` / `decline`; die Anfrage trägt nur die Element-ID, die Dateien stehen im `fileChange`-Element |
| `item/tool/requestUserInput` | Antworten je Frage-ID |
| `item/permissions/requestApproval`, `mcpServer/elicitation/request`, `item/tool/call` | JSON-RPC-Fehler „nicht unterstützt“ |

## Eigenheiten

- **Skills:** Ein `skill`-Eintrag im `input` zählt nur, wenn sein Pfad im Katalog von Codex (`~/.codex/skills`) liegt; andere Pfade verwirft Codex ohne Meldung.
- **Dateiänderungen** macht Codex meist über Shell-Befehle (`powershell.exe -Command '…'` um jeden Befehl), selten über `fileChange`.
- **Modus Auto:** `approvalsReviewer: "auto_review"` — Codex' eigener Prüfer entscheidet, auch über Schreiben außerhalb des Arbeitsordners.
- **`effort`** in `turn/start` ist nur gegen das Schema gebaut; Codex bestätigt ihn nicht.
- **PDF-Anhänge** nimmt `input` nicht an.
- **Druckmodus:** `thread/start` mit `ephemeral: true` und `baseInstructions`, `turn/start` mit `outputSchema`; die Antwort steht als JSON-Text in der letzten `agentMessage`. Belegt mit einem Schema `{summary: string}`.
- **`codex.exe` unter Windows:** liegt in der VS-Code-Erweiterung unter `%USERPROFILE%\.vscode\extensions\openai.chatgpt-<Version>-win32-x64\bin\windows-x86_64\`.
