# Dateiverweise im Chat: Pfade in Agenten-Antworten öffnen per Klick

Ziel: Nennt der Agent im Chat eine Datei — als Inline-Code (`` `reports/gymid-2291-epassi-sperrfrist-zaehlt-als-checkin.html` ``) oder als Markdown-Link (`[Bericht](reports/x.html)`) —, wird der Pfad klickbar und öffnet die Datei mit dem Standardprogramm von Windows (HTML im Browser). Auslöser: Die Change-Übersichten aus facepass liegen ungetrackt unter `facepass/reports/` und müssen heute von Hand im Explorer gesucht werden.

Kontext für den Umsetzer: [AGENTS.md](../../AGENTS.md) (Regel 5: Workspace des Vorhabens ist die Sicherheitsgrenze), [docs/code-map.md](../code-map.md), [docs/glossary.md](../glossary.md), [docs/conventions/rust.md](../conventions/rust.md), [docs/conventions/react.md](../conventions/react.md), [docs/conventions/typescript.md](../conventions/typescript.md), [docs/conventions/linting.md](../conventions/linting.md), [ADR 010](../decisions/010-worktrees-durch-den-agenten.md) (Ticket-Worktrees), [ADR 018](../decisions/018-ordner-ohne-git.md) (Ordner ohne Git). Vault-Fehlerklassen geprüft (React, TypeScript; für Rust und Tauri gibt es keine Entity): keine einschlägig.

## Phasen

| # | Phase | Rating | Wave | Status |
|---|---|---|---|---|
| 1 | Dateiverweise: Auflösung + Prüfung in Rust, Klick im Chat, Fehlermeldung, ADR 023, Doku | heikel | 1 | pending |

Eine Phase, weil nur das Ganze etwas Klickbares liefert; „heikel“ wegen der Sicherheitsgrenze (die App öffnet Dateien im Namen des Benutzers). Umsetzung direkt auf `main`, ein Commit, Scope `chat`. Vor dem Commit `pnpm check` grün; rustfmt und Clippy brauchen `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Keine automatisierten Tests (Projektprofil); die Auflösung prüft sich mit dem Prüfprogramm `file-link-probe`, der Klick mit der Smoke-Checkliste.

**Schätzung:** ~2 h.

## Scope

- **Drin:** Inline-Code, dessen gesamter Inhalt ein Dateipfad mit erlaubter Endung ist; Markdown-Links mit relativem Pfad oder absolutem Windows-Pfad als Ziel; relative Pfade (gegen die Ordner des Vorhabens) und absolute Pfade (nur innerhalb der Sicherheitsgrenze); angehängte Zeilennummer `:12` bzw. `:12:5` wird ignoriert.
- **Draußen:** Pfade im Fließtext ohne Backticks; Pfade in Codeblöcken (```` ``` ````); Pfade in Werkzeug-Aufrufen, Denkblöcken, Hintergrund-Reitern; Öffnen im Editor an einer Zeile; Anzeige in der App selbst (kein eingebetteter Viewer); Vorab-Prüfung, ob die Datei existiert (der Klick prüft).

## Festgelegte Entscheidungen

Daraus entsteht [ADR 023](../decisions/023-dateiverweise-im-chat.md) „Dateiverweise im Chat“. Vergeben: 001–022 auf der Platte, in geparkten Plänen ist keine weitere reserviert; dieser Plan schreibt 023.

