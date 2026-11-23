# Entwurf: Suche in Vault und Bibliothek – gegliedert

**Status:** zur Abnahme vorgelegt (Phase 6, Station „Entwurf“, dritte Runde). Die Vorschläge A/B/C der zweiten Runde sind ersetzt durch einen Dialog, der nach Gruppen gliedert. Bei der Abnahme wählt der Benutzer noch den Einstieg (1/2/3).

## Ansehen

- [vault-suchdialog.html](vault-suchdialog.html) im Browser öffnen; Einzeldatei.
- Entwurfsleiste oben (nicht Teil der App): Ausbau Phase 6 / Bibliothek, Einstieg 1/2/3, Zustand, Breite, Thema, Agenten-Werkzeug, ⓘ Aufbau.
- Seitenleiste, Einstellungszeilen und Schalter nach `src/app/Sidebar.css`, `SettingRow.css`, `Switch.css`; Farben aus `src/styles/theme.css` (Stand 2026-11-23). Skill-, Befehls- und Stil-Namen echt (Auswahl, Beschreibungen gekürzt); Wissens-Einträge erfunden.

## Aufbau

| Bereich | Inhalt |
|---|---|
| Kopf | Titel („Developer Vault“ in Phase 6, „Bibliothek“ im Folgeplan), Suchfeld mit Lupe, Leeren-Knopf, ⓘ, Statuszeile rechts |
| Links: Gruppen | „Überblick“ (ohne Suche) bzw. „Alle Treffer“; darunter Gruppen mit Untergruppen und Anzahl. Während einer Suche zählen sie Treffer, leere Untergruppen fallen weg |
| Mitte: Liste | je Eintrag Symbol, Titel, eine Zeile Beschreibung. Ohne Suche „Zuletzt geändert“ (10). Mit Suche Abschnitte je Untergruppe, in „Alle“ höchstens vier je Abschnitt plus „alle n zeigen“ |
| Rechts: Vorschau | Ort „Gruppe › Untergruppe“, Titel, Beschreibung, „Öffnen“ (primär) und „Im Ordner zeigen“ fest oben; darunter Fundstelle mit Abschnitt und Zeile oder Bild, zuletzt der Dateipfad |
| Fuß | „n von m Treffern“, bei Abgleich „Index wird noch aufgebaut“, Tastenhilfe |

Gruppen und Untergruppen:

| Gruppe | Untergruppen | Regel |
|---|---|---|
| Anweisungen | Grundregeln, Ausgabestile | `CLAUDE.md`, `AGENTS.md` im Wurzelordner; `output-styles/` |
| Skills | Arbeitsweise, Sprachen, Frameworks, Werkzeuge, Befehle | `skills/mode-*`, `skills/lang-*`, `skills/framework-*`, übrige `skills/*`, `commands/` |
| Wissen | je Ordner der ersten Ebene (inbox, snippets, wissen, …) | alles übrige; Untergruppe = erster Ordner im Pfad |

Gruppen ohne Einträge entfallen. In Phase 6 gibt es nur die Gruppe Wissen; Anweisungen und Skills kommen mit dem Folgeplan Bibliothek.

Bedienung: ↑/↓ wählt, Enter öffnet, Ctrl Enter zeigt im Ordner, Ctrl 0–3 wechselt die Gruppe, Esc schließt; Klick wählt, Doppelklick öffnet; der Dialog bleibt nach dem Öffnen offen; die letzte Suche bleibt beim erneuten Öffnen markiert stehen. Unter 1180 px fällt die Vorschau weg und öffnet als zweite Stufe; unter 768 px ersetzen Chips (Alle, Anweisungen, Skills, Wissen) die linke Spalte; unter 576 px ist der Dialog ein Blatt von unten mit 44-px-Zielen.

## Einstieg und Sichtbarkeit

| Einstieg | Ort | Fuß |
|---|---|---|
| 1 · Suchzeile oben (Empfehlung) | „Vault durchsuchen  Ctrl K“ unter „Neues Vorhaben“, gleiche Bauart | unverändert, drei Zeilen |
| 2 · Paar im Fuß | „Vault“ und „Archiv“ teilen sich eine Zeile | drei Zeilen |
| 3 · Symbolleiste | Kontingent als Zeile, darunter Vault, Archiv, Einstellungen als Symbole mit Beschriftung (44 px) | zwei Zeilen; baut Archiv und Einstellungen um |

Alle drei nur bei gesetztem Ordner und eingeschaltetem Schalter; sonst sieht die Seitenleiste aus wie heute und `Ctrl K` bleibt ohne Wirkung. Im Dummy unter Einstellungen schaltbar.

## Bibliothek (Folgeplan)

Entscheidung 2026-11-23: Master-Ordner und Developer Vault werden ein Ordner („Bibliothek“); Umbau als eigener Plan nach Phase 6. Der Dummy zeigt dafür unter „Ausbau: Bibliothek“ die Gruppen Anweisungen und Skills im Dialog und in den Einstellungen den gemeinsamen Abschnitt (Ordner, Abgleich der Skills, Verknüpfungen, Suche, Suchindex, Nicht durchsucht: `memory/`, `hooks/`, Logs). Phase 6 selbst ändert die Einstellungen nicht.
