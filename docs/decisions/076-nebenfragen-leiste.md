# 076 — Seitenleiste nur noch Nebenfragen

**Status:** angenommen · **Datum:** 2026-11-28

## Kontext

Die Seitenleiste „Hintergrund“ hatte die Reiter Prozesse, Subagenten, Scratchpad ([ADR 007](007-anhaenge-skills-hintergrund.md)) und Nebenfragen ([ADR 044](044-nebenfragen.md)). Genutzt wurden die ersten drei nicht. Den Scratchpad zeigt der Knoten „Session-Dateien“ im Reiter „Dateien“ ([ADR 071](071-session-dateien.md)); Ausgabe und Beenden von Prozessen und Subagenten waren nur in der Leiste erreichbar.

## Optionen

- **Leiste behalten:** drei Reiter ohne Nutzen, mit eigenem Code und eigenen Kern-Befehlen.
- **Prozesse behalten:** Beenden und Ausgabe blieben vom Ort getrennt, an dem der Aufruf im Verlauf steht.
- **Nur Nebenfragen, Rest in die Chat-Zeile:** gewählt.

## Entscheidung

- Die Seitenleiste zeigt ohne Reiterleiste nur die Nebenfragen. Der Knopf der Kopfzeile trägt ein Fragezeichen, „Nebenfragen“ und deren Zahl; Lauf-Punkt und Prozess-Zähler entfallen.
- Die Verlaufszeile eines Prozesses oder Subagenten klappt im Chat auf: Zustand, Ausgabe bzw. Schritte und Ergebnis, Beenden, Im Browser öffnen, Ausgabe kopieren.
- „Im Chat besprechen“ entfällt für Prozesse und Subagenten, die Zeile steht schon im Chat.
- Die Befehle `scratchpad_list` und `scratchpad_read` entfallen; `background_load`, `background_output`, `background_stop` und `background://changed` bleiben.
- Im Code bleiben die Namen `background` (Ordner, Store, Panelbreite) für Leiste und Erfassung.

## Konsequenzen

- Keine Liste aller laufenden Prozesse einer Session mehr; ein Eintrag wird über seine Zeile im Verlauf gefunden.
- Ausgeführte Vordergrund-Befehle haben keine eigene Liste mehr; Ausgabe und Dauer stehen an der Verlaufszeile.
- Scheitert das Laden der Hintergrund-Einträge oder ihr Abo, steht das nur im Konsolen-Log; der Verlauf behält den letzten Stand.