- **Öffnen in Rust, nicht im Frontend.** Neuer Befehl `file_link_open` löst den Pfad auf, prüft Grenze und Endung und öffnet über `tauri_plugin_opener::OpenerExt` (`app.opener().open_path(…)`). Verworfen: `openPath` aus `@tauri-apps/plugin-opener` im Frontend — bräuchte eine Capability mit Pfad-Scope, die die Sicherheitsgrenze des Vorhabens nicht kennt; die Prüfung säße in der Oberfläche statt im Core (AGENTS.md Regel 2/5).
- **Nur Anzeige-Formate, nie Ausführbares.** Erlaubte Endungen (Groß/Klein egal): `html`, `htm`, `pdf`, `svg`, `png`, `jpg`, `jpeg`, `gif`, `webp`, `md`, `txt`. Grund: Das Standardprogramm von `.cmd`, `.bat`, `.exe`, `.ps1`, `.lnk` startet sie; ein Agent könnte so per Klick Code ausführen lassen. Die Liste steht als Konstante in Rust (`file_links::OPENABLE_EXTENSIONS`, maßgeblich) und gespiegelt in TS (`OPENABLE_EXTENSIONS` in `src/lib/fileLinks.ts`, nur für die Darstellung); beide Stellen verweisen per Kommentar aufeinander.
- **Sicherheitsgrenze = Workspace des Vorhabens + Arbeitsordner und Haupt-Checkout jedes Repositorys + die Ticket-Worktrees des Vorhabens.** Geprüft wird nach `fs::canonicalize` von Ziel und Wurzeln mit `starts_with` (wie `background::scratchpad::read`, `scratchpad.rs:84`) — das schlägt `..` und symbolische Links. Innere Repositories und ihre Ticket-Worktrees (facepass: `app-wt-*`) liegen im angehängten Ordner und sind damit abgedeckt.
- **Relative Pfade** werden der Reihe nach gegen `repository.working_dir(&workspace)` jedes Repositorys (in Positions-Reihenfolge) und zuletzt gegen den Workspace aufgelöst; die erste existierende **Datei** gewinnt. Nicht gegen Ticket-Worktrees (welcher wäre gemeint?) — dort braucht es einen absoluten Pfad.
- **Erkennung im Frontend nur am Muster**, ohne Rückfrage beim Core: Ein Kandidat wird als Link dargestellt; ob die Datei existiert und erlaubt ist, entscheidet erst der Klick. Grund: eine Anfrage je Inline-Code beim Rendern kostet bei langen Verläufen hunderte Aufrufe.
- **Fehler** erscheinen in der bestehenden Fehlerleiste der Session (`reportSessionError`, `src/stores/sessionErrors.ts`), Text `Datei nicht geöffnet: <commandErrorText>`; Erfolg räumt sie (`clearSessionError`) wie in `ChatTimeline.tsx` beim Beantworten einer Rückfrage (`reportSessionError(session.id, \`Antwort nicht gesendet: …\`)`).
- **Session-Bezug per React-Kontext** `FileLinkSessionContext` (Wert: Session-ID oder `null`), gesetzt in `ChatTimeline`. `Markdown` bleibt eine generische Komponente; ohne Kontext (`null`) rendert sie Pfade wie bisher, ohne Link.

## Kontrakt

### Rust: `src-tauri/src/file_links/mod.rs` (neu)

