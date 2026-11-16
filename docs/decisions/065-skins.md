# 065 — Skins: Figurenpakete und Stilpakete als Daten des Benutzers

**Status:** angenommen · **Datum:** 2026-11-16

## Kontext

Der Benutzer möchte die Statuszeile mit Figuren aus Fandoms beleben (Sprites, Bewegung, Texte je Werkzeug, auch für eigene Auslöser wie `mcp__github__*`) und Farben, Hintergrundbilder und App-Symbol ändern können. Das Repository ist öffentlich und wird als Release verteilt; Sprites und Figuren gehören Dritten (z. B. Nintendo/Game Freak, Disney, Marvel). Animationen dürfen niemandem aufgezwungen werden.

## Optionen

- **(a) Fandom-Inhalte im Programm mitliefern** — verworfen: fremdes Material im öffentlichen Repository und in jedem Release.
- **(b) Pakete als Daten des Benutzers** — gewählt: der Verwalter liefert nur Bewegungen (CSS/SVG) und sachliche Texte; Bilder und Fandom-Texte legt der Benutzer selbst an, lässt sie den Agenten füllen oder importiert sie als ZIP.
- **(c) Freie CSS-Themes** — verworfen: Pakete mit eigenem CSS oder Skript wären beim Teilen ein Einfallstor; Stilpakete setzen nur feste Farbwerte und Bilder.

## Entscheidung

- Zwei Paketarten, `figures` und `style`, in einer Tabelle `skin_packs` (Migration 020) mit einer JSON-Spalte `data`; Bilder als Dateien unter `<data_dir>\skins\<Paket-ID>\`.
- Ab Werk ist alles aus: kein Figurenpaket, kein Stilpaket, Feier-Momente und Easter Eggs aus, Agenten-Werkzeuge aus. Die sachliche Statuszeile mit Werkzeug und Ziel gilt immer.
- Eigene Fächer werden vor den vorgegebenen geprüft, in ihrer Reihenfolge; das erste passende gewinnt. Muster: `*`, `?`, Groß/klein egal, Komma trennt.
- Bewegung nur an einer Stelle (Statuszeile), Mindest-Standzeit 4 s, Figur erst nach 1 s Arbeit, Feier-Momente höchstens einmal je Antwort.
- Agenten-Werkzeuge `skin_*` nur, wenn `skin_agent_tools` an ist; sie erreichen keine anderen Einstellungen und nicht diesen Schalter.
- ZIP-Austausch nur mit Daten (`skin.json` + Bilder), mit festen Grenzen.

## Konsequenzen

- Fandom-Pakete entstehen außerhalb des Repositorys; der Plan baut drei davon als ZIP neben dem Repository.
- Neue Bewegungen sind Programmcode und brauchen ein Release; Pakete nicht.
- Das App-Symbol wechselt nur im laufenden Fenster und in der Taskleiste, nicht an der exe oder der Verknüpfung. Als Symbol taugen nur PNG und ICO; GIF und WebP weist der Kern ab.

## ZIP-Format, Version 1

- Ein Paket ist ein ZIP mit `skin.json` und `bilder/<Datei>`. `skin.json` ist UTF-8, eingerückt: `{ "format": 1, "kind": "figures" | "style", "name": "…", "data": <Daten des Pakets> }`. Beim Export liegen nur Bilder darin, auf die `data` verweist.
- Der Import legt immer ein **neues** Paket an; ist der Name vergeben, hängt der Verwalter „ (2)“, „ (3)“ … an. Die Bilder heißen danach nach dem Schema des Kontrakts (`<Fach>.<Endung>`, `<Fach>-2.<Endung>`, `sidebar`, `content`, `icon`), die Endung nach dem Dateikopf; die Verweise in `data` ziehen nach.
- Abgelehnt wird mit einem Satz, ohne Rest auf der Platte: mehr als 64 Einträge; entpackt mehr als 20 MiB oder ein Bild über 2 MiB (gezählt beim Lesen, nicht nach der Angabe im Archiv); ein Eintragsname mit `..` oder `:`, mit führendem `/` oder `\` oder ein anderer als `skin.json` und `bilder/<Name>` (das leere Verzeichnis `bilder/` ist erlaubt, weil manche Packprogramme es anlegen); ein Eintrag doppelt; ein Bild, das nicht GIF, PNG, WebP oder ICO ist (ICO nur als Symbol, das Symbol nur PNG oder ICO); `skin.json` fehlt, ist kein JSON, hat `format` ungleich 1 oder besteht die Prüfung der Paketdaten nicht; ein Verweis auf ein Bild, das im Archiv fehlt.
- Entpackt wird zuerst in `<Datenordner>\skins\.import-<uuid>\`; erst nach bestandener Prüfung wird der Ordner zum Paketordner umbenannt und die Zeile geschrieben, bei einem Fehler wird er gelöscht. Ein nach einem Absturz liegengebliebener `.import-…`-Ordner verschwindet beim nächsten Start.
