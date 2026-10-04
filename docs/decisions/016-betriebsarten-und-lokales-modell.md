# 016 — Betriebsarten und lokales Modell über LM Studio

**Status:** angenommen · **Datum:** 2026-10-04

## Kontext

Ist das Kontingent des Claude-Abos aufgebraucht, hängen alle Sessions. Der Benutzer will dann weiterarbeiten können — mit einem Modell, das in LM Studio auf dem eigenen Rechner läuft, aber mit denselben Werkzeugen, Skills, Hooks und Anweisungen wie sonst. Die Claude-Kommandozeile kann Modellanfragen über `ANTHROPIC_BASE_URL` an einen anderen Server schicken; LM Studio spricht dieses Protokoll.

## Optionen

- **Wie die Anfragen umgeleitet werden:** (a) Umgebungsvariablen am Agent-Prozess; (b) eigene Kopie der Kommandozeile plus Windows-Firewall-Sperre, damit sicher nichts an Anthropic geht; (c) ein eigener Agent im Verwalter, ohne Claude-Kommandozeile (das ist die dritte Betriebsart des Plans „Autarker Agent“).
- **Wo die Betriebsart gilt:** je Session oder für die ganze App.
- **Name:** „Modus“ oder „Betriebsart“.

## Entscheidung

- **(a).** Der Benutzer will den einfachsten Weg; (b) ist aufwendig, (c) ein eigener, großer Plan. Es bleibt dieselbe Kommandozeile, nur Umgebung und `--model` ändern sich. Kein Provider-Trait — der entsteht mit dem zweiten Anbieter (ADR 003), das ist erst der autarke Agent.
- **Betriebsart, nicht Modus** — „Modus“ ist im Glossar für Manuell/Automatisch bearbeiten/Planen/Auto vergeben. Werte `Claude` und `ClaudeCodeLocal`.
- **Global in den Einstellungen, nicht je Session.** Das Kontingent gilt fürs ganze Konto; eine Auswahl je Session mischt Betriebsarten, und „nichts geht an Anthropic“ hinge an der Aufmerksamkeit des Benutzers.
- **Wirkt ab dem nächsten Agent-Start.** Ein laufender Agent wird nie unterbrochen; `send` startet ihn neu, sobald er ruht und sich das gewünschte Backend vom laufenden Prozess unterscheidet. Die Kommandozeile setzt den Verlauf mit `--resume` fort.
- **Das gespeicherte Claude-Modell der Session bleibt unangetastet.** Im lokalen Betrieb wird es ignoriert und gilt nach dem Zurückschalten wieder. Sidebar und Session-Karten zeigen im lokalen Betrieb deshalb weiter das gespeicherte Claude-Modell.
- **Das lokale Modell wählt man nur in den Einstellungen,** und nur geladene Modelle sind wählbar. Das Kontextfenster ist die geladene Kontextlänge (`loaded_context_length`) beim Agent-Start; es geht als `CLAUDE_CODE_MAX_CONTEXT_TOKENS` an die Kommandozeile und wird das Fenster der Session.
- **LM Studio wird bei jedem Agent-Start einmal gefragt** (`GET /api/v0/models/<id>`, Zeitlimit 3 s), vor der Session-Sperre. Nicht erreichbar oder Modell nicht geladen → `CommandError::LocalModelUnavailable` mit einem Satz; der Agent startet nicht, die Nachricht bleibt im Eingabefeld. Eine offene Rückfrage lässt sich auch bei ausgeschaltetem LM Studio beantworten.
- **Adresse** aus `VERWALTER_LMSTUDIO_URL`, Standard `http://localhost:1234`; keine Einstellungszeile. Das Token ist fest `lmstudio` (LM Studio prüft ohne „Require Authentication“ keinen Schlüssel); ein geerbter `ANTHROPIC_API_KEY` wird entfernt.
- **Denkaufwand entfällt:** kein `--effort` im lokalen Betrieb; der gespeicherte Wert bleibt.
- **Kontingent:** im lokalen Betrieb keine Abfrage; `usage_refresh` kehrt stumm zurück.
- **TL;DR läuft lokal** mit derselben Umgebung und dem lokalen Modell (Variante A, Messung M4).
- **Nicht nötiger Netzverkehr aus:** `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` und `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL=1`. Alle vier Modellnamen (Fable, Opus, Sonnet, Haiku) und das Subagenten-Modell zeigen auf das lokale Modell, damit Nebenanfragen wie der Sitzungstitel nicht mit einem Claude-Namen bei LM Studio scheitern.

## Konsequenzen

- **Keine Garantie, dass nichts an Anthropic geht.** Gemessen mit 200-ms-Abtastung der Verbindungen: ohne die beiden Schalter gingen Verbindungen an `140.82.121.6:443` (GitHub) und `2607:6bc0::10:443`; mit den Schaltern blieb es in fünf Läufen bei Loopback. Eine Verbindung zwischen zwei Abtastungen bleibt unsichtbar.
- **Kontextfenster:** `contextWindow` kam mit `CLAUDE_CODE_MAX_CONTEXT_TOKENS` richtig an (64 000 bei Kontext 64 000); ohne die Variable nimmt die Kommandozeile 200 000 an. Im Statistik-Block steht daneben der Eintrag des Claude-Modells einer früheren Session — mitgeführt, keine Verbindung nach außen.
- **Tempo und Füllung:** je Anfrage 31 000 bis 38 000 Eingabe-Token (System-Prompt, Werkzeuge, Anweisungen des Benutzers), erstes Token nach 45 bis 73 s, ein Lauf mit zwei Anfragen 127 s. Bei Kontext 64 000 füllt sich das Fenster nach wenigen Runden; ist es voll, bricht die Antwort mitten im Satz ab (`stop_reason: max_tokens`). Lange Wartezeit und volles Fenster sind das Betriebsrisiko dieser Betriebsart.
- **Werkzeug-Ketten sind unzuverlässig:** ein Lauf endete nach 13,6 min mit `error_max_turns`, weil das Modell endlos Werkzeuge aufrief; derselbe Aufruf gelang danach in 127 s.
- **Wechsel mitten in einer Claude-Session geht** (`--resume` mit dem lokalen Modell), ist aber langsam (erstes Token nach 224 s) und löst eine `compact`-Anfrage aus, wenn der Verlauf nicht ins lokale Fenster passt.
- **TL;DR lokal geht:** `structured_output` kam im lokalen Betrieb in 9 s.
- **Das Modell liest die Anweisungen des Benutzers** und hängt dadurch unaufgefordert Persona-Zeilen an die Antwort.
- claude.ai-Connectoren sind abgeschaltet, sobald eine andere Anmeldung gesetzt ist.
- Die dritte Betriebsart, Autark, baut der Plan „Autarker Agent“ (ADR 017, noch nicht geschrieben) auf dieser auf.
