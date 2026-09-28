# Phase 6 — Eingabeleiste & Steuerung

**Status:** complete · **Rating:** standard (Menüs aus Phase 3 und Commands aus Phase 2 werden hier zusammengesteckt)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans — Pause/Esc, Denkaufwand-Wechsel, Kontrakt (`sendMessage`, `setSessionModel`, `setSessionMode`, `setSessionEffort`)
- [Design-README](../../design/2026-09-28_hauptansichten/README.md) → Layout-Maße „Eingabeleiste“, „Menüs der Eingabeleiste“, Verhalten „Modell“
- Entwurfsquelle `docs/design/2026-09-28_hauptansichten/canvas/Main.dc.html`: Eingabeleiste Zeilen 295–407 (ohne Menü `/` 298–338, ohne Menü `+` 340–347, ohne Anhang-Zeile 383–395), Platzhalter und Modell-Hinweis Zeilen 1434 und 1462
- Bestand: `src/components/ModelMenu.tsx`, `ModeMenu.tsx`, `Popover.tsx`, `src/lib/labels.ts` (Phase 3), `src/features/chat/ChatView.tsx` (Platz `chat-view__composer`, Phase 4)
- [docs/conventions/react.md](../../conventions/react.md), [tailwind.md](../../conventions/tailwind.md)
- Vault-Fehlerklassen `frameworks/react.md`, `sprachen/typescript.md`: geprüft, keine einschlägig.

## Abnahmekriterien der Phase

1. Eingabeleiste so breit wie die Chat-Spalte (höchstens 780 px, 32 px seitlich, 6 px oben, 18 px unten), Radius 10 px, Rahmen 1 px `--color-border`, **nur bei Fokus** `--color-accent` plus 3 px Ring `--color-accent-subtle`; Textfeld 2 Zeilen, mindestens 52 px, 13,5 px.
2. Untere Zeile: links Modell-Pille (26 px hoch, Radius 13 px, „Sonnet 5“ + Denkaufwand gedämpft), rechts Modus-Knopf (Symbol + Label) und Senden (30 × 30 px, Akzent, Pfeil). Kein `+`, kein `/`.
3. Ctrl+Enter oder Klick auf Senden schickt die Nachricht; leeres Feld → Senden gesperrt. Die Nachricht erscheint sofort im Verlauf, das Feld leert sich.
4. Wartet der Agent auf eine Rückfrage, lautet der Platzhalter „Antwort an Claude …“ und der gesendete Text beantwortet die Rückfrage (der Core entscheidet, Phase 2).
5. Esc unterbricht in `starting`/`running`/`waiting` (wie „Pause“), sofern kein Menü offen ist — ein offenes Menü schließt Esc zuerst. Umschalt+Tab im Textfeld wechselt den Modus reihum (Manuell → Automatisch bearbeiten → Planen → Auto → Manuell).
6. Modell-, Modus- und Denkaufwand-Wechsel wirken über die Commands; Kopfzeile, Pille und Modus-Knopf zeigen den neuen Wert nach dem Event `session://changed`. Fußnote im Modell-Menü: im Status `running`/`waiting`/`starting` „Gilt ab der nächsten Nachricht an den Agenten. Der bisherige Verlauf bleibt erhalten.“, sonst „Gilt ab der nächsten Nachricht in dieser Session.“
7. Status `cancelled` → Feld gesperrt, Platzhalter „Session abgebrochen – leg eine neue Session an.“; Status `error` → gesperrt, „Agent beendet – starte ihn im Chat neu.“
8. Ein fehlgeschlagener Aufruf zeigt eine Zeile unter der Leiste (`role="alert"`, `--color-status-error`), der Text im Feld bleibt erhalten.
9. Der Entwurf eines Textes bleibt beim Wechsel zwischen Sessions pro Session erhalten.
10. Alle Smoke-Punkte aus dem Plan-README einmal selbst durchgespielt; Ergebnis je Punkt im Report-Back.
11. `pnpm check` grün.

