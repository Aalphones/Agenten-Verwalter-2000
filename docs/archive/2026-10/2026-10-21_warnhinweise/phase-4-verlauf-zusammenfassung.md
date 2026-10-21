# Phase 4 — Verlauf Teil 1: Hinweis-Einträge, Zusammenfassung, Modellwechsel

## Kontext

Lesen: [README.md](README.md) (Entscheidungen „Eine neue Eintragsart“, „Zusammenfassung“, „Modellwechsel“; Kontrakt `Notice`, `ChatEntry::Notice`; AK 3, 4, 7), Entwurf [artifacts/warnhinweise-entwurf.html](artifacts/warnhinweise-entwurf.html) (Fälle „Zusammenfassung“ und „Modellwechsel“; Markierungen 3 und 4).

Code-Stellen:

- `src-tauri/src/agents/event.rs` (`ChatEntry`, `ChatEntry::seq`), `src-tauri/src/notices/model.rs` (aus Phase 1, `Denial`).
- `src-tauri/src/sessions/registry.rs`: `apply_event` (Zweige `Compacted`, `CompactSummary` aus Phase 1/2), `push_entry`, `replace_entry`, `set_model`, `is_claude_process` (Phase 2).
- Jeder `match` über `ChatEntry`, den der Compiler meldet — bekannt: `src-tauri/src/archive/search.rs` (Zweig mit `ChatEntry::Artifact { .. } => None`), `src-tauri/src/tldr/transcript.rs` (Zweig mit `ChatEntry::Artifact { .. }`).
- `src-tauri/examples/gen-bindings.rs`.
- Oberfläche: `src/features/chat/ChatTimeline.tsx` (`renderEntry`, `expandedKeys`/`toggleExpanded`), `src/features/chat/ThinkingBlock.tsx` + `.css` (Muster Auf-/Zuklappen), `src/features/chat/BackgroundLine.css` (Muster einer Verlaufszeile), `src/components/Markdown.tsx`, `src/features/context/formatTokens.ts` (`formatThousands`), `src/lib/labels.ts` (`modelName`).
- Fehlerklassen: keine einschlägig.

## AK der Phase

1. `ChatEntry::Notice { seq, notice }` existiert, wird gespeichert und nach App-Neustart wieder angezeigt.
2. Nach `compact_boundary` steht im Verlauf eine Trennlinie: Linien links und rechts, in der Mitte eine Pille (Rahmen `--color-border`, Radius voll, Schrift 12 px `--color-fg-muted`) mit Symbol, **„Verlauf zusammengefasst“** und, soweit bekannt, „· von Hand“/„· automatisch“, „· vorher <x> Token, jetzt <y>“ und „· Cache wird neu aufgebaut“. Liegt die Zusammenfassung vor, folgt ein Knopf „Zusammenfassung ansehen“ / „Zusammenfassung ausblenden“; aufgeklappt steht der Text darunter über `Markdown`, in einem Kasten mit `--color-bg-sidebar`, Radius 8 px, max. 760 px breit.
3. Ohne Tokenzahlen (Agent „Autark“) steht nur „Verlauf zusammengefasst · Cache wird neu aufgebaut“ (der Cache-Teil nur in „Claude“).
4. Wechselt der User in „Claude“ das Modell einer Session, die einen Prompt-Cache hat, steht eine Zeile im Verlauf: Symbol (zwei Pfeile, `--color-cache-cold`), **„Modell gewechselt:“** „<A> → <B>. Die nächste Nachricht schreibt den Cache neu (rund <x> Token).“ Kein Eintrag, wenn sich das Modell nicht ändert, in „Codex“, „Autark“ und „Claude Code + LM Studio“.
5. Archiv-Suche, TL;DR und Retro übergehen Hinweis-Einträge.

## Checkliste

