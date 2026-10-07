# Plan: Vorhaben-Retro

Ein Knopf „Retro“ unter dem TL;DR eines Vorhabens lässt den Verwalter je Session eine Mini-Retro erstellen: ein Einmal-Aufruf von Sonnet im Druckmodus (wie das TL;DR mit Haiku) sammelt Rohbefunde aus dem Verlauf. Die Befunde aller Sessions landen als `befunde.md` im Workspace, daneben die Verläufe als Textdateien. Danach legt der Verwalter eine neue Session an und setzt `/session-review vorhaben <Ordner>` in ihren Entwurf; gesendet wird erst auf Klick. Das Urteil — Einordnen, Maßnahmen, Edits — fällt dort im Skill des Nutzers, der nicht in diesem Repository liegt. Der Verwalter sammelt nur und kennt keine Regeln des Nutzers.

## Übersicht

| Phase | Inhalt | Komplexität | Status |
|---|---|---|---|
| 1 | Core: Retro-Transkript und Verlaufsdateien, Einmal-Aufruf mit wählbarem Modell (Refactor) | standard | pending |
| 2 | Core: Mini-Retro-Läufe (parallel, Fortschritt), `befunde.md`, Command `retro_run`, ADR 028 | heikel | pending |
| 3 | Oberfläche: Knopf „Retro“ mit Fortschritt, Session anlegen, Doku | standard | pending |

## Kontrakt (Core ↔ Oberfläche ↔ Skill)

- **Command:** `retro_run(project_id: String) -> Result<RetroExport, CommandError>` in `src-tauri/src/commands/retro.rs`, `async`. Kehrt erst zurück, wenn alle Mini-Retros fertig und die Dateien geschrieben sind. Ein zweiter Aufruf für dasselbe Vorhaben während eines Laufs → `CommandError::Internal("Für dieses Vorhaben läuft schon eine Retro.")`.
- **Ereignis:** `retro://progress` mit `RetroProgress { project_id, done: u32, total: u32 }` nach dem Start (`done = 0`) und nach jeder fertigen Session.
- **Typen** (`src-tauri/src/retro/model.rs`, `derive(TS)`, camelCase, in `src-tauri/examples/gen-bindings.rs`):
  ```rust
  pub struct RetroExport {
      /// Relativ zum Workspace, mit `/` getrennt, z. B. `.retro/lauf-1759830000000`.
      pub folder: String,
      pub session_count: u32,
      /// Sessions, deren Mini-Retro fehlschlug (stehen mit Fehlertext in `befunde.md`).
      pub failed_count: u32,
  }
  pub struct RetroProgress { pub project_id: String, pub done: u32, pub total: u32 }
  ```
- **Ordner:** `<Workspace>\.retro\lauf-<now_ms()>\` — jeder Lauf ein neuer Ordner, nie überschreiben, nie aufräumen. Inhalt: `session-<N>.md` je Session (Verlauf, Format in Phase 1) und `befunde.md` (Format in Phase 2).
- **Welche Sessions:** alle des Vorhabens nach Nummer, außer Status `New` und außer Sessions, deren erste Nutzernachricht den Skill `session-review` aufruft. Bleibt keine → `CommandError::Internal("Noch keine Session mit Verlauf.")`, kein Ordner.
- **Fehlschläge:** scheitert die Mini-Retro einer Session, steht sie mit Fehlertext in `befunde.md`, die übrigen laufen weiter. Scheitern alle → `CommandError::Internal("Keine Mini-Retro gelungen: <erster Fehlertext>")`; die Dateien bleiben liegen.
- **Entwurf der neuen Session:** genau `/session-review vorhaben <folder>`. Der Skill liest `<folder>/befunde.md` und schlägt Zitate bei Bedarf in `<folder>/session-<N>.md` nach.

## Finale Abnahmekriterien

1. Zentriert unter der TL;DR-Karte des Vorhabens (über den Repositories) steht ein Knopf „Retro“ mit Tooltip; ohne Sessions fehlt er.
2. Gesperrt, solange eine Session startet, läuft oder auf eine Antwort wartet, oder keine Session einen Verlauf hat; der Tooltip nennt den Grund.
3. Während des Laufs zeigt der Knopf „Sammle Befunde <done>/<total> …“ und ist gesperrt — auch nach Wechsel in eine Session und zurück.
4. Nach dem Lauf liegen im neuen Ordner `session-<N>.md` je einbezogener Session und `befunde.md`; eine neue Session ist angelegt, ausgewählt und hat `/session-review vorhaben .retro/lauf-<Zahl>` im Entwurf. Nichts wird gesendet.
5. Die Mini-Retros laufen mit Sonnet (in den Betriebsarten mit lokalem Modell mit dem lokalen Modell), höchstens drei gleichzeitig.
6. Eine zweite Retro nimmt die Session der ersten nicht auf.
7. `pnpm check` grün.

## Smoke-Checkliste (Abnahme durch den Nutzer)

Wackelstellen zuerst:

1. **Dauer und Zeitlimit:** Vorhaben mit der längsten vorhandenen Session → der Lauf endet ohne Zeitlimit-Fehler; Dauer notieren. Bei Zeitlimit-Fehler den Wert in `RETRO_TIMEOUT` (Phase 2) anpassen.
2. **Qualität der Befunde:** `befunde.md` gegen eine Session prüfen, deren Verlauf du kennst — stehen deine Korrekturen dort mit wörtlichem Zitat, und ist nichts erfunden?
3. **Skill-Aufruf:** Entwurf senden → Marke `session-review` an der Nachricht, der Agent liest `befunde.md` aus dem genannten Ordner.

Danach:

4. Zweite Retro → keine Datei für die Retro-Session aus Smoke 3.
5. Während eine Session läuft: Knopf gesperrt mit Grund; nach dem Ende frei.
6. Während der Retro in eine Session wechseln und zurück → Knopf zeigt weiter den Fortschritt.
7. Betriebsart „Claude Code + LM Studio“: Retro läuft mit dem lokalen Modell durch (oder scheitert mit lesbarem Fehler).

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