```rust
/// Endungen, die per Klick geöffnet werden. Gespiegelt in `src/lib/fileLinks.ts` (nur Darstellung).
pub const OPENABLE_EXTENSIONS: &[&str] = &["html", "htm", "pdf", "svg", "png", "jpg", "jpeg", "gif", "webp", "md", "txt"];

pub struct LinkRoots {
    /// Basen für relative Pfade, in Suchreihenfolge.
    pub relative_bases: Vec<PathBuf>,
    /// Alles, worin ein aufgelöster Pfad liegen darf (Basen + Haupt-Checkouts + Ticket-Worktrees).
    pub allowed: Vec<PathBuf>,
}

/// Bereinigt `raw` (trimmen, Präfix `file:///` entfernen, Endung `:<Zahl>` bzw. `:<Zahl>:<Zahl>` entfernen),
/// prüft die Endung, löst auf und prüft die Grenze. Liefert den zu öffnenden Pfad.
pub fn resolve(raw: &str, roots: &LinkRoots) -> Result<PathBuf, CommandError>;
```

Reihenfolge in `resolve`: bereinigen → Endung prüfen (sonst `FileNotAllowed("Dateityp .<ext> wird nicht geöffnet")`, ohne Endung `FileNotAllowed("Kein Dateityp erkennbar")`) → Kandidaten bilden (absolut: nur dieser; relativ: `base.join(pfad)` je Basis) → erster Kandidat mit `is_file()` → `canonicalize` → liegt in einem kanonisierten `allowed`-Eintrag? (sonst `FileNotAllowed("Liegt außerhalb des Vorhabens")`) → kein Kandidat existiert: `FileNotFound(<bereinigter Pfad>)`. Zurückgegeben wird der Kandidat in nicht-kanonischer Form (ohne `\\?\`-Präfix), damit das Standardprogramm ihn sicher versteht.

### Rust: Fehler in `src-tauri/src/error.rs`

Zwei neue Varianten im `CommandError`-Enum: `FileNotFound(String)`, `FileNotAllowed(String)` (Muster der bestehenden Varianten, Serde-Tag bleibt). Danach `pnpm bindings`; in `src/lib/errors.ts` (`commandErrorText`) je ein Fall: `Datei nicht gefunden: <message>` bzw. `<message>`.

### Rust: Befehl `src-tauri/src/commands/file_links.rs` (neu)

```rust
#[tauri::command]
pub async fn file_link_open(
    app: tauri::AppHandle,
    registry: tauri::State<'_, SessionRegistry>,
    session_id: String,
    path: String,
) -> Result<(), CommandError>;
```

Vorlage für Aufbau und Async: `scratchpad_read` (`commands/background.rs:47`). Wurzeln: `let input = registry.changes_input(&session_id, ChangesReach::Project)?;` (`sessions/registry.rs:1192`, wie in `changes_file_diff`, `commands/changes.rs:26-37`); `relative_bases` = `repository.working_dir(&input.workspace)` je `input.repositories`, dann `input.workspace`; `allowed` = `relative_bases` + `repository.repository_path` je Repository + `source.dir` je Eintrag aus `changes::sources::sources(&input)` (`changes/sources.rs:30`, liefert auch Ticket-Worktrees und innere Repositories, nur solche, die Git noch als Worktree führt). Öffnen: `use tauri_plugin_opener::OpenerExt; app.opener().open_path(pfad.to_string_lossy(), None::<&str>)`, Fehler als `CommandError::Io(e.to_string())`. Registrieren in `lib.rs` (`generate_handler!`) und `pub mod file_links;` in `commands/mod.rs` sowie `mod file_links;` im Crate-Root wie die übrigen Feature-Module.

### Prüfprogramm `src-tauri/examples/file-link-probe.rs` (neu)

`cargo run --manifest-path src-tauri/Cargo.toml --example file-link-probe -- --base <Ordner> [--base …] [--allow <Ordner> …] <pfad>` baut `LinkRoots` (`relative_bases` = alle `--base`, `allowed` = `--base` + `--allow`), ruft `file_links::resolve` und druckt `OK <pfad>` oder `FEHLER <Variante>: <Text>`; Exit-Code 0 bzw. 1. Öffnet nichts. Falls `file_links` dafür aus der Bibliothek erreichbar sein muss: so exportieren, wie `gen-bindings.rs` die Typen erreicht.

### TS: `src/lib/fileLinks.ts` (neu)

```ts
/** Gespiegelt aus `file_links::OPENABLE_EXTENSIONS` (Rust ist maßgeblich). */
export const OPENABLE_EXTENSIONS: readonly string[];
/** Pfad, wenn `text` als Ganzes ein Dateiverweis ist, sonst `null`. */
export function filePathOf(text: string): string | null;
export function openFileLink(sessionId: string, path: string): Promise<void>; // invoke('file_link_open', { sessionId, path })
```

`filePathOf`: trimmen; leer, Zeilenumbruch, länger als 400 Zeichen oder enthält `://` (außer Präfix `file:///`) → `null`; Endung `:<Zahl>(:<Zahl>)?` abschneiden; Endung muss in `OPENABLE_EXTENSIONS` stehen (Groß/Klein egal), sonst `null`. Leerzeichen im Pfad sind erlaubt. Liefert den Text **mit** Zeilennummer zurück (Rust entfernt sie), damit Anzeige und `title` dem Original entsprechen.

### TS: Komponenten

