# Phase 1 — Messung an der nackten Kommandozeile

Ziel: Bevor Code entsteht, ist belegt, was die Umgebungsvariablen tatsächlich bewirken — welcher Netzverkehr bleibt, ob die Kommandozeile das echte Kontextfenster übernimmt, wie schnell es ist, ob TL;DR (strukturierte Antwort) und das Fortsetzen einer Claude-Session mit dem lokalen Modell gehen. Ergebnis ist ein Abschnitt in der README dieses Plans und in `docs/knowledge/claude-stream-json.md`, kein Code.

## Kontext

- [README.md](README.md) dieses Plans, Abschnitte „Messungen“ und „Festgelegte Entscheidungen“.
- Skript [artifacts/messung.ps1](artifacts/messung.ps1): startet `claude.exe` mit der LM-Studio-Umgebung und schreibt `<Out>.json` (Ausgabe der Kommandozeile), `<Out>.stderr.txt` und `<Out>.verbindungen.txt` (jede TCP-Verbindung des Prozessbaums mit Uhrzeit).
- [docs/knowledge/claude-stream-json.md](../../knowledge/claude-stream-json.md) — hierhin kommen die Ergebnisse als Wissen.
- `src-tauri/src/agents/claude/print.rs` — die Argumente des TL;DR-Aufrufs (für M4).
- Fehlerklassen (Vault `werkzeuge/claude-code.md`): „Ein Check, der nicht lief, ist kein Negativbefund“ gilt hier wörtlich — darum hat M1 einen Gegenlauf, der Verbindungen zeigen **muss**.

## Voraussetzungen (vom Benutzer, vor dem Start erfragen)

- LM Studio läuft, lokaler Server an, `google/gemma-4-12b-qat` geladen mit Kontext 64 000. Prüfen: `curl -s http://localhost:1234/api/v0/models/google/gemma-4-12b-qat` zeigt `"state": "loaded"` und `"loaded_context_length": 64000`. Ist es nicht geladen: Benutzer bitten, es zu laden — ohne geladenes Modell passiert nichts.
- Für M3b zusätzlich `google/gemma-4-26b-a4b-qat` mit Kontext 64 000 (nur wenn der Benutzer es lädt; sonst M3b auslassen und so notieren).
- Für M5 muss Claude erreichbar sein (Kontingent nicht aufgebraucht); sonst M5 auslassen und so notieren.
- Ausgaben nach `$env:TEMP\verwalter-messung\` (vorher anlegen), nicht ins Repo.

Jeder Lauf dauert mehrere Minuten (in der Probe 166 s bis zum ersten Token). Läufe nacheinander, nie parallel — LM Studio bearbeitet eine Anfrage nach der anderen, parallele Läufe verfälschen die Zeiten.

## Messungen

Alle Aufrufe im PowerShell-Werkzeug aus dem Repo-Ordner, `$o = "$env:TEMP\verwalter-messung"`.

- [ ] **M1a Gegenlauf (Netz, ohne Schalter):** `.\docs\planning\2026-10-01_claude-code-lokal\artifacts\messung.ps1 -Out "$o\m1a" -ContextTokens 64000 -Arguments '-p "Antworte nur mit dem Wort OK." --max-turns 1 --output-format json'`. Erwartung: `m1a.verbindungen.txt` enthält Verbindungen zu Adressen außer `127.0.0.1`/`::1`. Enthält sie keine, ist die Messung blind (zu kurze Verbindungen, falscher Prozessbaum) — dann **stoppen**, in FINDINGS notieren, Benutzer fragen; M1b wäre wertlos.
- [ ] **M1b Lauf mit Schaltern:** derselbe Aufruf mit `-Out "$o\m1b" -DisableTraffic`. Notieren: jede verbleibende Adresse außer Loopback, mit Prozessname. Für jede Adresse einmal `Resolve-DnsName -Type PTR <ip>` versuchen und den Namen dazuschreiben (leer lassen, wenn keiner kommt).
- [ ] **M2 Kontextfenster:** `-Out "$o\m2" -ContextTokens 64000 -DisableTraffic -Arguments '-p "Lies die Datei STATE.md mit dem Read-Werkzeug und nenne in einem Satz den naechsten Schritt." --max-turns 4 --output-format json'`. Aus `m2.json` notieren: `modelUsage.<modell>.contextWindow` (Erwartung 64000), `stop_reason`, `num_turns`, `usage.input_tokens`, `ttft_ms`, `duration_ms`, und ob `result` ein ganzer Satz ist.
- [ ] **M3a Tempo und Wiederverwendung (12B):** M2 direkt danach ein zweites Mal mit `-Out "$o\m3a"`. Notieren: `ttft_ms` und `duration_ms` beider Läufe. Ist der zweite Lauf deutlich schneller, nutzt LM Studio den gleichen Prompt-Anfang wieder.
- [ ] **M3b Tempo (26B-A4B):** nur wenn geladen: M2 zweimal mit `-Model google/gemma-4-26b-a4b-qat -Out "$o\m3b-1"` bzw. `"$o\m3b-2"`. Dieselben Werte notieren.
- [ ] **M4 TL;DR (strukturierte Antwort):** Datei `$o\m4-input.txt` mit dem Inhalt `Benutzer: Bau mir einen Knopf. Agent: Knopf gebaut in Button.tsx.` anlegen (Write-Werkzeug, UTF-8). Aufruf: `-Out "$o\m4" -ContextTokens 64000 -DisableTraffic -InputFile "$o\m4-input.txt" -Arguments '-p --tools "" --safe-mode --strict-mcp-config --no-session-persistence --system-prompt "Fasse das Gespraech in einem Satz zusammen." --json-schema "{\"type\":\"object\",\"properties\":{\"summary\":{\"type\":\"string\"}},\"required\":[\"summary\"]}" --output-format json'`. Erwartung: `m4.json` hat `is_error: false` und ein Objekt `structured_output` mit `summary`. Notieren: ja/nein und, wenn nein, `result` bzw. den Fehlertext. Scheitert es am Quoting statt am Modell (Fehler der Kommandozeile über Argumente), Quoting korrigieren und erneut — erst ein Lauf, der das Modell erreicht, zählt.
- [ ] **M5 Claude-Session lokal fortsetzen:** `$id = [guid]::NewGuid().ToString()`. Schritt 1 mit Claude: `-Claude -Out "$o\m5a" -Arguments "-p `"Merke dir das Wort Bisasam. Antworte nur mit OK.`" --session-id $id --output-format json"`. Schritt 2 lokal: `-Out "$o\m5b" -ContextTokens 64000 -DisableTraffic -Arguments "-p `"Welches Wort solltest du dir merken? Nur das Wort.`" --resume $id --output-format json"`. Erwartung: `result` von m5b enthält „Bisasam“, `is_error: false`. Notieren: Ergebnis und jeden Fehlertext.

