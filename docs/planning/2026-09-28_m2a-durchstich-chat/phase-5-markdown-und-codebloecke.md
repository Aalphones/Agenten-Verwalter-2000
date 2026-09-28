# Phase 5 — Markdown & Code-Blöcke

**Status:** pending · **Rating:** standard (Bibliotheken, Farben und Aufbau stehen hier fest; kein Entwurf vorhanden, die Struktur unten ist die Vorgabe)

## Kontext

Lesen vor dem Start:

- [README.md](README.md) dieses Plans → „Festgelegte Entscheidungen“ (Markdown-Zeile)
- [Design-README](../../design/2026-09-28_hauptansichten/README.md) → „Gestaltung“ (VS-Code-Anmutung) und „Tokens“ (Namen, Schriftgrößen, Radien)
- [docs/conventions/tailwind.md](../../conventions/tailwind.md) — Hex nur in `src/styles/theme.css`, rohe Tokens im `@theme`, semantische in den drei Theme-Blöcken (hell in `:root`, dunkel in `@media (prefers-color-scheme: dark) { :root:not(.light) }` **und** `:root.dark`, beide Dunkel-Blöcke identisch)
- [docs/conventions/react.md](../../conventions/react.md), [typescript.md](../../conventions/typescript.md)
- Bestand: `src/features/chat/TextBlock.tsx` (Phase 4), `src/styles/theme.css`, `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`
- Vault-Fehlerklassen `frameworks/react.md`, `sprachen/typescript.md`: geprüft, keine einschlägig.

**Design-Deckung:** Für Markdown und Code-Blöcke gibt es keine Tafel. Auf Wunsch von Sascha wird freihändig gebaut, nach den Maßen unten und den Tokens des Entwurfs; Syntaxfarben nach VS Code Dark+ / Light+.

## Abnahmekriterien der Phase

1. Antworten des Agenten (`text`-Einträge) werden als Markdown dargestellt: Absätze, Überschriften (`#` bis `###`), fett/kursiv, Listen (auch verschachtelt und Aufgabenlisten), Zitate, Tabellen, Trennlinie, Links, Inline-Code, Code-Blöcke. Eigene Nachrichten und Gedankengang bleiben Klartext.
2. Code-Block: Kasten mit Rahmen `--color-border-subtle`, Radius `--radius-lg`, Hintergrund `--color-bg-surface`; Kopfzeile 28 px mit Sprache links (`--font-mono` 11 px, `--color-fg-muted`, fehlt die Angabe: „Text“) und Knopf „Kopieren“ rechts (Kopier-Symbol + Text, 12 px); darunter der Code in `--font-mono` 12,5 px, Zeilenhöhe 1,55, Innenabstand 10/12 px, kein Zeilenumbruch, waagrecht scrollbar.
3. „Kopieren“ legt den Code-Text **ohne** Kopfzeile in die Zwischenablage (Probe: in Notepad einfügen, Einrückung und Leerzeilen erhalten); der Knopf zeigt danach 1,5 s „Kopiert“ mit Haken. Schlägt das Kopieren fehl, zeigt er „Fehlgeschlagen“.
4. Syntaxhervorhebung für mindestens TypeScript, JavaScript, Rust, Python, JSON, Bash/PowerShell, CSS, HTML, SQL, Markdown; Farben aus den neuen Tokens, in Hell und Dunkel verschieden.
5. Links öffnen im Standardbrowser des Systems, nie im App-Fenster; nur `http:`/`https:`, andere Ziele sind nicht klickbar (als Text dargestellt). `title` zeigt die Adresse.
6. Rohes HTML im Markdown wird nicht als HTML ausgeführt (Probe: Antwort mit `<img src=x onerror=alert(1)>` zeigt kein Bild und keinen Dialog).
7. `pnpm check` grün.

## Checkliste

### Abhängigkeiten

- [ ] `pnpm add react-markdown remark-gfm rehype-highlight` (aktuelle stabile Hauptversionen; Versionen in FINDINGS).
- [ ] Links: `pnpm add @tauri-apps/plugin-opener`, in `src-tauri/Cargo.toml` `tauri-plugin-opener = "2"`, in `lib.rs` `.plugin(tauri_plugin_opener::init())`, in `capabilities/default.json` die Berechtigung `"opener:default"`. Nach dem Eintragen prüfen, dass `openUrl('https://example.com')` aus der Oberfläche den Browser öffnet; verweigert die Berechtigung (Fehlermeldung in der Konsole) → stattdessen `"opener:allow-open-url"` und in FINDINGS notieren.

### Tokens (`src/styles/theme.css`)

- [ ] Rohe Tokens im `@theme`-Block:

  | Token | Wert | Token | Wert |
  |---|---|---|---|
  | `--color-syntax-blue-400` | `#569cd6` | `--color-syntax-blue-700` | `#0000ff` |
  | `--color-syntax-orange-300` | `#ce9178` | `--color-syntax-red-800` | `#a31515` |
  | `--color-syntax-green-500` | `#6a9955` | `--color-syntax-green-700` | `#008000` |
  | `--color-syntax-lime-200` | `#b5cea8` | `--color-syntax-teal-700` | `#098658` |
  | `--color-syntax-yellow-200` | `#dcdcaa` | `--color-syntax-brown-700` | `#795e26` |
  | `--color-syntax-teal-400` | `#4ec9b0` | `--color-syntax-cyan-700` | `#267f99` |
  | `--color-syntax-sky-200` | `#9cdcfe` | `--color-syntax-navy-800` | `#001080` |

