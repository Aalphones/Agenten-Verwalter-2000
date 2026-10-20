# 031 — Codex als Betriebsart

**Status:** angenommen · **Datum:** 2026-10-20

## Kontext

Der Benutzer hat neben dem Claude-Abo ein ChatGPT-Abo mit OpenAI Codex. Er will Sessions auch mit Codex führen — bedient wie heute: Chat, Werkzeug-Aktivität, Rückfragen, Changes, Kontext und Kontingent in der Kopfzeile, Anmeldung in den Einstellungen, Modellwechsel in der Eingabeleiste — und mit seinen Anweisungen und Skills. Codex bringt eine eigene Kommandozeile mit, die als `codex app-server` dieselbe JSON-RPC-Schnittstelle über stdio anbietet, über die die VS-Code-Erweiterung von Codex arbeitet.

## Optionen

- **Anbindung:** (a) `codex app-server` (JSON-RPC über stdio); (b) `codex exec --json` je Nachricht; (c) ein eigener OpenAI-Client im autarken Agenten (ADR 017).
- **Schnitt im Verwalter:** (a) ein Übersetzer, der nach außen das Zeilenprotokoll der Claude-Kommandozeile spricht (wie ADR 017); (b) ein zweiter Anbieter hinter einem Provider-Trait in der Registry.
- **Geltungsbereich:** (a) Betriebsart global in den Einstellungen (wie ADR 016); (b) Betriebsart je Session.
- **Verlauf:** (a) getrennte Verläufe, Codex führt seine Threads selbst; (b) Verlauf zwischen Claude und Codex umrechnen.

## Entscheidung

- **`codex app-server` (a).** Nur diese Schnittstelle kennt Anmeldung, Kontingent, Modellliste, Modellwechsel je Turn, Freigabe-Rückfragen und das Fortsetzen eines Threads. Verworfen: `codex exec` — kein Konto, kein Kontingent, keine Rückfragen; eigener Client — kein Login mit dem ChatGPT-Abo, Kontingent unsichtbar.
- **Übersetzer als Unterbefehl `codex` derselben `verwalter.exe` (a).** `main.rs` prüft das erste Argument: `agent` → `standalone::run`, `codex` → `codex::run`. Der Übersetzer wertet die Argumente aus, mit denen der Verwalter die Claude-Kommandozeile startet (`standalone::args`), schreibt Zeilen über `standalone::output` und startet seinerseits `codex app-server`. Registry, Übersetzung, Rückfragen, Unterbrechen, Wiederherstellung, Chat und Changes bleiben unverändert; im Core ändert sich, welches Programm startet (`agents/codex.rs`). Verworfen: Provider-Trait — verdoppelt Registry, Übersetzung und Rückfrage-Fluss; ADR 017 hat denselben Schnitt schon begründet.
- **Betriebsart global (a):** `OperatingMode::Codex`, Oberflächen-Begriff „Codex“. Wirkt ab dem nächsten Agent-Start; ein ruhender Agent wird beim nächsten Senden mit dem neuen Programm gestartet. Die Registry merkt sich dafür neben dem lokalen Backend die Betriebsart des laufenden Prozesses — Claude und Codex haben beide kein lokales Backend. Verworfen: je Session — mischt Konten und Kontingente in einer Liste und ist ein eigener Umbau der Registry.
- **`codex.exe` finden:** (1) Umgebungsvariable `VERWALTER_CODEX_PATH`; (2) `codex.exe` im `PATH`; (3) die jüngste VS-Code-Erweiterung `%USERPROFILE%\.vscode\extensions\openai.chatgpt-<Version>-win32-x64\bin\windows-x86_64\codex.exe` (höchste Version). Nichts gefunden → `CommandError::CodexNotFound`. Ein npm-`codex.cmd` wird nicht gestartet: eine Batch-Datei bringt eigene Quoting-Regeln mit. Den Pfad gibt der Verwalter dem Übersetzer über `VERWALTER_CODEX_EXE`.
- **Getrennte Verläufe (a):** Codex führt eigene Threads unter `~/.codex/sessions/`. Der Übersetzer merkt sich je Session die Thread-ID in `%USERPROFILE%\.verwalter\codex\<session-id>.json`; `--session-id` → `thread/start` und Datei schreiben (Fehler, wenn sie existiert), `--resume` → `thread/resume` mit der gemerkten ID. Die Registry setzt `--resume` nur, wenn diese Datei existiert, sonst meldet der Chat „Verlauf nicht übernommen“ wie nach jedem Wechsel der Betriebsart.
- **Modell:** Das Claude-Modell der Session bleibt in „Codex“ unangetastet und gilt nach dem Zurückschalten wieder; ein Modellwechsel in „Codex“ geht nicht als Claude-Kennung an den Übersetzer. Ohne Modell-Angabe nimmt Codex sein Standardmodell.
- **Ablauf im Übersetzer:** ein Thread für alles; Codex arbeitet den Turn ab und meldet ihn über Benachrichtigungen, die Hauptschleife übersetzt sie. `interrupt` → `turn/interrupt` und sofort `result` mit `aborted_streaming`; das spätere `turn/completed` des abgebrochenen Turns geht nicht mehr hinaus. Nachrichten während eines Turns warten in der Schlange. Ende der Standardeingabe → Standardeingabe von Codex schließen, 3 s warten, dann beenden.
- **Code-Ort:** Laufzeit in `src-tauri/src/codex/` (`rpc` JSON-RPC-Client, `session` Hauptschleife), Startseite im Core in `src-tauri/src/agents/codex.rs`. Feature-Name `codex`.

## Konsequenzen

- Der Verwalter hängt am JSON-RPC-Protokoll von `codex app-server`, das OpenAI ohne Versionszusage ändern kann; das Schema einer installierten Version erzeugt `codex app-server generate-json-schema --out <Ordner>`. Geprüft gegen `codex-cli 0.162.0-alpha.2`.
- Nach einem Wechsel der Betriebsart beginnt der Verlauf neu; Codex-Threads und Claude-Transkripte liegen nebeneinander.
- Freigaben, Werkzeug-Aktivität, Anweisungen, Modelle, Kontext, Konto, Kontingent und Druckmodus folgen in eigenen Phasen des Plans `docs/planning/2026-10-19_codex/` und ergänzen diese Entscheidung.
