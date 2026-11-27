# Artefakte — Review-Bericht

| Datei | Screen | Phase | Ansehen |
|---|---|---|---|
| `review-bericht-entwurf.html` + `_review-bericht-entwurf/` | Reiter „Review“ einer Umsetzung bzw. Station: Leiste, Inhalt, Überblick, Phasen-Seite, Sichtabnahme (Phase 5 des Beispiels), Stopps, Code mit Randnotizen, Schaubilder, Bilder, Kommentare, Abnahme | 5, 6, 7 (Daten: 1, 3, 4) | Datei im Browser öffnen (lädt highlight.js und Mermaid per CDN) oder als Artefakt im Verwalter |

- **Verbindlich:** Aufbau, Reihenfolge der Abschnitte, Bedienung (Sprünge, Blättern, Einklappen, Schalter der Schaubilder, Kommentarfeld, Abnehmen mit Rückgängig), Farben der Anmerkungsarten, Breiten (Inhalt 256 px, Seite bis 1120 px, Randnotizen ab 940 px, Blatt unter 760 px).
- **Werte:** Farben und Schriften im Entwurf kommen aus `_review-bericht-entwurf/tokens.css`/`theme.css` (Abbild der App-Tokens); in der App gelten die Tokens aus `src/styles/theme.css`.
- **Platzhalter bzw. Beispiel:** Stationsnummern, Agententexte, Haiku-Texte, Testzahlen, Abdeckung und Mutanten in `daten.js`; Code, Commits und Bilder stammen aus der Umsetzung „Session-Dateien“ (Commits `35ab05f`, `0197ce8`); die Fotos der Sichtabnahme sind die Prüfbilder ihrer Phase 5, die Entwurfsbilder (`e-*.png`) Abzüge ihres freigegebenen Entwurfs (`docs/archive/2026-11/2026-11-25_session-dateien/artifacts/entwurf-session-dateien.html`, Zustand `#v=files&f=f4`, oben zugeschnitten); beide Abweichungen im Beispiel sind echt.
- **Nur im Entwurf, entfällt in der App:** Entwurfsleiste (Variante A/B, Zustand, „Werkzeuge zeigen“, Thema, Info), Tooltags, die Fassungen „Rohfassung/Geordnet“ unter jeder Phase (druckt `report-probe`), die nachgebaute Seitenleiste und Kopfzeile des Verwalters, Variante B „Zwischen den Zeilen“ als Wahl (in der App nur als Ausweichform unter 940 px).
- **Neu erzeugen:** nicht nötig; die Dateien sind von Hand geschrieben. Ansichten per URL-Parameter: `?zustand=bereit|waechst|abgenommen|fehler`, `?schaubild=vorher|nachher`, Sprung `#/p/<Phase>` bzw. `#/s/<Stopp>`.
