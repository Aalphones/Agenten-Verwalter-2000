# Plan: Uhrzeiten im Chat

**Status:** freigegeben (Entwurf am 2026-11-23 abgenommen). Eine Phase, eine Umsetzungs-Station; im Plan „Developer Vault – Bibliothekskern“ als Phase 6a eingehängt.

## Ziel

Jeder Eintrag im Chat-Verlauf trägt eine Uhrzeit, damit man sieht, wann etwas geschah. Die Anzeige ist immer an — es gibt keine Einstellung.

## Entwurf (verbindlich)

[docs/design/2026-11-23_chat-uhrzeiten/](../../design/2026-11-23_chat-uhrzeiten/README.md). Abweichung vom Dummy: Er hat die Modi „Aus“ und „Beim Überfahren“, einen Einstellungsreiter und einen Schalter „Pausen markieren“. Alles davon entfällt; umgesetzt wird nur der Modus „Immer“ mit festen Pausenlinien.

## Entscheidungen

- Nachrichten des Nutzers haben die Zeit schon (`sentAt`). Alle anderen Eintragsarten bekommen ein optionales Feld `at` (Millisekunden), gesetzt beim Anlegen des Eintrags.
- Einträge ohne `at` (Bestand) zeigen keine Zeit und keinen Platzhalter.
- Ein Werkzeug-Block zeigt die Zeit seines ersten Aufrufs; ein Text, der als Zweckzeile zum Kopf eines Werkzeug-Blocks wird, bringt seine eigene Zeit mit.

## Abnahmekriterien

1. Jeder neu angelegte Eintrag aller Arten hat `at`; die ts-rs-Bindings sind neu erzeugt.
2. Die Zeit (HH:MM) steht rechts am Block; im Container unter 560 px über dem Block.
3. Nur der erste Block je Minute zeigt sie (eigene Prüfung gegen den Vorgänger mit Zeit).
4. Tageswechsel erscheint als Linie „Heute“, „Gestern“ oder „Fr., 20.11.2026“.
5. Pause ab 30 Minuten erscheint als gestrichelte Linie „34 Min. Pause“ bzw. „2 Std. 9 Min. Pause“ — nur zwischen zwei unmittelbar benachbarten Einträgen mit Zeit.
6. Tooltip der Zeit nennt Wochentag, Datum und Sekunden; `<time datetime>` ist gesetzt.
7. Bestand ohne `at` zeigt weder Zeit noch Linien; ein leerer Verlauf bleibt unverändert.
8. Nur Theme-Tokens; Zeit- und Linientext mindestens 4,5:1 in hell und dunkel.
9. Tests für die Logik (Minuten-Dedup, Tages- und Pausenlinie, Einträge ohne Zeit); `pnpm check` grün.

## Offene Prüfung für die Station

Wird der Verlauf nach einem Neustart aus einer Datei neu aufgebaut (Transkript), muss `at` dort aus dem Zeitfeld der Quelle kommen, sonst fehlt die Zeit nach dem Neustart. Die Station prüft das zuerst und meldet das Ergebnis.
