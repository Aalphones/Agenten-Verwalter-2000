# Phase 3 — Einstiege `/mcp` und Hinweis in der Eingabeleiste, Doku

Rating: **mechanisch** · Commit: `feat(mcp): Einstiege /mcp und Problem-Hinweis`

## Kontext (vor dem Start lesen)

- [README.md](README.md) des Plans (Kontrakt: `SessionSummary.mcpProblems`) und [phase-2-dialog.md](phase-2-dialog.md) (`McpDialog`, `problemLabel`, `problemShort` in `mcpTexts.ts`).
- **Design (verbindlich):** [docs/design/2026-10-01_mcp-dialog/README.md](../../../design/2026-10-01_mcp-dialog/README.md), `canvas/Slash.dc.html` (Zeile `/mcp`) und die Eingabeleiste unten in `canvas/Main.dc.html` (Hinweis).
- `src/features/chat/Composer.tsx` (`OpenMenu`, `runSessionCommand`, `pickRow`, Leiste `composer__bar`), `src/features/chat/commandMenuRows.ts` (`SessionCommand`, `SESSION_COMMAND_TEXT`, `sessionRows`), `src/features/chat/CommandMenu.tsx` + `.css` (`rowOrigin`, `command-menu__origin`).
- [docs/conventions/react.md](../../../conventions/react.md), [tailwind.md](../../../conventions/tailwind.md).
- Fehlerklassen geprüft (Vault: `sprachen/typescript`, `frameworks/react`): keine einschlägig.

## Abnahmekriterien der Phase

1. Im `/`-Menü (Knopf `/` und `/` am Feldanfang) steht im Abschnitt „Session“ die Zeile `/mcp` mit „MCP-Server anzeigen, ausschalten, neu verbinden“, in der Reihenfolge `/rename`, `/changes` (wenn vorhanden), `/mcp`, `/pause` (wenn vorhanden). Auswahl per Klick oder Enter öffnet den Dialog; beim getippten `/mcp` ist der Entwurf danach leer (wie bei den anderen Session-Befehlen). In „Neue Session“ erscheint die Zeile nicht.
2. Mit `mcpProblems > 0` zeigt die Zeile rechts „1 Problem“ / „N Probleme“ in `--color-status-error` mit einem 6-px-Punkt davor.
3. Mit `mcpProblems > 0` steht in der Eingabeleiste zwischen Modus-Menü und Senden-Knopf ein Knopf „MCP · 1 Problem“ / „MCP · N Probleme“: 26 px hoch, `padding: 0 10px`, 1 px `--color-border`, Radius voll rund, transparent, `--font-size-xs`, `--color-fg-secondary`, davor ein 7-px-Punkt in `--color-status-error`; Hover `--color-bg-hover`; Tooltip „MCP-Server anzeigen“. Klick öffnet den Dialog. Mit 0 ist der Knopf nicht da.
4. Der Dialog schließt über alle Wege aus Phase 2 und hinterlässt die Eingabeleiste bedienbar; das `/`-Menü öffnet sich danach wie vorher.
5. `pnpm check` grün.

## Checkliste

- [x] `commandMenuRows.ts`: `SessionCommand` um `'mcp'` erweitern; `SESSION_COMMAND_TEXT.mcp = { label: '/mcp', description: 'MCP-Server anzeigen, ausschalten, neu verbinden' }`; in `sessionRows` nach dem `changes`-Block und vor dem `pause`-Block `rows.push({ kind: 'session', command: 'mcp' });`.
- [x] `CommandMenu.tsx`: `rowOrigin(row, session)` bekommt die Session; für `row.kind === 'session' && row.command === 'mcp' && session !== null && session.mcpProblems > 0` → `problemShort(session.mcpProblems)`. Am `<span className="command-menu__origin">` den Modifikator `command-menu__origin--problem` setzen, wenn genau dieser Fall vorliegt. `CommandMenu.css` im Block `&__origin`: `&--problem { display: flex; align-items: center; gap: 5px; color: var(--color-status-error); &::before { content: ''; width: 6px; height: 6px; border-radius: var(--radius-full); background: currentColor; } }`.
- [x] `src/features/mcp/McpProblemChip.tsx` + `.css` (Block `mcp-chip`): Props `McpProblemChipProps { count: number; onOpen: () => void }`; `<button type="button" className="mcp-chip" title="MCP-Server anzeigen" onClick={onOpen}><span className="mcp-chip__dot" />{problemLabel(count)}</button>`; CSS nach AK 3 (`display: flex; align-items: center; gap: var(--space-sm); flex-shrink: 0;` dazu), `&:focus-visible` Rahmen 2 px `--color-accent`, `outline-offset: 2px`.
- [x] `Composer.tsx`:
  - `type OpenMenu = 'model' | 'mode' | 'plus' | 'command' | 'mcp' | null;`
  - `runSessionCommand`: drei explizite Zweige — `rename` wie bisher, `changes` wie bisher, `mcp` → `setOpenMenu('mcp')`, sonst (`pause`) wie bisher. Kein `else` mehr, das stillschweigend pausiert.
  - In `composer__bar` zwischen dem `<div className="composer__anchor composer__anchor--end">` (Modus) und dem Senden-Knopf: `{session.mcpProblems > 0 && <McpProblemChip count={session.mcpProblems} onOpen={(): void => { setOpenMenu('mcp'); }} />}`. Hat ein anderer Plan dort inzwischen einen Knopf eingefügt (Sprachdiktat: Mikrofon), kommt der Hinweis direkt vor den Senden-Knopf.
  - Am Ende des äußeren `<div className="composer">`: `{openMenu === 'mcp' && <McpDialog session={session} onClose={closeMenu} />}`.
- [x] `docs/code-map.md`: Zeile „MCP-Server“ um die Einstiege ergänzen — `McpProblemChip` (Hinweis in der Eingabeleiste), geöffnet aus `src/features/chat/Composer.tsx` (`openMenu` `'mcp'`), Zeile `/mcp` in `commandMenuRows.ts`; Zeile „Chat“: bei `CommandMenu` „inkl. `/mcp`“.
- [x] `docs/glossary.md`, neuer Eintrag hinter „Kontingent“: **MCP-Server** — Ein Programm oder Dienst, der dem Agenten über das Model Context Protocol zusätzliche Werkzeuge gibt (z. B. comfy, Google Drive). Die Claude-Kommandozeile lädt die Server selbst aus Benutzer-, Projekt- und claude.ai-Konfiguration; der Verwalter zeigt sie im Dialog „MCP-Server“ (`/mcp`), verbindet sie neu und schaltet sie aus. Ausgeschaltet bleibt ein Server für alle Sessions des Vorhabens. Ein Server mit Status „Fehlgeschlagen“ oder „Anmeldung nötig“ zählt als Problem und erscheint als Hinweis in der Eingabeleiste ([ADR 013](decisions/013-mcp-server-im-dialog.md)).
- [x] `docs/design/2026-10-01_mcp-dialog/README.md`: Status-Zeile auf „umgesetzt am <Datum>“ (Muster: `2026-09-30_vorhaben-und-tldr/README.md`); weicht die Umsetzung an einer Stelle ab, den Punkt unter „Abweichungen vom Entwurf“ ergänzen.

## Report-Back