## Checkliste

- [x] `src/stores/chat.ts`: `useChatStore` mit `drafts: Record<string, string>` und `setDraft(sessionId, text)`, `clearDraft(sessionId)` — flüchtiger UI-Zustand, erlaubt laut react.md.
- [x] `src/features/chat/Composer.tsx` + `.css`: Props `session: SessionSummary`. Unsichtbares `label` „Nachricht an den Agenten“ für das Textfeld. Platzhalter nach Status: `waiting` → „Antwort an Claude …“, `cancelled`/`error` → AK 7, sonst „Nachricht an Claude …“. Zustand lokal: offenes Menü (`'model' | 'mode' | null`), Fehlertext, „sendet gerade“.
  - Senden: `sendMessage(session.id, text.trim())` → `clearDraft`; Fehler → AK 8.
  - Tasten im Textfeld: Ctrl+Enter → senden (`preventDefault`); Umschalt+Tab → nächster Modus nach `MODE_OPTIONS`-Reihenfolge, `setSessionMode` (`preventDefault`).
  - Modell-Pille → `ModelMenu` mit `placement="above"`, `align="start"`, `note` nach AK 6; Auswahl → `setSessionModel`, Menü schließt.
  - Modus-Knopf → `ModeMenu` mit `placement="above"`, `align="end"`; Modus → `setSessionMode`, Denkaufwand → `setSessionEffort`; Menü bleibt nach Denkaufwand-Klick offen, schließt nach Modus-Klick.
  - Fokus-Rahmen per `:focus-within` am Kasten.
- [x] `ChatView.tsx`: `Composer` in `chat-view__composer` einsetzen. Esc-Listener auf `window` (nur solange Status `starting`/`running`/`waiting`): ignoriert `defaultPrevented` (die Menüs setzen es beim Schließen), sonst `pauseSession(session.id)`; Cleanup.
### Doku und Abschluss

- [x] Design-README: Tafeln `Model.dc.html`, `Mode.dc.html` bestätigen („M2a“); „Abweichungen bis Meilenstein 3“ um die fehlenden Knöpfe `+` und `/` und den Platzhalter ohne „(/ für Skills, @ für Dateien)“ ergänzen.
- [x] `docs/knowledge/GAPS.md`: offene Fragen aus FINDINGS übernehmen; was die Umsetzung beantwortet hat, nach [claude-stream-json.md](../../knowledge/claude-stream-json.md) verschieben.
- [x] `docs/code-map.md`: Composer und `src/stores/chat.ts` ergänzen; Stand-Satz oben auf „Meilenstein 2a“ setzen.
- [x] `AGENTS.md`: prüfen, ob Befehle oder Regeln sich geändert haben (erwartet: nein); falls doch, nachziehen.

## Report-Back

- **Gebaut:** `Composer` (Textfeld, Modell-Pille, Modus-Knopf, Senden), Entwurf je Session in `useChatStore`, Esc-Pause in `ChatView`. Menüs aus Phase 3 unverändert wiederverwendet.
- **Prüfkette:** `pnpm check` grün (Lint, Typecheck, Prettier, Build, rustfmt, Clippy). Erster Lauf fand einen Lint-Fehler (`delete` auf berechneten Schlüssel in `clearDraft`), behoben mit `Object.entries`/`Object.fromEntries`.
- **AK 10 (Smoke) offen:** Die App lief in dieser Phase nicht; die Smoke-Punkte macht Sascha am Plan-Ende.
- **Abweichung:** Der Platzhalter „Antwort an Claude …“ hängt am Status `waiting`, nicht an einer aus `entries` abgeleiteten offenen Rückfrage — der Status deckt dasselbe ab und `Composer` braucht so keine Einträge.
- **Nicht gebaut, bewusst:** Modell- und Modus-Knopf bleiben auch in `cancelled`/`error` bedienbar (nur Textfeld und Senden sind gesperrt, wie im Plan).