- `src/components/FileLinkSessionContext.ts` (neu): `export const FileLinkSessionContext = createContext<string | null>(null);`
- `src/components/FileLink.tsx` + `FileLink.css` (neu): Props `{ sessionId: string; path: string; children: ReactNode }`. Rendert `<a className="file-link" href="#" title={`Öffnen: ${path}`} onClick onAuxClick>`; Klick: `preventDefault`, `openFileLink`, bei Erfolg `clearSessionError(sessionId)`, bei Fehler `console.error` + `reportSessionError(sessionId, \`Datei nicht geöffnet: ${commandErrorText(reason)}\`)`. Stil: wie `external-link` (Unterstreichung, Zeiger), Inline-Code darin behält seinen Code-Hintergrund. BEM, Tokens laut `docs/conventions/tailwind.md`.
- `src/components/Markdown.tsx`:
  - `code`-Komponente `InlineCode`: Ist `children` ein einzelner String, endet **nicht** auf `\n` (Codeblöcke enden immer auf `\n`, mdast-util-to-hast hängt ihn an), liefert `filePathOf` einen Pfad und ist der Kontext nicht `null` → `<FileLink><code className={className}>{children}</code></FileLink>`. Sonst unverändert `<code className={className}>{children}</code>`. `CodeBlock` (`pre`) bleibt unverändert und muss weiter die Sprache erkennen.
  - `a`-Komponente `MarkdownLink`: Web-URL → `ExternalLink` (unverändert); sonst `filePathOf(decodeURI(href))` + Kontext → `FileLink`; sonst `<span>`. `ExternalLink.tsx` bleibt unverändert.
  - `urlTransform`: `url => /^[A-Za-z]:[\\/]/.test(url) ? url : defaultUrlTransform(url)` — sonst entfernt react-markdown absolute Windows-Pfade (`C:` gilt ihm als unsicheres Protokoll).
- `src/features/chat/ChatTimeline.tsx`: die Verlaufsliste in `<FileLinkSessionContext.Provider value={session.id}>` einhüllen.

## Abnahmekriterien (Phase 1 = Gesamtergebnis)

1. Inline-Code `` `reports/<datei>.html` `` in einer Agenten-Antwort einer Session, an deren Vorhaben facepass hängt, erscheint als Link; Klick öffnet die Datei im Standard-Browser.
2. Ein Markdown-Link `[Bericht](reports/<datei>.html)` verhält sich genauso; ein absoluter Pfad innerhalb von facepass ebenso.
3. `` `starten.cmd` ``, `` `src/main.rs` `` und ein Pfad in einem Codeblock werden **nicht** als Link dargestellt.
4. Ein existierender Pfad außerhalb der Sicherheitsgrenze (z. B. eine `.txt` auf dem Desktop) öffnet nichts, die Fehlerleiste zeigt „Datei nicht geöffnet: Liegt außerhalb des Vorhabens“.
5. Ein nicht existierender Pfad zeigt „Datei nicht geöffnet: Datei nicht gefunden: …“.
6. `` `reports/x.html:12` `` öffnet `reports/x.html`.
7. Web-Links öffnen wie bisher im Browser; Codeblöcke zeigen weiter Sprache und Kopier-Knopf.
8. `pnpm check` grün; `pnpm bindings` erzeugt die zwei neuen Fehlervarianten und sonst keine Änderung.

## Checkliste

- [ ] `file_links/mod.rs` mit `OPENABLE_EXTENSIONS`, `LinkRoots`, `resolve`
- [ ] Fehlervarianten `FileNotFound`, `FileNotAllowed` in `error.rs`; `pnpm bindings`; `errors.ts` ergänzt
- [ ] Befehl `file_link_open` in `commands/file_links.rs`, registriert in `lib.rs` und `commands/mod.rs`
- [ ] Prüfprogramm `examples/file-link-probe.rs`
- [ ] `src/lib/fileLinks.ts`
- [ ] `FileLinkSessionContext.ts`, `FileLink.tsx`, `FileLink.css`
- [ ] `Markdown.tsx`: `InlineCode`, `MarkdownLink`, `urlTransform`
- [ ] `ChatTimeline.tsx`: Kontext setzen
- [ ] ADR 023 `docs/decisions/023-dateiverweise-im-chat.md` aus „Festgelegte Entscheidungen“ (Kontext / Optionen / Entscheidung / Konsequenzen, ~10 Zeilen)
- [ ] `docs/code-map.md`: Zeile `file_links` (Rust-Modul, Befehl, `src/lib/fileLinks.ts`, `src/components/FileLink.tsx`)
- [ ] `docs/glossary.md`: Begriff **Dateiverweis** — Pfad in einer Agenten-Antwort, der per Klick mit dem Standardprogramm öffnet
- [ ] Prüfprogramm-Läufe (Artefakt, siehe DoD)
- [ ] `pnpm check` grün
- [ ] Commit `feat(chat): Dateiverweise im Chat per Klick öffnen`

