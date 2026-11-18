# Entwurf Dateien-Ansicht

Der Entwurf ist verbindlich für Aufbau, Beschriftungen, Abstände und Zustände. Farben, Schrift und Radien stammen aus `src/styles/theme.css`; im Entwurf stehen sie als feste Werte, in der Umsetzung gelten die Tokens.

## Dateien

| Datei | Inhalt | Phase |
|---|---|---|
| `entwurf-repository-ansicht.html` | Klickdummy der ganzen Ansicht: Leiste, Baum, Übersicht mit Verlauf, Datei („Änderung“, „Ganze Datei“), Suche, Chat mit Dateilinks, Ort der Git-Seite | 3 bis 7 |
| `01-uebersicht.png` | Übersicht, Baum „Geändert“, dunkel | 3 |
| `02-aenderung.png` | Datei in „Änderung“ mit Schritten, Baum „Alle Dateien“, hell | 3, 4 |
| `03-ganze-datei-zeile.png` | „Ganze Datei“ mit markierten Zeilen und angesprungener Zeile, dunkel | 4, 6 |
| `04-suche.png` | Suchliste, hell | 5 |
| `05-chat-links.png` | Dateilinks im Chat, hell | 6 |
| `06-git-seite.png` | Ort und Gliederung der Git-Seite, dunkel | 7 |
| `daten-bauen.cjs` | erzeugt die Datendatei des Klickdummys aus diesem Repository | — |

## Ansehen

Der Klickdummy braucht die Datendatei `_repository-ansicht/daten.js` neben sich (rund 6 MB, erzeugt, deshalb nicht im Repository; der Ordner steht in `.gitignore` dieses Ordners). Erzeugen, vom Repository-Wurzelordner aus:

```sh
mkdir -p /tmp/skins-stand && git archive 39c72e6 | tar -x -C /tmp/skins-stand
node docs/archive/2026-11/2026-11-18_dateien-ansicht/artifacts/daten-bauen.cjs . /tmp/skins-stand docs/archive/2026-11/2026-11-18_dateien-ansicht/artifacts/_repository-ansicht/daten.js
```

Danach `entwurf-repository-ansicht.html` im Browser öffnen. Syntaxfarben lädt die Seite von `cdnjs.cloudflare.com`; ohne Netz bleibt der Code einfarbig. Jeder Zustand hat eine Adresse hinter `#`, z. B. `#d=skins&m=alle&f=0|src/app/Sidebar.tsx&vw=datei&ln=446` (Datei, Ansicht, Zeile), `#d=skins&q=skin` (Suche), `#d=skins&t=chat` (Chat), `#d=skins&pg=git:0` (Git-Seite), `&th=dark` bzw. `&th=light` (Thema).

## Was Beispiel ist

- Daten: die Commits `9c66133..39c72e6` dieses Repositorys (Plan „Skins“) mit echtem Baum, echten Zahlen und Diffs. Die Session-Nummern sind erfunden (ein Commit je Session).
- Der Text im Chat ist Beispiel, die Pfade darin sind echt.
- Die Git-Seite zeigt nur Ort und Gliederung; ihre Bedienelemente sind in der App die vorhandenen (`src/features/git/`).
- Große Dateien, `docs/archive/` und `docs/design/` fehlen in der Datendatei; der Klickdummy sagt das an der Stelle.
- Der Schalter „Beispiel“ zeigt nur „Skins“. Ein zweites Beispiel mit mehreren Repositories gab es beim Entwerfen aus fremden Repositories; seine Daten gehören nicht in dieses Repository.

## Nicht gezeichnet

Zustände „Dateien werden gelesen …“, Fehler eines Eintrags, die Session-Auswahl mit sehr vielen Sessions, Review-Kommentare an Diff-Zeilen (bleiben wie in der App), die Fassungs-Auswahl bei einer Datei auf zwei Branches. Ihr Wortlaut und ihr Ort stehen in den Phasen-Dateien.
