# Meilenstein 6 — UI auf Zielbild, plus Altlasten

Ziel: Die App erreicht das MVP. Die Sidebar bekommt unten den Knopf „Einstellungen“; er öffnet die Einstellungsseite nach Tafel `Settings` mit Farbschema (Dunkel · Hell · System), Standardmodell, Standard-Modus mit Denkaufwand, Skill-Übersicht, Ordner der Workspaces und Dateizugriff. Das Farbschema wirkt sofort und überlebt den Neustart ohne Aufblitzen des falschen Schemas. Neue Vorhaben starten mit den eingestellten Standardwerten. Die Sidebar, die Listen im Hintergrund-Panel und der Scratchpad-Baum rendern nur, was sichtbar ist. Jeder Lade- und Aktionsfehler, der heute nur in der Entwicklerkonsole landet, erscheint als Satz in der Oberfläche. Dazu drei Altlasten aus M1 und M4: Esc auf einen laufenden Werkzeug-Aufruf zeigt „unterbrochen“ statt „fehlgeschlagen“, das Hilfsprogramm für die Typ-Erzeugung liegt nicht mehr im Installer, und das Nachladen langer Verläufe lässt sich im Entwicklungsmodus mit kleiner Seitengröße prüfen.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [PROJECT.md](../../PROJECT.md), [code-map.md](../../code-map.md), [glossary.md](../../glossary.md), [ADR 002](../../decisions/002-typgenerierung-und-listen.md) (Typ-Erzeugung, virtuelle Listen), [ADR 003](../../decisions/003-claude-anbindung.md) (Pause/Esc), [ADR 004](../../decisions/004-persistenz-und-wiederherstellung.md) (Datenbank, Migrationen), [ADR 010](../../decisions/010-worktrees-durch-den-agenten.md) (Haupt-Checkout, Ticket-Worktrees; die App legt keine Branches an), ADR 012 (entsteht in Phase 2 aus „Festgelegte Entscheidungen“ unten), [Design-Entwurf](../../design/2026-09-28_hauptansichten/README.md) (Tafeln `Settings`, `Light`; Abschnitte „Layout-Maße“, „Tokens“, „Abweichungen vom Entwurf“), die Konventionen unter [docs/conventions/](../../conventions/).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Altlasten: Esc-Zustand, Typ-Erzeugung raus aus dem Installer, Seitengröße des Verlaufs | [phase-1-altlasten.md](phase-1-altlasten.md) | mechanisch | complete |
| 2 | Core: Einstellungen speichern | [phase-2-einstellungen-core.md](phase-2-einstellungen-core.md) | standard | complete |
| 3 | Oberfläche: Einstellungsseite, Farbschema, Standardwerte in „Neue Session“ | [phase-3-einstellungen-oberflaeche.md](phase-3-einstellungen-oberflaeche.md) | standard | complete |
| 4 | Virtuelle Listen: Sidebar, Hintergrund-Panel, Scratchpad | [phase-4-virtuelle-listen.md](phase-4-virtuelle-listen.md) | standard | complete |
| 5 | Sichtbare Fehler statt Konsole, Doku-Abschluss | [phase-5-fehler-und-doku.md](phase-5-fehler-und-doku.md) | standard | complete |

