# 060 — Umsetzung abbrechen und löschen

**Status:** angenommen · **Datum:** 2026-11-09

## Kontext

Ein Vorhaben hat höchstens eine unfertige Umsetzung (ADR 048, `db::implementations::unfinished_of_project`). Eine ungewollte oder falsch angelegte Umsetzung ließ sich weder beenden noch entfernen; ausschalten ließ sich nur „Automatisch weiter“. Anlass am 06.11.2026: In einem Arbeits-Vorhaben blockierte eine falsch angelegte Umsetzung jede neue.

## Optionen

- **(a) Nur Löschen** — verworfen: Eine begonnene Umsetzung verlöre ihren Verlauf, obwohl er für die Sessions des Vorhabens weiter etwas erklärt.
- **(b) Abbrechen als normaler Weg, Löschen nur für abgebrochene oder nie begonnene** — gewählt.
- **(c) Agent bricht per Werkzeug direkt ab** — verworfen: Abbrechen und Löschen sind nicht umkehrbar; die Entscheidung bleibt beim Benutzer.

## Entscheidung

- **Abbrechen** setzt `finished_at` und `cancelled_at` auf jetzt, schaltet Automatik und Halt aus, verwirft einen offenen Plan-Vorschlag (`pending_change`) und eine offene Anfrage (`pending_cancel`) und beendet alle Countdowns der Umsetzung. Sie gilt damit als abgeschlossen; eine neue Umsetzung im Vorhaben ist sofort möglich. Phasen, Stationen, Verlauf und die Sessions der Stationen bleiben. Eine schon abgeschlossene Umsetzung lässt sich nicht abbrechen („Umsetzung ist schon abgeschlossen.“).
- **Nach dem Abbrechen startet nichts mehr:** Die Ansicht setzt offene Stationen nicht mehr auf bereit, `start::schedule_ready` plant nichts, `start::start_now` (auch über den Zeitgeber) lehnt mit „Die Umsetzung ist abgebrochen.“ ab. Eine Fertigmeldung einer Station der abgebrochenen Umsetzung lehnt `plan_completion` ab.
- **Löschen** ist erlaubt, wenn die Umsetzung abgebrochen ist oder keine Phase begonnen hat (`changes::may_delete`); eine normal fertige Umsetzung bleibt als Archiv. Die Zeile in `implementations` wird gelöscht, Phasen, Stationen und Änderungen gehen per Kaskade mit. In derselben Transaktion verlieren Rückfragen ihren Verweis (`sessions.inquiry_of = NULL`). Im Speicher leert die Registry `station_of` und `inquiry_of` jeder Session des Vorhabens, die auf die Umsetzung zeigt. Die Sessions selbst bleiben.
- **Eine arbeitende Station sperrt** Abbrechen, Löschen und das Bestätigen einer Anfrage: Zustand `Starting`, `Running` oder `WaitsForScript` (`changes::blocking_station`) oder eine Station, deren Session gerade angelegt wird (`Countdowns::is_starting`). Fehlertext: „Station „<Stufe>“ in Phase <Schlüssel> läuft noch. „Nach dieser anhalten“ einschalten und abbrechen, sobald sie fertig ist.“ `Asking` und `WaitsForYou` sperren nicht, weil der Prozess dann auf den Benutzer wartet. Kein Prozess wird beendet.
- **Agenten fragen an, der Benutzer bestätigt.** Das MCP-Werkzeug `implementation_cancel { reason (1–300 Zeichen), delete? }` legt nur `pending_cancel` an (`PendingCancel`: Session, Nummer, Zeit, Grund, `delete`) und beendet die Countdowns; Antwort „Anfrage liegt beim Benutzer.“. Ziel ist wie bei `implementation_get` die Umsetzung der Session, sonst die neueste des Vorhabens. Ohne Änderung scheitern: abgeschlossene Umsetzung, `delete: true` bei nicht löschbarer Umsetzung, schon offene Anfrage.
- **Offene Anfrage hält an:** Solange `pending_cancel` gesetzt ist, plant `schedule_ready` nichts und `start_now` lehnt mit „Eine Anfrage zum Abbrechen liegt vor; erst bestätigen oder verwerfen.“ ab. „Bestätigen“ (`implementation_apply_cancel`) bricht ab und löscht bei `delete` danach; scheitert es an einer arbeitenden Station, bleibt die Anfrage liegen. Ist die Umsetzung inzwischen regulär fertig, wird die Anfrage verworfen und das Bestätigen meldet „Umsetzung ist schon abgeschlossen.“. „Verwerfen“ (`implementation_discard_cancel`) löscht die Anfrage und plant die bereiten Stationen wie nach dem Verwerfen eines Plan-Vorschlags (`changes::schedule_if_running`).
- **Ereignisse:** Nach jeder Änderung `implementation://changed` mit der neuen Ansicht, nach dem Löschen `implementation://removed` mit `{ id }` (`ImplementationRemovedEvent`).
- **Lagebericht:** Zeile „Abgebrochen: <Zeit>“ und bei offener Anfrage „Anfrage aus #N wartet auf Bestätigen: abbrechen [und löschen] — <Grund>“.
- **Migration 019:** `implementations.cancelled_at REAL` und `implementations.pending_cancel TEXT` (JSON wie `pending_change`).

## Konsequenzen

- Eine Umsetzung, deren Station gerade arbeitet, lässt sich nur über „Nach dieser anhalten“ und danach abbrechen; hart beenden gibt es nicht.
- Zwischen der Sperrprüfung und dem Schreiben des Abbruchs bleibt ein kurzes Fenster, in dem ein Zeitgeber die Ansicht schon gelesen haben und eine Session anlegen kann. Der Startweg prüft den Abbruch beim Lesen der Ansicht, nicht nach dem Anlegen der Session.
- Nicht enthalten: einzelne Phasen oder Stationen löschen (dafür Plan-Vorschläge, ADR 059), normal fertige Umsetzungen löschen, eine laufende Station beenden.
- Die Oberfläche (Knöpfe in der Umsetzungsleiste, Karte „Umsetzung abbrechen?“) folgt in Phase 2 des Plans.
