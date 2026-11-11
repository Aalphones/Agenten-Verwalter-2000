# 063 — Weiter nach dem Kontingent-Limit

**Status:** angenommen · **Datum:** 2026-11-11

## Kontext

Eine Umsetzung soll über Nacht ohne Benutzer durchlaufen. Rennt eine Station ins Kontingent-Limit (5-Stunden- oder Wochenfenster), beendet Claude Code die Antwort mit einer Fehler-`result`-Zeile („You've hit your session limit · resets 2:10pm (Europe/Berlin)“). Der Verwalter machte daraus „Fehler vom Agenten“ und den Status `Error`; `Error` sperrt jedes weitere Senden. Die Station blieb tot, bis der Benutzer eingriff — auch wenn das Kontingent längst wieder frei war.

## Optionen

- **(a) Claudes Schalter `autoContinueAtUsageLimit` durchreichen** — verworfen: Er wirkt nur im Limit-Dialog der interaktiven Oberfläche, wird nur aus `~/.claude/settings.json` gelesen und ist serverseitig geschaltet (Beleg: Zeichenketten in `claude.exe` 2.1.322). Stationen laufen als Kommandozeile ohne Dialog; dort ist die Wirkung unbelegt.
- **(b) Der Verwalter wartet selbst** — gewählt: Er kennt die Reset-Zeit schon aus `rate_limit_event` und steuert Stationen ohnehin.

## Entscheidung

- **Erkennung (Limit-Stopp):** Eine Antwort endet am Limit, wenn in ihr ein `rate_limit_event` mit Status `rejected` kam oder der Fehlertext „hit your … limit“ bzw. „usage limit reached“ enthält. Der Text ist der Rückfall, weil die Reihenfolge von Ereignis und `result`-Zeile nicht gemessen ist.
- **Status `Completed` statt `Error`** für jede Claude-Session nach einem Limit-Stopp; der Verlauf zeigt „Kontingent aufgebraucht“ mit dem Text der Kommandozeile. „Automatisch weiter“ der Einstiegszeilen (ADR 040) bleibt aus, weil die Antwort nicht fertig ist.
- **Warten nur für Stationen** und nur bei eingeschalteter Einstellung „Nach Kontingent-Limit automatisch weiter“ (`autoContinueAtLimit`, Standard aus). Weiter um Reset-Zeit + 2 min; ohne Reset-Zeit oder bei einer Reset-Zeit in der Vergangenheit 15 min nach dem Stopp. Höchstens 8 Limit-Stopps hintereinander ohne normal beendete Antwort, danach wartet die Station auf den Benutzer.
- **Wachhalten** per `SetThreadExecutionState`, nur bei eingeschalteter Einstellung und nur, solange eine Station läuft oder aufs Kontingent wartet.

## Konsequenzen

- Keine Migration; die Einstellung liegt in der Tabelle der Einstellungen.
- Einzel-Sessions sind nach einem Limit-Stopp ansprechbar statt „Fehler“, werden aber nie automatisch weitergeschickt.
- Zuklappen des Laptops folgt weiter der Windows-Energieeinstellung „Beim Zuklappen“; `SetThreadExecutionState` verhindert nur den Schlaf durch Untätigkeit.
- Eine Nachricht des Benutzers an die wartende Station, Abbrechen oder Löschen der Umsetzung und Schließen der Session verwerfen das Warten.
- Nach einem Neustart der App wartet nichts mehr (wie der Countdown aus ADR 040); die Station steht dann auf „wartet auf dich“.
