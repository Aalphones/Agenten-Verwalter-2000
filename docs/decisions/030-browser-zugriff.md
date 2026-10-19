# 030 — Browser-Zugriff (Claude in Chrome)

**Status:** angenommen · **Datum:** 2026-10-19

## Kontext

Im Terminal erlaubt `claude --chrome` bzw. der Befehl `/chrome` dem Agenten, den echten Chrome des Users mit dessen Anmeldungen zu bedienen (Erweiterung „Claude in Chrome“). Der Verwalter fährt den Agenten im Druckmodus (`-p`); dort kommt `/chrome` nicht an, die Startoption `--chrome` dagegen schon ([Messung](../knowledge/claude-stream-json.md#claude-in-chrome)).

## Optionen

- **Auslöser:** (a) `/chrome` als Text an den Agenten durchreichen; (b) eigener Schalter pro Session, der den Startaufruf steuert.
- **Startaufruf:** (a) nur `--chrome`, wenn an; (b) immer ausdrücklich `--chrome` oder `--no-chrome`.
- **Wirksamwerden:** (a) laufenden Agenten sofort neu starten; (b) beim nächsten Senden, nur wenn der Agent ruht.

## Entscheidung

**(b), (b) und (b).**

- **Ein Wert pro Session**, `chrome`, Standard aus, in der Datenbank gespeichert (Migration 10). Neue Sessions starten immer ohne Browser; eine Übergabe an eine Nachfolge-Session erbt ihn nicht.
- **`/chrome` durchreichen ist verworfen:** geht im Druckmodus ins Leere. Der Verwalter fängt `/chrome` selbst ab, als Zeile im Abschnitt „Session“ des Befehlsmenüs; die Zeile geht nie als Text an den Agenten.
- **Ausdrücklich in beide Richtungen:** Im Claude-Betrieb bekommt der Agent immer `--chrome` oder `--no-chrome`. So entscheidet der Schalter und nicht eine Voreinstellung in der Claude-Konfiguration des Users.
- **Nur im Claude-Betrieb.** Bei LM Studio und beim autarken Agenten setzt der Core keine der beiden Optionen, und die Oberfläche zeigt keinen Schalter. Der gespeicherte Wert bleibt dabei stehen.
- **Wirksam beim nächsten Start**, nach dem Muster des Denkaufwands: Der Core merkt sich, mit welchem Wert der laufende Prozess gestartet wurde. Weicht der gewünschte Wert ab, startet das nächste Senden den Agenten mit `--resume` neu, aber nur wenn die Session ruht — wie beim Wechsel der Betriebsart. Ein arbeitender Agent wird nie unterbrochen.

## Konsequenzen

- Umschalten kostet einen Neustart des Agenten; seine MCP-Server verbinden dabei neu.
- Fehlt Chrome oder die Erweiterung, meldet das der Agent bzw. die MCP-Übersicht; der Verwalter prüft es nicht vorab.
- Ohne Messung offen: Freigabe der Browser-Werkzeuge über den Freigabedialog des Verwalters und `--resume` zusammen mit `--chrome`.
