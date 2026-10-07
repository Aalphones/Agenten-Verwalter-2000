# 028 — Vorhaben-Retro: der Verwalter sammelt, der Skill urteilt

**Status:** angenommen · **Datum:** 2026-10-07

## Kontext

Eine Retrospektive je Session ist zu teuer und verstreut ihre Ergebnisse über viele Verläufe. Eine Retro über alle Sessions eines Vorhabens in einem einzigen Kontext sprengt ihn: die Verläufe zusammen sind zu lang.

## Optionen

- **(a) Sessions wieder aufnehmen** und in jeder eine Retro laufen lassen: schreibt in fremde Verläufe und verändert deren TL;DR und Einstiegszeile.
- **(b) Subagenten im Skill** lesen die Verläufe: die Modellwahl der Betriebsart „Autark“ wirkt dort nicht, und der Ablauf hängt davon ab, wie der Agent die Subagenten führt.
- **(c) Der Verwalter sammelt** je Session per Einmal-Aufruf mit Sonnet Rohbefunde, der Skill des Nutzers urteilt über die gesammelte Datei.

## Entscheidung

**(c).** Kontrakt: README des Plans `vorhaben-retro` (archiviert unter `docs/archive/`).

- **Command `retro_run`** schreibt je Lauf einen neuen Ordner `<Workspace>\.retro\lauf-<ms>\` mit `session-<N>.md` je Session (Verlauf, Werkzeug-Aufrufe nur als Zählung und Fehlschläge) und `befunde.md` (Rohbefunde aller Sessions). Fortschritt über `retro://progress`.
- **Mini-Retro je Session:** Einmal-Aufruf mit Sonnet (in den Betriebsarten mit LM Studio das lokale Modell), höchstens drei gleichzeitig, ohne gehaltene Session-Sperre. Sie sammelt nur Korrekturen, Fehlversuche, unbelegte Behauptungen, neue Fakten und Offenes, jeweils mit wörtlichem Zitat; sie bewertet nichts.
- **Der Verwalter enthält nur die Sammel-Anweisung,** keine Regeln des Nutzers. Einordnen, Maßnahmen und Edits fallen im Skill `session-review`, den eine neue Session mit `/session-review vorhaben <Ordner>` im Entwurf aufruft.
- **Ein Lauf je Vorhaben gleichzeitig;** der Laufzustand liegt nur im Speicher.

## Konsequenzen

- Der Ordner `.retro` wächst mit jedem Lauf; der Verwalter räumt ihn nicht auf.
- Retro-Sessions werden daran erkannt, dass ihre erste Nachricht den Skill `session-review` aufruft, und gehen in keine spätere Retro ein. Wird der Skill umbenannt, zählen sie wieder mit.
- Ein Lauf kostet je Session einen Sonnet-Aufruf; das Zeitlimit je Aufruf (`RETRO_TIMEOUT`) ist noch nicht gemessen.