- [x] `notices/model.rs`: `Notice` mit den Varianten `Compacted { trigger: Option<String>, pre_tokens: Option<u32>, post_tokens: Option<u32>, summary: Option<String> }` und `ModelSwitched { from: ModelId, to: ModelId, recache_tokens: u32 }`; `#[derive(Debug, Clone, Serialize, Deserialize, TS)] #[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]`. Die übrigen Varianten kommen in Phase 6 (sonst meldet Clippy nie gebaute Varianten).
- [x] `agents/event.rs`: `ChatEntry::Notice { seq: u32, notice: Notice }` (Doc-Kommentar „Hinweis im Verlauf, ADR 033“), Zweig in `seq()`.
- [x] Jeder vom Compiler gemeldete `match`: `ChatEntry::Notice { .. }` wie `ChatEntry::Artifact { .. }` behandeln (nicht durchsuchbar, nicht im TL;DR-/Retro-Text).
- [x] `SessionState`: `compact_seq: Option<u32>` (nur Speicher).
- [x] `apply_event`, Zweig `Compacted { trigger, pre_tokens, post_tokens }`: zusätzlich zum Cache-Teil aus Phase 2 `self.compact_seq = Some(self.push_entry(outbox, |seq| ChatEntry::Notice { seq, notice: Notice::Compacted { trigger, pre_tokens, post_tokens, summary: None } }))`. Zweig `CompactSummary(text)`: `if let Some(seq) = self.compact_seq.take()` und der Eintrag an `seq` ist `Notice::Compacted` → Kopie mit `summary: Some(text)` über `replace_entry`.
- [x] `set_model`: das bisherige Modell vor der Zuweisung merken (`let previous = state.model;`); **nach** dem Codex-Rücksprung: `if previous != model && state.is_claude_process() && let Some(cache) = &state.prompt_cache` → `push_entry` mit `Notice::ModelSwitched { from: previous, to: model, recache_tokens: cache.tokens }`.
- [x] `gen-bindings.rs`: `Notice`, `Denial` exportieren; `pnpm bindings`.
- [x] Oberfläche `src/features/notices/`:
  - `NoticeBlock.tsx` — Props `notice: Notice`, `isExpanded: boolean`, `onToggle: () => void`, `isClaude: boolean`; `switch (notice.kind)` → `CompactDivider` bzw. `NoticeLine`.
  - `NoticeLine.tsx` + `.css` (BEM `notice-line`, Modifikatoren `--info`, `--warn`, `--model`): Symbol-Slot 14 px, Text mit fettem Anfang (`lead`) und Rest (`text`), optional `action?: { label: string; onClick: () => void }` rechts in `--color-accent-text`. Schrift 12.5 px `--color-fg-secondary`, Innenabstand 6 px 10 px, Radius 7 px; `--info` Hintergrund `--color-bg-sidebar`, `--warn` `color-mix(in srgb, var(--color-status-waiting) 10%, transparent)` mit Symbol in `--color-status-waiting`, `--model` ohne Hintergrund mit Symbol in `--color-cache-cold`.
  - `CompactDivider.tsx` + `.css` (BEM `compact-divider`) laut AK 2/3; Texte: `trigger === 'manual'` → „von Hand“, `'auto'` → „automatisch“, sonst weglassen; Token über `formatThousands`. „· Cache wird neu aufgebaut“ nur bei `isClaude`.
  - `noticeTexts.ts` — alle festen Sätze dieser Phase als Konstanten bzw. kleine Funktionen.
- [x] `ChatTimeline.tsx` `renderEntry`: `case 'notice':` → `<NoticeBlock notice={entry.notice} isExpanded={expandedKeys.has(key)} onToggle={() => toggleExpanded(key)} isClaude={…} />` (`isClaude` aus `useSettingsStore`, Betriebsart `'claude'`).
- [x] `docs/code-map.md`: Feature `notices` in die Liste; Tabellenzeile „Hinweise im Verlauf“ (Oberfläche `src/features/notices/`, Anschluss `ChatTimeline`; Core `src-tauri/src/notices/`, `ChatEntry::Notice`, Zweige in `apply_event`, `set_model`).
- [x] `docs/glossary.md`: „**Hinweis (Verlauf)** — Zeile im Chat-Verlauf, die festhält, was Claude oder der Verwalter getan hat, ohne Nachricht zu sein: Zusammenfassung, Modellwechsel, Modell-Ausweichen, Moduswechsel, Hinweis von Claude Code, Abschluss einer Antwort. Im Code `ChatEntry::Notice` ([ADR 033](decisions/033-warnhinweise.md)).“ und „**Zusammenfassung (Verlauf)** — Claude ersetzt den bisherigen Verlauf durch eine Kurzfassung, von Hand (`/compact`) oder automatisch kurz vor vollem Kontext; danach kennt der Agent Einzelheiten nur noch aus der Kurzfassung. Nicht zu verwechseln mit dem TL;DR.“
- [x] ADR 033: Abschnitt Hinweis-Einträge.
- [x] `pnpm check` grün; Commit `feat(notices): Zusammenfassung und Modellwechsel im Verlauf`.

## Report-Back

Status: complete. `eslint .` (ohne den ungetrackten Nachbarplan), `typecheck`, `format:check`, `build`, `rust:fmt`, `rust:clippy` grün; Bindings neu erzeugt (`Notice`, `Denial`, `ChatEntry`). Oberfläche nur per Prüfkette geprüft, nicht im Browser gesehen (Smoke 2 und 6 des Plans).

Abweichungen:

- **`NoticeIcons.tsx`** (zwei kleine Symbol-Komponenten) und `NoticeLine`-Variante `--info`/`--warn` sind angelegt, obwohl nur `--model` genutzt wird: die Varianten braucht Phase 6, das CSS steht laut Plan jetzt.
- **Schalter „Zusammenfassung ansehen“ sitzt in der Pille** (wie im Entwurf), nicht darunter.
- **`note_compaction` legt den Eintrag in jeder Betriebsart an**, den Cache-Teil nur, wenn ein `prompt_cache` existiert; „Autark“ liefert bis zum Nachbarplan `mitgelieferte-befehle` keine Tokenstände (geprüft: `standalone/output.rs` schickt `compact_boundary` ohne `compact_metadata`) — die Trennlinie zeigt dann nur „Verlauf zusammengefasst“.
- **`pnpm check` als Ganzes weiter rot**, nicht wegen dieser Phase: `eslint .` stolpert über `docs/planning/2026-10-21_mitgelieferte-befehle/artifacts/codex-probe.cjs` (ungetrackter Nachbarplan); die Kette lief mit `--ignore-pattern` auf diesen Ordner.
