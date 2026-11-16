# 065 — Skins: Figurenpakete und Stilpakete als Daten des Benutzers

**Status:** vorgeschlagen · **Datum:** 2026-11-16

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
- Das App-Symbol wechselt nur im laufenden Fenster und in der Taskleiste, nicht an der exe oder der Verknüpfung.
