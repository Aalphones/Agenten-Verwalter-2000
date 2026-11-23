# Entwurf: Vault-Suchdialog

**Status:** zur Abnahme vorgelegt (Phase 6, Station „Entwurf“). Grundlage der Station „Umsetzung“.

## Ansehen

- [vault-suchdialog.html](vault-suchdialog.html) direkt im Browser öffnen; Einzeldatei, ohne Abhängigkeiten.
- Entwurfsleiste oben (gehört nicht zur App): Zustand, Breite (390, 860, 1366, Voll), Thema, Agenten-Werkzeug, ⓘ Aufgabe.
- Dialog öffnen: Knopf „Vault“ in der Sidebar, `Strg+K` oder „Dialog öffnen“.
- Farben sind die Hex-Werte der Tokens aus `src/styles/theme.css` (Stand 2026-11-23). Datum, Treffer und Zahlen sind erfunden.

## Was der Entwurf zeigt

| Bereich | Zeigt |
|---|---|
| Sidebar | Knopf „Vault“ links neben „Archiv“ im Fuß; Einstellungen bleibt darunter |
| Dialog | Titel + Statuszeile, Suchfeld mit ⓘ, Trefferliste, Fußzeile mit Zähler und Tastenhilfe |
| Suche | entprellt 250 ms, leeres Feld sofort, Gruppe „Zuletzt geändert“ |
| Trefferzeile | Titel + Art, Pfad (Monospace, von links gekürzt), Beschreibung, Ausschnitt mit Markierung |
| Bedienung | ↑/↓, Enter öffnet, Strg+Enter zeigt im Ordner, Esc schließt; gewählte Zeile trägt „Öffnen“ und „Im Ordner zeigen“ |
| Rückmeldung | Fußzeile nennt „Geöffnet: …“ bzw. „Im Ordner gezeigt: …“; der Dialog bleibt offen |
| Zustände | bereit, viele Treffer (50 von 212), wird eingelesen, Vault leer, Erste Suche lädt, Suche fehlgeschlagen, Ordner fehlt, nichts gefunden, Öffnen fehlgeschlagen (Eintrag „Alte Notiz“) |
| Breite | unter 576 px Blatt von unten, Ziele 44 px, Tippen wählt statt zu öffnen |
| Agenten | Schalter blendet den gleichen Aufruf als `vault_search` ein |

## Abweichungen von den AK

- Gruppenzeile „Zuletzt geändert“ bei leerem Feld.
- Strg+Enter = „Im Ordner zeigen“; Tastenhilfe in der Fußzeile (nur ab 576 px).
- Unter 576 px wählt Tippen nur, „Öffnen“ öffnet (sonst wäre „Im Ordner zeigen“ nicht erreichbar).
- Der Dialog bleibt nach dem Öffnen offen; die Fußzeile bestätigt.
- Fußzeile nennt zusätzlich „Index wird noch aufgebaut“, wenn `isScanning`.
- Breite 40 rem statt 36 rem (Archiv), wegen Pfad und Ausschnitt.

## Grenzen

- Das Suchfeld nutzt wie das Archiv den Rahmen `--color-border` (1,6 : 1 gegen den Grund); Bestandsstil, nicht geändert.
- Markierungen stehen nur im Ausschnitt; Fundstellen in Titel oder Beschreibung bleiben unmarkiert.