## Definition of Done

- **AK erfüllt:** AK 8 und die Auflösungs-Seite von AK 1, 2, 4, 5, 6 belegt durch das Prüfprogramm; AK 1–7 durch die Smoke-Checkliste.
- **Sichtbares Ergebnis:** Pfad in einer Agenten-Antwort ist unterstrichen, Klick öffnet die Datei; bei Fehler steht ein Satz in der Fehlerleiste der Session.
- **Artefakt (im Report-Back unten):** die Ausgaben von `file-link-probe` mit `--base C:\Users\smick\develop\easyfitness\facepass` für (a) einen existierenden Bericht unter `reports/` (Name per `Get-ChildItem` ermitteln), (b) denselben mit `:12`, (c) `reports/gibtsnicht.html`, (d) `starten.cmd`, (e) `..\..\..\Desktop\<vorhandene>.txt` bzw. ein absoluter Pfad außerhalb, (f) ein absoluter Pfad in facepass — je Kommando + Ausgabe + Exit-Code; dazu die `pnpm check`-Abschlusszeile.
- **Dateien aktualisiert:** ADR 023, code-map, glossary; Carry-Overs explizit.
- **Seven-Goals-Check** im Report-Back, je eine Zeile; Schwerpunkt Sicherheit.

## Smoke-Checkliste (User, `pnpm tauri dev`)

Wackelstellen zuerst:

1. **Codeblock vs. Inline-Code:** Agent bitten, denselben Pfad einmal in Backticks und einmal in einem ```` ``` ````-Block ohne Sprache auszugeben → nur der Inline-Code ist ein Link, der Block hat weiter seinen Kopier-Knopf.
2. **Absoluter Windows-Pfad als Markdown-Link:** `[x](C:\Users\smick\develop\easyfitness\facepass\reports\<datei>.html)` → öffnet.
3. **Bericht öffnen:** In einer facepass-Session `` `reports/gymid-2291-epassi-sperrfrist-zaehlt-als-checkin.html` `` ausgeben lassen → Klick öffnet den Browser mit der Change-Übersicht.
4. `` `starten.cmd` `` → kein Link.
5. Pfad auf eine `.txt` außerhalb des Vorhabens → Fehlerleiste „Liegt außerhalb des Vorhabens“; Fehlerleiste schließen.
6. `` `reports/gibtsnicht.html` `` → Fehlerleiste „Datei nicht gefunden“.
7. Ein normaler Web-Link öffnet weiter im Browser.

## Konfidenz-Ausweis

- 🟡 **Rust-API des Openers in 2.6.0** (`OpenerExt::open_path(path, Option<&str>)`) aus dem Gedächtnis, Quellen lagen lokal nicht vor. Check: erster `cargo check` nach dem Befehl; scheitert die Signatur, `cargo doc -p tauri-plugin-opener --open` bzw. Quelle unter `~/.cargo/registry/src/*/tauri-plugin-opener-2.6.0/src/lib.rs`.
- 🟡 **Inline/Block-Unterscheidung über das abschließende `\n`.** Check: Smoke 1 — steht deshalb oben.
- 🟡 **`urlTransform` für `C:\…`-Links.** react-markdown 10 lässt nur `http(s)`, `irc(s)`, `mailto`, `xmpp` durch; ohne eigene Funktion wird das Ziel leer. Check: Smoke 2.

## Risiken

1. **Ausführen per Klick** — Mitigation: Erlaubnisliste in Rust, maßgeblich; das Frontend kann sie nicht umgehen.
2. **Drift der Endungsliste Rust ↔ TS** — Folge nur kosmetisch (Link ohne Wirkung bzw. fehlender Link), nie Sicherheit; Kommentar an beiden Stellen.
3. **HTML im Browser führt eigenes JavaScript aus** — gleichwertig zum Doppelklick im Explorer; Dateien liegen im Vorhaben. Akzeptiert.

## Report-Back

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
