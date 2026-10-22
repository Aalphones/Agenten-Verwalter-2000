# Phase 2 — Oberfläche: Markierung im Antworttext

Lesen: [README.md](README.md) (Entscheidung „Marke als Zeichenkette“), Entwurf [artifacts/entwurf-ohne-fundstelle.html](artifacts/entwurf-ohne-fundstelle.html) Abschnitt 1, `src/components/Markdown.tsx` (`REMARK_PLUGINS`, `REHYPE_PLUGINS`, `COMPONENTS`, `InlineCode`), `src/features/chat/TextBlock.tsx`, `src/features/chat/ChatTimeline.tsx` (`case 'text'`), `src/stores/settings.ts`, [docs/conventions/react.md](../../conventions/react.md), [typescript.md](../../conventions/typescript.md), [tailwind.md](../../conventions/tailwind.md).

## AK der Phase

1. Jedes Vorkommen einer Zeichenkette aus `entry.unsourced` im gerenderten Text — in Absätzen, Listen, Tabellen, Hervorhebungen und Inline-Code, nicht in Code-Blöcken mit Zaun — ist in `<span class="unsourced" tabindex="0" data-tip="…">` gefasst.
2. Stil: `text-decoration: underline dotted var(--color-waiting) 1.5px; text-underline-offset: 3px; cursor: help`. Hover oder Fokus zeigt die Erklärung als Kästchen unter der Stelle (max. 330 px breit, `bg-popover`, Rahmen, Schatten wie im Entwurf): fett „Ohne Fundstelle“, darunter „„<Angabe>“ kommt in keiner Werkzeug-Ausgabe dieser Antwort vor. Das heißt nicht, dass es falsch ist — nur, dass der Agent es hier nicht nachgesehen hat.“
3. Ist `markUnsourced` in den Einstellungen `false` oder `unsourced` leer, rendert `Markdown` genau wie heute (gleicher Plugin-Satz, keine zusätzliche Arbeit).
4. Dateiverweise (`FileLink`) bleiben klickbar; die Marke liegt innen um den Linktext.

## Checkliste

- [x] Neuer Ordner `src/features/sourcing/` mit `rehypeUnsourced.ts`: `export function rehypeUnsourced(options: { needles: readonly string[] }): (tree: Root) => void` (Typen aus `hast`, wie sie `rehype-highlight` schon mitbringt — kein neues Paket). Läuft **vor** `rehypeHighlight`; geht alle Text-Knoten durch, überspringt jeden Knoten mit einem Vorfahren `pre`; teilt Text an jedem Vorkommen (längste Nadel zuerst, damit `src/a.ts:12` vor `12` greift) und setzt `element('span', { className: ['unsourced'], tabIndex: 0, dataTip: <Satz> }, [text])`.
- [x] `src/features/sourcing/sourcingTexts.ts`: `UNSOURCED_TITLE = 'Ohne Fundstelle'`, `unsourcedTip(needle: string): string` (Satz aus AK 2).
- [x] `src/features/sourcing/Unsourced.css`: `.unsourced` samt `::after { content: attr(data-tip) }`-Kästchen — Überschrift über `::before` mit `content: 'Ohne Fundstelle'`, absolut unter der Stelle, sichtbar bei `:hover`/`:focus-visible`, `white-space: normal`, `z-index` über dem Verlauf. Einmal in `src/main.tsx` bzw. dort importieren, wo die übrigen globalen Feature-Stile hängen.
- [x] `Markdown.tsx`: Prop `unsourced?: readonly string[]`. Die Plugin-Liste wird mit `useMemo` aus `unsourced` gebaut: leer → die heutigen Konstanten; sonst `[[rehypeUnsourced, { needles }], ...REHYPE_PLUGINS]`.
- [x] `TextBlock.tsx`: Prop `unsourced: readonly string[]`, liest `useSettingsStore((s) => s.settings?.markUnsourced ?? true)` und gibt bei `false` ein leeres Feld weiter. `ChatTimeline.tsx`: `unsourced={entry.unsourced}`.
- [x] Doc: `docs/code-map.md` neue Zeile „Ohne Fundstelle“ (Oberfläche `src/features/sourcing/`, Core `src-tauri/src/sourcing/`, Felder `ChatEntry::Text.unsourced`, `Notice::TurnSummary.unsourced`, ADR 036).
- [x] `pnpm check` grün, Commit `feat(chat): Angaben ohne Fundstelle markieren`.

## Report-Back