## Abbruch- und Verzweigungsregeln

- M1a ohne externe Verbindung → stoppen (siehe oben). Alles andere stoppt den Plan nicht.
- M1b mit verbleibenden externen Verbindungen → kein Stopp. Die Adressen kommen in ADR 015 unter „Konsequenzen“ (Phase 2) und in die Antwort an den Benutzer als 🟡.
- M2 meldet weiter 200 000 → kein Stopp; FINDINGS-Eintrag `- [ ] → Phase 2: CLAUDE_CODE_MAX_CONTEXT_TOKENS wirkt nicht; Risiko „Kontext läuft über“ in ADR 015 aufnehmen`.
- M4 ohne `structured_output` → FINDINGS-Eintrag `- [ ] → Phase 2: TL;DR-Variante B (im lokalen Betrieb nicht verfügbar)`. Mit `structured_output` → Variante A.
- M5 scheitert → FINDINGS-Eintrag `- [ ] → Phase 3: Smoke 1 erwartet Fehler; Satz in ADR 015: Wechsel mitten in einer Claude-Session setzt den Verlauf nicht fort`.

## AK der Phase

- Für M1a, M1b, M2, M3a, M4 (und M3b/M5, wenn möglich) stehen die notierten Werte in der README unter „Messungen“ als neuer Unterabschnitt „Phase 1 (Datum)“, je Messung eine Zeile mit Aufruf-Kürzel, Werten und Urteil gegen die Erwartung aus dieser Datei.
- `docs/knowledge/claude-stream-json.md` hat einen Abschnitt „Lokales Modell über `ANTHROPIC_BASE_URL`“ mit den belegten Fakten (welche Variablen wirken, gemessene Verbindungen, `contextWindow`, `structured_output`, `--resume`) und der Version der Kommandozeile (`claude --version`).
- FINDINGS enthält die Verzweigungs-Einträge nach den Regeln oben.

## Checkliste

- [ ] Voraussetzungen erfragt und geprüft.
- [ ] Messungen M1a–M5 wie oben.
- [ ] README „Messungen“ ergänzt, Knowledge-Datei ergänzt, FINDINGS-Einträge gesetzt.
- [ ] Commit `docs(agents): Messung lokales Modell über LM Studio` (nur Doku).
- [ ] Ergebnis dem Benutzer in drei Zeilen melden (Netz, Kontext/Tempo, TL;DR/Fortsetzen), Freigabe für Phase 2 abwarten.

## Report-Back