- [ ] Semantische Tokens in allen drei Theme-Blöcken (hell / dunkel):

  | Token | Hell | Dunkel |
  |---|---|---|
  | `--color-code-keyword` | `syntax-blue-700` | `syntax-blue-400` |
  | `--color-code-string` | `syntax-red-800` | `syntax-orange-300` |
  | `--color-code-comment` | `syntax-green-700` | `syntax-green-500` |
  | `--color-code-number` | `syntax-teal-700` | `syntax-lime-200` |
  | `--color-code-function` | `syntax-brown-700` | `syntax-yellow-200` |
  | `--color-code-type` | `syntax-cyan-700` | `syntax-teal-400` |
  | `--color-code-variable` | `syntax-navy-800` | `syntax-sky-200` |

- [ ] Design-README → „Tokens“ um beide Tabellen ergänzen (Quelle der Werte: VS Code Dark+ / Light+).

### Bausteine (`src/components/`)

- [ ] `Markdown.tsx` + `.css`: Props `text: string`. `ReactMarkdown` mit `remarkPlugins={[remarkGfm]}`, `rehypePlugins={[rehypeHighlight]}` (Standard-Sprachsatz von `rehype-highlight`, `detect: false`), **ohne** `rehype-raw`. Eigene Komponenten über `components`: `pre` → `CodeBlock`, `a` → `ExternalLink`. Styles unter der Wurzelklasse `markdown`, Elemente über Kind-Selektoren (`.markdown p`, …), weil `react-markdown` keine BEM-Klassen vergibt — in `Markdown.css` begründen (ein Satz Kommentar):
  - Grundschrift 13,5 px, Zeilenhöhe 1,65; Abstand zwischen Blöcken 8 px, erstes und letztes Kind ohne Außenabstand.
  - `h1` 15 px, `h2` 14 px, `h3` 13,5 px, alle 600, oben 14 px Abstand.
  - Listen mit 20 px Einzug, 2 px zwischen Punkten; Aufgabenlisten-Kästchen gesperrt, in `--color-accent`.
  - Zitat: linke Linie 2 px `--color-border`, 12 px Einzug, `--color-fg-secondary`.
  - Tabelle: höchstens volle Breite, Zellen mit 1 px `--color-border-subtle`, Innenabstand 4/8 px, Kopfzeile 600 auf `--color-bg-hover`; breite Tabellen scrollen waagrecht in einer Hülle.
  - `hr`: 1 px `--color-border-subtle`.
  - Inline-`code` (nicht in `pre`): `--font-mono` 12,5 px, Hintergrund `--color-bg-hover`, Radius `--radius-sm`, Innenabstand 0 4 px.
- [ ] `CodeBlock.tsx` + `.css` (Maße aus AK 2): Kopfzeile + `pre` mit `ref`. Sprache aus der Klasse `language-<x>` des inneren `code`-Elements (über das `children`-Element bzw. per `ref.current.querySelector('code')`), Anzeige in der Schreibweise des Kürzels. Kopieren: `navigator.clipboard.writeText(preRef.current.textContent ?? '')`; Zustand `idle | copied | failed`, Rückkehr zu `idle` per Timer nach 1,5 s (Timer im Cleanup löschen). Knopf `aria-label` „Code kopieren“, danach „Kopiert“. Hervorhebungs-Klassen von highlight.js auf die Tokens abbilden: `hljs-keyword`, `hljs-literal`, `hljs-built_in` → keyword; `hljs-string`, `hljs-regexp` → string; `hljs-comment`, `hljs-quote` → comment; `hljs-number` → number; `hljs-title.function_`, `hljs-title` → function; `hljs-type`, `hljs-title.class_` → type; `hljs-variable`, `hljs-attr`, `hljs-property`, `hljs-params` → variable; `hljs-tag`, `hljs-name` → keyword; `hljs-meta` → comment. Kein highlight.js-Stylesheet importieren.
- [ ] `ExternalLink.tsx` + `.css`: Props `href?: string`, `children`. `http:`/`https:` → `<a href>` mit `onClick` (`preventDefault`, `openUrl(href)` aus `@tauri-apps/plugin-opener`), Farbe `--color-accent-text`, unterstrichen bei Hover und Fokus, `title={href}`. Sonst nur `<span>` mit den Kindern.

### Einbau

- [ ] `src/features/chat/TextBlock.tsx` rendert `<Markdown text={entry.text} />` statt des Klartext-Absatzes; `TextBlock.css` verliert `white-space: pre-line`.

### Doku

- [ ] Design-README → „Abweichungen bis Meilenstein 3“ um „Markdown und Code-Blöcke ohne Tafel, gebaut nach Plan M2a Phase 5“ ergänzen; Verhalten „Verlauf“ um „Antworten als Markdown, Code-Blöcke mit Sprache und Kopieren-Knopf“.
- [ ] `docs/code-map.md`: Geteilte UI-Bausteine um `Markdown`, `CodeBlock`, `ExternalLink` ergänzen.
- [ ] `docs/conventions/react.md` → Stack-Tabelle: Zeile „Markdown | `react-markdown` + `remark-gfm` + `rehype-highlight`, kein rohes HTML“.

## Report-Back
