# Artefakte

| Datei | Bildschirm | Phase | Ansehen |
|---|---|---|---|
| `bericht-ohne-eintraege.html` | Reiter „Review“, Seite einer Phase samt Inhaltsverzeichnis und Reiterpunkt | 4 (Maße, Farben, Texte); 1–3 (welche Daten die Seite braucht) | im Browser öffnen; Leiste oben schaltet die Zustände, „Hell/Dunkel“, ⓘ zeigt Aufgabe und Regeln; Zustand per Adresse: `?zustand=work\|zwischen\|running\|empty\|done\|failed&thema=light\|dark` |
| `_bericht-ohne-eintraege/entwurf.css` | Stile des Entwurfs | 4 | Tokens 1:1 aus `src/styles/theme.css`; Bauteile nach den bestehenden `Report*.css` |
| `_bericht-ohne-eintraege/daten.js` | Daten des Entwurfs | — | echter Verlauf der Station #14 (Phase 2 von „Review-Bericht abschaltbar“): Aufrufe, Edits, Meldung |

- Design-System: Theme des Verwalters (`src/styles/theme.css`); für Schrift auf Bernstein und Akzent nutzt der Entwurf schon die lesbaren Werte aus Phase 5.
- Platzhalter: Haiku-Texte und der Zeitpunkt des Ordnens sind Beispiele und im Entwurf als „Beispieltext“ gekennzeichnet; die Titel der Etappen im Entwurf sind frei formuliert (Umsetzung: Beschreibung des ersten Befehls, siehe README → Abweichungen).
- Neu erzeugen: `daten.js` aus der Datenbank mit dem Skript, das die Session-Daten der Station #14 liest (nicht im Repo); der Entwurf selbst ist handgeschrieben.