**Start erst, wenn der Plan „Vorhaben und Sessions“ (2026-09-30) archiviert ist.** Er baut die Sidebar zum Baum aus Vorhaben und Sessions um und ersetzt `session_create`/`session_archive` durch `project_create`/`project_archive`; die Phasen 2 bis 5 dieses Plans sind gegen diesen Stand geschrieben. Er belegt Migration 005 und ADR 011, dieser Plan nimmt Migration 006 und ADR 012; der Plan „Sprachdiktat“ (ADR 009) folgt nach diesem. Reihenfolge fest: 1 → 2 → 3 → 4 → 5 (Phase 3 braucht die Commands aus 2; Phase 4 und 5 fassen Dateien an, die Phase 3 ändert — `Sidebar.tsx`, `App.tsx`). Umsetzung direkt auf dem aktuellen Branch, ein Commit pro Phase, Phase 1 zwei Commits (Scopes: Phase 1 `sessions` und `setup`, Phase 2 `settings`, Phase 3 `settings`, Phase 4 `ui`, Phase 5 `ui`). Vor jedem Commit muss `pnpm check` grün sein; rustfmt und Clippy brauchen `cargo` im PATH (`$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Nach jeder Änderung an Typen über die Tauri-Grenze `pnpm bindings` ausführen und die erzeugten Dateien mit committen. Das Projekt hat keine automatisierten Tests und bekommt keine. Erkenntnisse während der Umsetzung gehören nach [FINDINGS.md](FINDINGS.md).

## Festgelegte Entscheidungen

Phase 2 schreibt daraus ADR 012 „Einstellungen, Farbschema und virtuelle Listen“ (Kontext / betrachtete Optionen / Entscheidung / Konsequenzen).

### Einstellungen

- **Speicherort:** Tabelle `settings` (`key TEXT PRIMARY KEY`, `value TEXT NOT NULL`), Migration 006 (nach dem Plan „Vorhaben und Sessions“, der 005 nimmt). Enums liegen als ihr serde-Text (`db::enum_to_text` / `enum_from_text`, wie Modell und Modus in `sessions`), der Präfix wörtlich. Fehlt ein Schlüssel oder lässt sich sein Wert nicht lesen, gilt der Standardwert; ein unlesbarer Wert wird nicht überschrieben, bis der Benutzer ihn ändert.
- **Schlüssel und Standardwerte:** `color_scheme` = `system`, `default_model` = `sonnet`, `default_effort` = `high`, `default_mode` = `auto`. Die Standardwerte sind die bisher fest eingebauten (M2a: Sonnet 5, Denkaufwand Hoch, Modus Auto) — wer nichts einstellt, merkt keinen Unterschied.
- **Zeilen der Seite** (Reihenfolge und Abschnitte nach Tafel `Settings`; ⓘ-Texte wörtlich in Phase 3):
  - Darstellung → **Farbschema**: Segment Dunkel · Hell · System, wirkt sofort.
  - Agent → **Standardmodell**: Auswahlknopf, öffnet das bestehende Modell-Menü. → **Standard-Modus**: Auswahlknopf mit Wert „<Modus> · Denkaufwand <Stufe>“, öffnet das bestehende Modus-Menü samt Denkaufwand-Punkten. Abweichung vom Entwurf: Dort steht der Denkaufwand in der Modell-Zeile; in der App gehört er seit M2a zum Modus-Menü, die Einstellungsseite folgt der App.
  - Skills → **Benutzer-Skills**: Pfad `~\.claude\skills` (als absoluter Pfad), Anzahl der Skills dort, Knopf „Im Explorer zeigen“. → **Projekt-Skills**: Text „<Repository> <n> · …“ für alle bekannten Repositories mit mindestens einem Skill, Zusatz „je Repository“.
  - Ordner → **Workspaces**: nur Anzeige des Pfads plus Knopf „Im Explorer zeigen“ (Entscheidung Sascha, 2026-09-29: nicht änderbar — die Asset-Freigabe `$HOME/.verwalter/**` und die Sicherheitsgrenze bleiben unberührt). Im Entwurf hieß der Abschnitt „Git“ und die Zeile „Ordner für Worktrees“; seit ADR 010 liegen dort die Workspaces der Vorhaben, App-Worktrees nur noch bei Sessions davor.
  - Rechte → **Dateizugriff**: nur Anzeige „Workspace und Repositories des Vorhabens“. Es gibt keine zweite Möglichkeit, ein Auswahlknopf mit einer Option wäre ein toter Knopf.
- **Weggelassen:** Zeile „Basis für Changes“ (Entscheidung Sascha, 2026-09-29). Changes vergleicht weiter gegen den Base ref je Repository (ADR 006); ein globales Feld widerspräche dem.
- **Weggelassen:** Zeile „Branch-Präfix“ (Entscheidung Sascha, 2026-10-01). Seit ADR 010 legt die App bei neuen Vorhaben keine Branches an; Branch-Namen bestimmt das Regelwerk des Agenten. Ein Präfix-Feld hätte keine Wirkung.
- **„Im Explorer zeigen“ statt „Ordner öffnen“ / „Ändern …“:** beide Knöpfe nutzen `revealItemInDir` aus `@tauri-apps/plugin-opener`, das `opener:default` schon erlaubt; `openPath` bräuchte eine eigene Freigabe mit Pfad-Scope.

### Farbschema

- **Umsetzung:** `theme.css` kennt schon drei Zustände: ohne Klasse folgt `:root` der Systemeinstellung (`prefers-color-scheme`), `:root.dark` erzwingt Dunkel, `:root.light` erzwingt Hell. Die App setzt oder entfernt nur diese Klasse an `document.documentElement`. Feste Farben außerhalb von `theme.css` gibt es nicht (geprüft am 2026-09-29: kein Hex-, `rgb(`- oder `rgba(`-Treffer unter `src/app`, `src/components`, `src/features`), deshalb braucht der Hellmodus keine Komponenten-Änderung.
- **Titelleiste:** `getCurrentWindow().setTheme('dark' | 'light' | null)` aus `@tauri-apps/api/window` (`null` = System), damit die Windows-Titelleiste zum Inhalt passt. Braucht die Berechtigung `core:window:allow-set-theme` in `src-tauri/capabilities/default.json`.
- **Kein Aufblitzen beim Start:** Die Datenbank ist die Quelle. Zusätzlich spiegelt die Oberfläche die Wahl in `localStorage` unter `verwalter.colorScheme`; `src/main.tsx` liest diesen Spiegel synchron vor dem ersten Rendern und setzt die Klasse. Nach dem Laden der Einstellungen gewinnt der Wert aus der Datenbank und überschreibt den Spiegel. Verworfen: Klasse erst nach `settings_load` setzen (ein Frame im falschen Schema bei jedem Start).

### Virtuelle Listen

- **Virtualisiert werden:** der Baum der Sidebar (Gruppen-Überschriften, Vorhaben-Zeilen, Zeilen der aufgeklappten Sessions), die Listen der Reiter „Prozesse“ und „Subagenten“ im Hintergrund-Panel, der Scratchpad-Baum (bis zu 2000 Einträge, `MAX_ENTRIES` in `background/scratchpad.rs`). Bibliothek wie bisher `@tanstack/react-virtual` (ADR 002), Muster wie `src/features/changes/FileTree.tsx` + `buildFileRows.ts`: Gruppen werden zu einer flachen Zeilenliste (Überschrift, Eintrag, Leer-Satz), die Zeilenhöhe misst `measureElement`.
- **Nicht virtualisiert** (bleiben klein): `/`-Menü, Repository-Auswahl, Werkzeug-Gruppen im Verlauf (liegen schon im virtualisierten Verlauf), Aufgabenliste, Anhänge-Zeile.
- **Daten:** Die Oberfläche hält weiter alle nicht archivierten Session-Zusammenfassungen und alle Hintergrund-Einträge der sichtbaren Session im Speicher (kleine Objekte, Ausgaben werden nie mitgeladen). AGENTS.md Regel 3 gilt für das Gerenderte; das Nachladen der Daten seitenweise ist kein Teil von M6.

### Sichtbare Fehler

- Ein Lade- oder Aktionsfehler erscheint als ein Satz in Fehlerfarbe (`--color-status-error`) an der Stelle, an der das Ergebnis fehlt: statt der Liste, statt der Ausgabe, oder als eine Zeile unter der Session-Kopfzeile. Kein Toast, kein Dialog. Die Konsole bleibt zusätzlich. Die vollständige Liste der Stellen steht in Phase 5.
- **Aktionsfehler einer Session** (Pause, Abbrechen, Fortsetzen, Rückfrage beantworten, Agent neu starten) sammelt der neue Zustand-Slice `src/stores/sessionErrors.ts`; die Zeile unter der Kopfzeile zeigt den letzten Fehler der sichtbaren Session, bis die nächste Aktion dieser Session gelingt oder der Benutzer sie mit × schließt.

### Altlasten

- **Esc-Zustand:** Ein Werkzeug-Ergebnis mit `is_error`, das eintrifft, während Pause oder Abbruch angefordert ist, setzt die Werkzeug-Zeile auf „unterbrochen“ statt „fehlgeschlagen“. Ein Aufruf, der im selben Augenblick echt fehlschlug, heißt dann ebenfalls „unterbrochen“; das ist mit der Bedeutung von „unterbrochen“ vereinbar (er kann gelaufen sein).
- **Typ-Erzeugung:** `src-tauri/src/bin/gen-bindings.rs` wird zu `src-tauri/examples/gen-bindings.rs`, Aufruf `cargo run --example gen-bindings`. Tauri bündelt nur Programme mit Ziel-Art `bin`; ein `example` landet nie im Installer, und `cargo clippy --all-targets` prüft Beispiele weiter mit. Verworfen: `required-features` an der Bin-Definition — Clippy mit `--all-targets` überspringt die Bin dann still, solange nicht auch `--all-features` gesetzt ist.
- **Seitengröße des Verlaufs:** Im Entwicklungsmodus liest `useChatEntries` die Seitengröße aus der Umgebungsvariablen `VITE_VERWALTER_CHAT_PAGE_SIZE` (ganze Zahl 1–500, sonst 200). Damit löst schon ein kurzer Verlauf das Nachladen beim Hochscrollen aus. Im gebauten Programm gilt immer 200.

## Kontrakt

### Typen im Core

Alle mit `derive(Debug, Clone, Serialize, Deserialize, TS)` und `#[serde(rename_all = "camelCase")]` (Enums mit Nutzlast zusätzlich `tag = "kind"`, `rename_all_fields = "camelCase"`), eingetragen in `src-tauri/examples/gen-bindings.rs`. `ModelId`, `Effort`, `Mode` sind die bestehenden Typen aus `src-tauri/src/agents/event.rs`.

```rust
// src-tauri/src/settings/model.rs (Phase 2)
pub enum ColorScheme { Dark, Light, System }                     // zusätzlich Copy, PartialEq, Eq
pub struct Settings {
    pub color_scheme: ColorScheme,
    pub default_model: ModelId,
    pub default_effort: Effort,
    pub default_mode: Mode,
}
pub struct SettingsOverview {
    pub settings: Settings,
    pub user_skills_dir: String,     // absolut: <Benutzerordner>\.claude\skills
    pub user_skill_count: u32,       // Einträge mit SkillKind::Skill und SkillOrigin::User
    pub workspaces_dir: String,      // absolut: <Benutzerordner>\.verwalter\workspaces
}
pub enum SettingsChange {                                        // tag = "kind"
    ColorScheme { value: ColorScheme },
    DefaultModel { value: ModelId },
    DefaultMode { mode: Mode, effort: Effort },
}
```

In TypeScript heißen die Werte `'dark' | 'light' | 'system'` und `{ kind: 'colorScheme', value } | { kind: 'defaultModel', value } | { kind: 'defaultMode', mode, effort }`.

### Tauri Commands (registriert in `src-tauri/src/lib.rs`)

| Command | Parameter | Rückgabe | Wrapper | Phase |
|---|---|---|---|---|
| `settings_load` | — | `SettingsOverview` | `loadSettings()` in `src/lib/settings.ts` | 2 |
| `settings_update` | `change: SettingsChange` | `Settings` (Stand nach dem Speichern) | `updateSettings(change)` | 2 |

### Oberfläche

```ts
// src/stores/sessions.ts (Phase 3)
// im State zusätzlich: showSettings: boolean, openSettings(), closeSettings()
// openSettings setzt showSettings = true, showNewSession = false und showProjectOverview = false; openNewSession, selectSession und selectProject setzen showSettings = false

// src/stores/settings.ts (Phase 3) — flüchtige Kopie des geladenen Stands, Quelle bleibt der Core
// im State: settings: Settings | null, setSettings(settings)

// src/stores/sessionErrors.ts (Phase 5)
// im State: errors: Record<string, string>  (Schlüssel = Session-ID)
//           report(sessionId, message), clear(sessionId)
```

## Finale Abnahmekriterien

1. Die Sidebar zeigt unten den Knopf „Einstellungen“ (30 px hoch, Symbol wie im Entwurf); er öffnet die Einstellungsseite im Inhaltsbereich (Kopf 48 px „Einstellungen“, Inhalt höchstens 780 px zentriert, Beschriftungsspalte 230 px, Abschnitte Darstellung · Agent · Skills · Ordner · Rechte) und ist dann hervorgehoben. Jede Zeile hat ein ⓘ mit Erklärung.
2. Farbschema Dunkel/Hell/System wirkt sofort auf Inhalt und Windows-Titelleiste, überlebt einen Neustart und blitzt beim Start nicht im anderen Schema auf. „System“ folgt einem Wechsel der Windows-Einstellung ohne Neustart.
3. Standardmodell und Standard-Modus samt Denkaufwand gelten für das nächste „Neues Vorhaben“ (dessen erste Session); bestehende Sessions und weitere Sessions in einem Vorhaben ändern sich nicht — die übernehmen den Stand der letzten Session (Plan „Vorhaben und Sessions“).
4. Der Erklärtext der Repository-Auswahl beschreibt den Stand nach ADR 010: der Agent arbeitet im Haupt-Checkout, die App legt keinen Branch und keinen Worktree an.
5. Benutzer-Skills zeigen Pfad und Anzahl, Projekt-Skills die Repositories mit Skills; „Im Explorer zeigen“ öffnet den Explorer am Skill-Ordner bzw. am Ordner der Workspaces.
6. Sidebar, Prozesse-, Subagenten- und Scratchpad-Liste bleiben bei 300 Vorhaben (dazu aufgeklappt über 600 Session-Zeilen), 500 ausgeführten Befehlen bzw. 2000 Scratchpad-Einträgen flüssig; Umbenennen, ⋯-Menü, Auswahl und Tastaturbedienung funktionieren wie vorher.
7. Keine der in Phase 5 gelisteten Fehlerstellen endet nur in der Konsole.
8. Esc auf einen laufenden, erlaubten Werkzeug-Aufruf → Zeile „unterbrochen“.
9. Nach `pnpm tauri build` liegt kein `gen-bindings.exe` im Installationsordner; `pnpm bindings` erzeugt dieselben Dateien wie vorher.
10. `pnpm check` grün; ADR 012, Code-Map, Glossar, PROJECT.md, AGENTS.md, ADR 002, `rust.md` und Entwurfs-README (Tafel-Zuordnung, Abweichungen) beschreiben den tatsächlichen Stand.

## Smoke-Checkliste

Führt Sascha am Plan-Ende durch. Wackelstellen zuerst:

- [ ] **Farbschema beim Start:** Windows auf Dunkel, in der App „Hell“ wählen, App schließen, neu starten → das erste sichtbare Bild ist hell, kein dunkles Aufblitzen; die Titelleiste ist hell. Dann „System“ wählen und Windows auf Hell/Dunkel umstellen → App folgt ohne Neustart, Titelleiste auch.
- [ ] **Sidebar virtualisiert:** mit vielen Sessions (mindestens so viele, dass die Liste scrollt) ganz nach unten scrollen, ein Vorhaben und eine aufgeklappte Session per Doppelklick umbenennen, ein Vorhaben per Rechtsklick archivieren; F2 auf die aktive Session bzw. auf die Übersicht des Vorhabens, während die Zeile aus dem sichtbaren Bereich gescrollt ist → die Liste springt zu ihr, das Namensfeld hat den Fokus. Chevron eines Vorhabens mit vielen Sessions auf- und zuklappen → die Zeilen darunter erscheinen und verschwinden ohne Sprung.
- [ ] **Hintergrund-Listen:** Agent bitten, 300-mal `echo n` einzeln auszuführen (oder ein Skript mit vielen Aufrufen) → „Ausgeführt“ scrollt flüssig, Auswahl mit Klick und Tastatur geht, Detail zeigt die richtige Ausgabe. Scratchpad mit vielen Dateien (Agent bitten, 1500 kleine Dateien anzulegen) → Baum scrollt flüssig.
- [ ] **Nachladen langer Verläufe:** App mit `$env:VITE_VERWALTER_CHAT_PAGE_SIZE = "20"; pnpm tauri dev` starten, Session mit mehr als 60 Verlaufseinträgen öffnen, hochscrollen → ältere Einträge laden in Stücken nach, ohne Sprung und ohne Lücke; ganz oben steht der erste Eintrag der Session.
- [ ] **Esc-Zustand:** Agent einen Befehl mit Wartezeit ausführen lassen (`Start-Sleep 30` bzw. `sleep 30`), währenddessen Esc → die Zeile zeigt „unterbrochen“.
- [ ] Hellmodus: jede Ansicht einmal ansehen (Leerzustand, Neue Session, Chat mit Rückfrage, Fehlerkasten, Changes mit Diff, Hintergrund-Panel alle Reiter, `/`-, `+`-, Modell- und Modus-Menü, Einstellungen) → nichts unlesbar, keine dunklen Reste; mit Tafel `Light` vergleichen.
- [ ] Standardmodell auf Opus, Standard-Modus auf Planen mit Denkaufwand Max → „Neues Vorhaben“ startet mit diesen Werten; eine bestehende Session behält ihre, und „Neue Session“ in einem Vorhaben übernimmt die der letzten Session.
- [ ] „Neues Vorhaben“ mit Repository: der Erklärtext der Repository-Auswahl nennt keinen Branch `verwalter/…` mehr.
- [ ] „Im Explorer zeigen“ bei Benutzer-Skills und Workspaces → Explorer öffnet mit markiertem Ordner.
- [ ] Sichtbare Fehler: App starten, während `verwalter.db` von einem anderen Programm gesperrt ist (z. B. in „DB Browser for SQLite“ mit offener Schreib-Transaktion) → die Sidebar nennt den Fehler statt „Noch keine Sessions.“
- [ ] Installer: `pnpm tauri build`, installieren → im Installationsordner nur `verwalter.exe` (plus Deinstaller), kein `gen-bindings.exe`.
- [ ] Mit Tastatur: Tab erreicht Einstellungen-Knopf, alle Bedienelemente der Seite, ⓘ-Knöpfe; Fokus sichtbar (2 px Ring in Akzentfarbe).
- [ ] Rückstände aus M2b, M3 und M5 (Smoke-Listen in deren README), soweit noch offen, im selben Durchgang abarbeiten.

## Summary

Einstellungsseite mit Farbschema (sofort wirksam, ohne Aufblitzen beim Start) und Standardwerten für neue Vorhaben; Sidebar, Hintergrund-Listen und Scratchpad-Baum virtualisiert; Lade- und Aktionsfehler als Sätze in der Oberfläche; Altlasten erledigt (Esc-Zustand „unterbrochen“, Typ-Erzeugung als Example, Seitengröße des Verlaufs einstellbar).

## Files touched

Core: `src-tauri/src/settings/`, `commands/settings.rs`, `db/settings.rs`, Migration 006, `examples/gen-bindings.rs`. Oberfläche: `src/features/settings/`, `src/lib/colorScheme.ts`, `src/stores/settings.ts`, `src/stores/sessionErrors.ts`, `src/lib/useActionError.ts`, `src/app/SessionActionError.*`, Sidebar, Hintergrund-Reiter, Chat-Hooks. Doku: ADR 012, Code-Map, PROJECT.md, Entwurfs-README.

## Commits

Phase 1: `95af818`, `43decde` · Phase 2: `0fe0d61` · Phase 3: `53e6abb` · Phase 4: `2b55a1f` · Phase 5: `feat(ui): show load and action errors as sentences`.

## Deviations from plan

- `useActionError.run` nimmt `prefix` als optionalen zweiten Parameter statt als Pflichtparameter; die Aufrufer im Hintergrund-Panel bleiben unverändert. `run` schreibt außerdem selbst ins `console.error`.
- Die Sidebar bekommt einen einzigen `loadError` (Vorhaben vor Sessions, Ladefehler vor Abo-Fehler); der Satz steht immer über der Liste, „Noch keine Vorhaben.“ entfällt dabei.
- Nach einem gescheiterten Nachladen älterer Einträge löst das automatische Auffüllen bei kurzem Verlauf nicht erneut aus (sonst Schleife); der nächste Versuch kommt vom Hochscrollen.

## Follow-ups

- Smoke-Checkliste durch Sascha, Rückstände aus M2b, M3 und M5 im selben Durchgang.
