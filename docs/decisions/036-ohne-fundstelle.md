# 036 — Angaben ohne Fundstelle

**Status:** angenommen · **Datum:** 2026-10-22

## Kontext

Eine Antwort des Agenten nennt Pfade, Zeilennummern und Zahlen, die er nie nachgesehen hat. Im Verlauf sehen sie genauso aus wie belegte. Der Verwalter kennt beide Seiten: den Antworttext und alles, was die Werkzeuge in derselben Antwort geliefert haben.

## Optionen

- **(a) Ein Modell prüft die Antwort.** Verworfen: ein weiterer Ratgeber, der selbst falsch liegen kann, und Kosten bei jeder Antwort.
- **(b) Mechanischer Abgleich mit den Werkzeug-Ausgaben.** Gewählt.
- **(c) Werkzeug-Ausgaben dauerhaft speichern.** Verworfen: die Datenbank wüchse mit jeder gelesenen Datei. Gespeichert wird nur die Liste der Treffer.

## Entscheidung

- **Geprüft** werden Pfade, Datei:Zeile-Angaben und Zahlen ab zwei Ziffern. Nicht geprüft: einstellige Zahlen, Datumsangaben, Uhrzeiten, Versionsnummern mit zwei Punkten und alles in Code-Blöcken mit Zaun.
- **Quellen einer Antwort:** der Text aller Werkzeug-Ergebnisse des Hauptagenten, die Pfade und Befehle der Werkzeug-Aufrufe und die Nachricht des Users, mit der die Antwort begann. Nicht: Eingaben der Werkzeuge (sonst belegte sich der Agent mit dem, was er selbst in ein Edit schreibt).
- **Großzügig vergleichen:** Zahlen ohne Trenner und ohne `%`; bei Pfaden zählt der Dateiname, bei Datei:Zeile zusätzlich die Zeilennummer als Zahl. Lieber eine Marke zu wenig als eine zu Unrecht.
- **Im Core, in der Session-Sperre:** der Abgleich läuft beim Ende der Antwort über die Text-Einträge dieser Antwort; die Treffer stehen als `unsourced` im Eintrag, die `seq` der betroffenen Einträge in `TurnSummary`. Die Quellen bleiben im Speicher und werden danach verworfen.
- **Immer rechnen, wahlweise zeigen:** der Core rechnet unabhängig vom Schalter in den Einstellungen.
- **Marke als Zeichenkette, nicht als Position:** die Oberfläche markiert jedes Vorkommen im gerenderten Text; Positionen überlebten das Markdown-Rendern nicht.

## Konsequenzen

- Ausgaben von Subagenten zählen nicht als Quelle; sie erreichen den Übersetzer nicht.
- Über 4 MB Quellen je Antwort wird nichts markiert, statt halb zu prüfen.
- Tokenzahlen, Prozentwerte und Zeilennummern, die der Agent aus der Kontext-Anzeige oder dem Zeilenpräfix einer gelesenen Datei kennt, werden entsprechend behandelt: erstere markiert, letztere zählen als belegt.
- Die Regeln stehen nur in `src-tauri/src/sourcing/mod.rs`.
