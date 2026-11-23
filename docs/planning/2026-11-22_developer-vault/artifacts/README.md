# Entwurf: Vault-Suche – drei Vorschläge

**Status:** zur Abnahme vorgelegt (Phase 6, Station „Entwurf“, zweite Runde). Bei der Abnahme wählt der Benutzer einen Vorschlag und einen Einstieg; danach werden die AK in `phase-6-suchdialog.md` auf diesen Vorschlag festgelegt.

## Ansehen

- [vault-suchdialog.html](vault-suchdialog.html) im Browser öffnen; Einzeldatei.
- Entwurfsleiste oben (nicht Teil der App): Vorschlag A/B/C, Einstieg Fußleiste/Oben, Einstellungen Heute/Bibliothek, Zustand, Breite, Thema, Agenten-Werkzeug, ⓘ Vergleich mit Stärken und Schwächen.
- Seitenleiste, Einstellungszeilen und Schalter nach `src/app/Sidebar.css`, `SettingRow.css`, `Switch.css`; Farben aus `src/styles/theme.css` (Stand 2026-11-23). Treffer erfunden; Skill-, Befehls- und Stil-Namen echt.

## Vorschläge

| Vorschlag | Form | Klick | Nach dem Öffnen |
|---|---|---|---|
| A · Liste | Archiv-Muster, Treffer mit Pfad, Beschreibung, Ausschnitt; Knöpfe in der Titelzeile der gewählten Zeile | erster wählt, zweiter öffnet | bleibt offen, Fußzeile bestätigt |
| B · Palette | oben verankert, ein Treffer je Zeile; Beschreibung, Ausschnitt und Knöpfe in einer festen Leiste unten | öffnet | schließt, kurze Bestätigung |
| C · Vorschau (Empfehlung) | Liste links, Vorschau rechts: Fundstelle mit Abschnitt und Zeile, Bild, Knöpfe fest oben | wählt; Doppelklick öffnet | bleibt offen |

Gemeinsam: Suchfeld mit Lupe, Leeren-Knopf und ⓘ; letzte Suche bleibt beim erneuten Öffnen markiert stehen; ↑/↓, Enter, Ctrl Enter (im Ordner), Esc; das Layout springt beim Wählen nicht; unter 576 px Blatt von unten mit 44-px-Zielen, C unter 768 px zweistufig.

## Einstieg und Sichtbarkeit

Im Fuß stehen heute Kontingent, Archiv und Einstellungen. Damit er nicht auf vier Zeilen wächst, gibt es drei Anordnungen:

| Einstieg | Ort | Fuß |
|---|---|---|
| 1 · Suchzeile oben (Empfehlung) | „Vault durchsuchen  Ctrl K“ unter „Neues Vorhaben“, gleiche Bauart | unverändert, drei Zeilen |
| 2 · Paar im Fuß | „Vault  Ctrl K“ und „Archiv“ teilen sich eine Zeile | drei Zeilen |
| 3 · Symbolleiste | Kontingent als Zeile, darunter Vault, Archiv, Einstellungen als Symbole mit Beschriftung (44 px) | zwei Zeilen; baut Archiv und Einstellungen um |

Alle drei nur bei gesetztem Ordner und eingeschaltetem Schalter; sonst sieht die Seitenleiste aus wie heute und `Ctrl K` bleibt ohne Wirkung. Im Dummy unter Einstellungen schaltbar.

## Bibliothek (Folgeplan)

Entscheidung 2026-11-23: Master-Ordner und Developer Vault werden ein Ordner („Bibliothek“); Umbau als eigener Plan nach Phase 6. Der Dummy zeigt dafür die Arten Skill, Befehl, Ausgabestil in der Suche und unter „Einstellungen: Bibliothek“ den gemeinsamen Abschnitt (Ordner, Abgleich der Skills, Verknüpfungen, Suche, Suchindex, Nicht durchsucht: `memory/`, `hooks/`, Logs). Phase 6 selbst ändert die Einstellungen nicht.
