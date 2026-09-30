# Design-Entwurf: Vorhaben und TL;DR

**Status:** abgenommen am 2026-09-30 als Grundlage des Plans [Vorhaben und Sessions](../../planning/2026-09-30_vorhaben-und-sessions/README.md). Für Sidebar, Session-Kopfzeile, Übersicht eines Vorhabens, Einstieg einer neuen Session und die TL;DR-Karten ist dieser Entwurf verbindlich; alles andere regelt weiter der Entwurf [Hauptansichten](../2026-09-28_hauptansichten/README.md), dessen Tokens, Schriften und Statussymbole er übernimmt. Wo die Umsetzung abweichen muss, wird erst dieser Entwurf geändert, dann der Code.

## Ansehen

- **Veröffentlichte Fassung (klickbar):** https://claude.ai/artifact/QVJDx2sjvb4jgWKAxeW8Ld — privat, nur für den Eigentümer sichtbar.
- **Quellen:** [canvas/](canvas/). `Main.dc.html` ist der vollständige klickbare Prototyp (Sidebar, Session, Übersicht, neue Session, alle TL;DR-Zustände); alle anderen `*.dc.html` sind dünne Rahmen, die `Main` mit festen Startwerten zeigen (`start` = `session` · `vorhaben` · `neu`, `tldr` = `offen` · `eingeklappt` · `veraltet` · `laeuft` · `keins`, `theme` = `dark` · `light`). `canvas.json` ordnet die Tafeln an.
- Die Quellen laufen nur in der Design-Zeichenfläche von claude.ai (Laufzeit `support.js`); im Browser direkt geöffnet zeigen sie nichts. Es gibt keine erzeugten Abzüge.
- Änderungen: auf der Zeichenfläche bearbeiten, geänderte Dateien nach `canvas/` zurückkopieren, diese README im selben Commit nachziehen.

## Tafeln

| Datei | Zeigt | Phase im Plan |
|---|---|---|
| `Main.dc.html` | Klickbarer Prototyp, Start: Session `#3` mit aktuellem TL;DR | 3, 6 |
| `NoTldr.dc.html` | Session ohne TL;DR: gestrichelte Leiste mit „TL;DR erstellen“ | 6 |
| `Stale.dc.html` | TL;DR veraltet: „23 neue Einträge seitdem“, Knopf „Aktualisieren“ | 6 |
| `Collapsed.dc.html` | TL;DR eingeklappt: eine Zeile mit der Kurzfassung | 6 |
| `Loading.dc.html` | TL;DR wird erstellt: Platzhalterbalken, Chat bleibt benutzbar | 6 |
| `Vorhaben.dc.html` | Übersicht eines Vorhabens: TL;DR, Repositories, Sessions, „Neue Session“ | 4, 6 |
| `VorhabenNoTldr.dc.html` | Übersicht, eine Session ohne TL;DR: Knopf an der Karte, „aus 2 von 3“ | 6 |
| `NewSession.dc.html` | Neue Session `#4` im Status „Neu“: Einstiegsansicht, Haken „TL;DR mitschicken“ | 4, 6 |

## Gestaltung

- Wie Hauptansichten: ruhig, dunkel als Referenz, Farbe trägt nur der Status, Akzentfarbe nur für Hauptknöpfe („Neue Session“, Senden, Kontrollkästchen).
- **TL;DR-Karte** sitzt über dem Chat in dessen Spalte; „noch keins“ ist eine gestrichelte, flache Leiste — sie zeigt, dass etwas fehlt, ohne wie ein Fehler auszusehen. Eine Antwort, die eine Entscheidung von dir braucht, steht in der Wartet-Farbe.
- **Status „Neu“:** gestrichelter Ring in gedämpfter Farbe.
- Alle Maße der umgesetzten Teile stehen als prüfbare Abnahmekriterien in den Phasen-Dateien des Plans (Phase 3, 4, 6).

## Platzhalter im Entwurf

- Alle Inhalte sind Beispieldaten (Vorhaben „OAuth Login umsetzen“, Sessions, Zusammenfassungen, Uhrzeiten, Zahlen).
- Die Chat-Verläufe sind verkürzt; die App zeigt den echten Verlauf.
- „Aktualisieren“ und „TL;DR erstellen“ simulieren nur eine Wartezeit von rund zwei Sekunden.
- Die Knöpfe Pause, Abbrechen, Modell, Modus, `+`, `/` und die Reiter haben im Prototyp keine Funktion.

## Abweichungen vom Entwurf

Trägt Phase 6 des Plans nach dem Bau ein.
