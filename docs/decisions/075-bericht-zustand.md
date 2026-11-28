# 075 — Review-Bericht: Zustand des Ordnens, Bericht ohne Einträge

**Status:** angenommen · **Datum:** 2026-11-28

## Kontext

Station #14 hatte keinen Eintrag im Bericht. Haiku lief nicht, und die Seite zeigte nur, dass es kein geordnetes Ergebnis gibt — ohne zu sagen, ob noch eines kommt. Geordnet wurde bisher nur am Phasenende (ADR 073); ein laufender Aufruf war weder sichtbar noch abbrechbar.

## Optionen

- Seite nur umtexten: der leere Bericht bliebe leer.
- Stationen allein per Anweisung zum Erklären bringen: belegt nicht verlässlich, siehe Anlass.
- Verwalter ordnet auch ohne Einträge, zeigt den Lauf und fragt bei der Fertigmeldung einmal nach.

## Entscheidung

- Haiku ordnet auch ohne Einträge, solange die Spur nicht leer ist: Ergebnis und Weg aus Verlauf und Diff, keine Stopps aus Einträgen.
- Ordnen geht jederzeit. Auf einer laufenden Phase entsteht ein Zwischenstand ohne Prüfwerte. Endet die Phase während eines solchen Laufs, folgt danach die Ordnung des Phasenendes. Der gespeicherte Stand der Ordnung (`tidy_at`) ist der Zeitpunkt vor dem Lesen der Eingabe, damit während des Aufrufs geschriebene Dateien als neu zählen.
- Abbruch über ein Flag im Haiku-Aufruf, geprüft alle 250 ms; die vorherige Ordnung bleibt, ohne Fehlersatz.
- Die erste Fertigmeldung einer Station mit geschriebenen Dateien und ohne Bericht-Eintrag wird mit einem Hinweis abgelehnt, die zweite geht durch. Gemerkt wird das nur im Speicher; ein Lesefehler lehnt nie ab.
- Repositorys außerhalb des Vorhabens findet der Bericht über `session_files` und liest sie aus Git; der Diff kommt nie aus Werkzeug-Eingaben.
- Dateien ohne Erklärung bekommen je Repository einen Stopp aus dem Diff.

## Konsequenzen

- Keine Migration.
- Ein Haiku-Aufruf auch für Phasen ohne Einträge.
- Die Ablehnung trifft einmalig auch Stationen, deren einzige geschriebene Dateien außerhalb jedes Repositorys liegen, und Sessions ohne die `report_`-Werkzeuge.
- Nach einem Neustart der App kann eine Station den Hinweis erneut bekommen.
