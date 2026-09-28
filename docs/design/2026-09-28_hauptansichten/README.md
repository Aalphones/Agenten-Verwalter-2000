# Design-Entwurf: Hauptansichten (Meilenstein 1b)

**Status:** abgenommen am 2026-09-28, einschließlich des Nachtrags „Hintergrund“ (Dev-Server, Subagenten, ausgeführte Skripte, Scratchpad der Session). Dieser Entwurf ist der verbindliche Kontrakt für alle Oberflächen-Anteile ab Meilenstein 2. Wo die Umsetzung davon abweichen muss, wird erst dieser Entwurf geändert, dann der Code.

Leitlinie: Die App soll sich in der Bedienung so anfühlen wie die Claude-Erweiterung für VS Code (Eingabeleiste, `/`-Menü, Skills, Modell- und Moduswahl, Anhänge, Verlauf), ergänzt um das, was der Verwalter zusätzlich kann: mehrere Sessions, Changes über mehrere Repositories, Artefakte pro Session. Nachgebaut wird die Bedienung, nicht die Marke.

## Ansehen

- **Veröffentlichte Fassung (klickbar):** https://claude.ai/artifact/9tZub63WjfrfmzQR6eECgx — privat, nur für den Eigentümer sichtbar.
- **Quellen:** [canvas/](canvas/). `Main.dc.html` ist der vollständige klickbare Prototyp; alle anderen `*.dc.html` sind dünne Rahmen, die `Main` mit festen Startwerten zeigen (Ansicht, Session, geöffnetes Menü). `canvas.json` ordnet die Tafeln auf der Zeichenfläche an.
- Die Quellen laufen nur in der Design-Zeichenfläche von claude.ai (sie brauchen deren Laufzeit `support.js`); im Browser direkt geöffnet zeigen sie nichts. Es gibt keine erzeugten Abzüge — die Quellen sind die einzige Fassung.
- Änderungen: auf der Zeichenfläche bearbeiten, dann die geänderten Dateien nach `canvas/` zurückkopieren und im selben Commit diese README nachziehen.

## Tafeln

| Datei | Zeigt | Gebaut in |
|---|---|---|
| `Main.dc.html` | Klickbarer Prototyp, Start: Chat einer laufenden Session | — |
| `Waiting.dc.html` | Chat, Agent wartet auf eine Entscheidung (Rückfrage mit Antwortknöpfen) | M2a |
| `Error.dc.html` | Chat, Agent-Prozess abgestürzt | M2a |
| `Light.dc.html` | Chat im Hellmodus | M6 |
| `Changes.dc.html` | Changes-Ansicht: Filter, Dateibaum pro Repository, Übersicht | M5 |
| `Diff.dc.html` | Changes mit geöffneter Datei (Unified Diff) | M5 |
| `Artifacts.dc.html` | Reiter „Artefakte“: Liste und Vorschau | M5 |
| `Attach.dc.html` | `+`-Menü und angehängte Dateien in der Eingabeleiste | M2 |
| `Cmd.dc.html` | `/`-Knopf: Menü mit Kontext, Modell, Skills, Session | M2 |
| `Slash.dc.html` | `/` ins Eingabefeld getippt: nur Skills und Befehle, filtert beim Tippen | M2 |
| `Model.dc.html` | Modellwahl während der Session | M2a |
| `Mode.dc.html` | Moduswahl (Manuell / Automatisch bearbeiten / Planen / Auto) und Denkaufwand | M2a |
| `NewSession.dc.html` | Neue Session im Inhaltsbereich: Aufgabe mit Anhängen → Repositories → Agent | M2a (Aufgabe, Agent) · M3 (Repositories) · M2b (Anhänge, `/`) |
| `Settings.dc.html` | Einstellungen | M6 |
| `Empty.dc.html` | Erster Start ohne Sessions | M2a |
| `Rename.dc.html` | Rechtsklick-Menü auf einer Session (Umbenennen, Archivieren) | M4 |
| `BgProc.dc.html` | Hintergrund-Panel, Reiter „Prozesse“: laufende Dev-Server und ausgeführte Skripte mit Ausgabe | M2 |
| `BgAgents.dc.html` | Hintergrund-Panel, Reiter „Subagenten“: Aufgabe, Status, Schritte, Ergebnis | M2 |
| `BgScratch.dc.html` | Hintergrund-Panel, Reiter „Scratchpad“: Dateien im temporären Ordner der Session mit Vorschau | M3 |

Jeder Meilenstein baut seine Tafeln gleich nach diesem Entwurf, nicht als Zwischenlösung. M6 schließt die restlichen Tafeln, den Hellmodus-Feinschliff und die Konsistenz über alle Ansichten ab.

## Gestaltung

- Ruhig und neutral, dunkel als Referenz, kompakt. Farben und Schrift wie VS Code (Dark Modern / Light Modern), dazu ein eigener warmer Orangeton als einzige Akzentfarbe: Senden, Fokus, Skills, Hauptknöpfe.
- Farbe trägt sonst nur der Session-Status. Jeder Status hat zusätzlich eine eigene Form, damit er ohne Farbunterscheidung lesbar bleibt: Läuft = gefüllter Punkt mit Hof, Wartet = Ring mit Punkt, Fehler = Warndreieck, Pausiert = zwei Balken, Abgeschlossen = Haken.
- Keine eigene Fensterleiste: Windows-Titelleiste bleibt, der Produktname steht oben in der Sidebar.
- Hilfetexte nur als dezente ⓘ-Erklärung oder als ein Satz direkt am Eingabefeld.

## Layout-Maße

| Element | Maß |
|---|---|
| Sidebar | 256 px breit, Kopf 48 px, Session-Zeile mit Statussymbol 14 px + Name + eine Meta-Zeile (abgeschlossene Sessions ohne Meta-Zeile) |
| Sidebar-Gruppen | „Braucht dich“ (wartet + Fehler), „Läuft“ (läuft + pausiert), „Abgeschlossen“ — in dieser Reihenfolge, leere Gruppen entfallen |
| Session-Kopfzeile | 48 px, dreispaltig: links Titel + Status-Pille + ⋯-Menü, Mitte Reiter „Chat · Changes · Artefakte“ (mit Zählern), rechts Hintergrund-Knopf, Kontext-Balken 48 × 4 px, Laufzeit, Pause/Abbrechen bzw. Fortsetzen |
| Hintergrund-Panel | rechts neben der jeweiligen Session-Ansicht, 440 px breit, Hintergrund `bg-sidebar`; Kopf 44 px mit Reitern „Prozesse · Subagenten · Scratchpad“ und Schließen; Liste oben (höchstens 330 px, scrollt), Detail darunter: Titel, Meta-Zeile, Aktionen, Ausgabe in `font-mono` 12 px / 19 px auf `bg-base` |
| Chat-Spalte | höchstens 780 px breit, zentriert, 32 px Seitenrand, Verlauf unten verankert |
| Eingabeleiste | gleiche Breite wie die Chat-Spalte; Radius 10 px; Rahmen 1 px `border`, **nur bei Fokus** `accent` plus 3 px Ring `accent-subtle`; Anhänge als Zeile über dem Textfeld; unten links `+` und `/` (30 × 30 px) und die Modell-Pille (26 px hoch, Radius 13 px), rechts Modus-Knopf und Senden (30 × 30 px, `accent`) |
| Menüs der Eingabeleiste | öffnen nach oben, 8 px Abstand, Radius 10 px, `shadow-popover`; `/`-Menü so breit wie die Eingabeleiste, höchstens 470 px Listenhöhe mit Scrollen; `+` 330 px, Modell 340 px, Modus 430 px |
| Changes | Werkzeugleiste 44 px; Dateiliste 340 px breit, Einrückung 14 px pro Ordnerebene; Diff: Zeilennummern je 48 px, Vorzeichen 20 px, Zeilenhöhe 20 px |
| Artefakte | Liste 300 px breit, Vorschau füllt den Rest mit 20 px Rand |
| Neue Session, Einstellungen | Inhalt höchstens 720 bzw. 780 px, zentriert; Einstellungszeile: Beschriftung 230 px + Bedienelement |

## Verhalten

- **Anhänge:** über `+`, Hineinziehen oder Ctrl+V; Bilder mit Vorschaubild und Abmessungen, andere Dateien mit Symbol und Größe; jeder Chip hat ein ×. Gesendete Nachrichten zeigen ihre Anhänge weiter. Das Aufgabenfeld unter „Neue Session“ nimmt ebenfalls Anhänge an.
- **`/`-Knopf** öffnet das volle Menü: Kontext (anhängen, Datei erwähnen, zurückspulen, exportieren), Modell (wechseln, Denkaufwand als Fünf-Punkte-Regler, Denken ein/aus), Skills (mit Herkunft „Benutzer“ oder „aus <Repository>“), Session (`/rename`, `/changes`, `/artefakte`, `/pause`). Ein Filterfeld oben filtert alles.
- **`/` im Eingabefeld** am Zeilenanfang öffnet dasselbe Menü, beschränkt auf Skills und Session-Befehle, und filtert mit jedem weiteren Zeichen. Ein gewählter Skill wird als `/name ` ins Feld gesetzt; im gesendeten Verlauf erscheint er als farbige Marke, darunter die Zeile „Skill <name> geladen · <Herkunft>“.
- **Modell** gilt ab der nächsten Nachricht, der Verlauf bleibt. **Denkaufwand:** Niedrig · Mittel · Hoch · Sehr hoch · Max. **Modus:** Manuell · Automatisch bearbeiten · Planen · Auto, wechselbar mit Umschalt+Tab.
- **Artefakte**, die Claude in einer Session erstellt, erscheinen im Verlauf als Karte („In der Session ansehen“) und im Reiter „Artefakte“ mit Vorschau, „Im Chat besprechen“ (setzt einen Verweis ins Eingabefeld) und „Im Browser öffnen“.
- **Umbenennen:** Rechtsklick auf die Session, F2, Doppelklick oder ⋯ in der Kopfzeile; der Name wird direkt in der Sidebar bearbeitet, Enter speichert, Esc bricht ab. Der Name entsteht sonst aus dem ersten Satz der Aufgabe.
- **Hintergrund:** Der Knopf in der Kopfzeile zeigt „n im Hintergrund“ (laufende Dev-Server + laufende Subagenten, mit blauem Punkt) bzw. nur „Hintergrund“, und öffnet oder schließt das Panel. Reiter **Prozesse**: „Läuft“ (Befehl, Repository, Adresse, Laufzeit; Aktionen Im Browser öffnen, Neu starten, Beenden) und „Ausgeführt“ (Befehl mit ✓ oder ✕ und Exit-Code; Aktionen Im Chat besprechen, Ausgabe kopieren, Erneut ausführen). Reiter **Subagenten**: Aufgabe, Typ, Modell, Werkzeugaufrufe, Dauer, Ergebnis, Schritte als `⎿`-Zeilen; laufende lassen sich anhalten. Reiter **Scratchpad**: Dateibaum des Ordners mit Größe und Uhrzeit, Vorschau für Text und Bilder; Aktionen Im Chat besprechen, Im Explorer zeigen. Leere Listen sagen in einem Satz, was fehlt.
- **Im Verlauf** erscheinen gestartete Subagenten als Zeile „● Agent <Typ> <Aufgabe> · <Status> · n Aufrufe“ und Hintergrundprozesse als „● Bash im Hintergrund <Befehl> → <Adresse>“; ein Klick öffnet das Panel auf genau diesem Eintrag.
- **Verlauf:** eigene Nachrichten im Kasten, Antworten frei als Markdown (Code-Blöcke mit Sprache und Kopieren-Knopf); Werkzeugaufrufe als Punkt-Zeilen, gruppiert und eingeklappt, aufgeklappt mit `⎿`-Zeilen; „Gedankengang · n s“ eingeklappt; Aufgabenliste mit Kästchen; Rückfragen mit nummerierten Antwortknöpfen; laufende Arbeit mit „Esc unterbricht“.

## Tokens

Namen folgen [../../conventions/tailwind.md](../../conventions/tailwind.md): rohe Tokens im `@theme`, Komponenten lesen nur semantische.

### Rohe Farben

| Token | Wert | Token | Wert |
|---|---|---|---|
| `--color-neutral-0` | `#ffffff` | `--color-neutral-700` | `#3c3c3c` |
| `--color-neutral-50` | `#f8f8f8` | `--color-neutral-750` | `#37373d` |
| `--color-neutral-75` | `#f5f5f5` | `--color-neutral-800` | `#2e2e30` |
| `--color-neutral-100` | `#f0f0f0` | `--color-neutral-820` | `#2b2b2b` |
| `--color-neutral-150` | `#e5e5e5` | `--color-neutral-840` | `#252526` |
| `--color-neutral-175` | `#d4d4d4` | `--color-neutral-850` | `#242428` |
| `--color-neutral-200` | `#cecece` | `--color-neutral-900` | `#1f1f1f` |
| `--color-neutral-225` | `#c8c8c8` | `--color-neutral-950` | `#181818` |
| `--color-neutral-300` | `#b0b0b0` | `--color-slate-50` | `#f3f3f6` |
| `--color-neutral-400` | `#8f8f8f` | `--color-slate-100` | `#e4e6f1` |
| `--color-neutral-500` | `#6e6e6e` | `--color-orange-300` | `#eea283` |
| `--color-neutral-600` | `#555555` | `--color-orange-400` | `#e0825c` |
| `--color-neutral-650` | `#4a4a4f` | `--color-orange-600` | `#c4572f` |
| `--color-blue-400` | `#5b9dff` | `--color-orange-700` | `#a8461f` |
| `--color-blue-600` | `#2563eb` | `--color-orange-990` | `#1d130e` |
| `--color-amber-400` | `#f2b33d` | `--color-green-50` | `#e8f6ee` |
| `--color-amber-700` | `#a86a00` | `--color-green-400` | `#4cc38a` |
| `--color-red-50` | `#fdeceb` | `--color-green-700` | `#16803c` |
| `--color-red-400` | `#f47067` | `--color-red-600` | `#d23b33` |

Syntaxfarben (Quelle: VS Code Dark+ / Light+):

| Token | Wert | Token | Wert |
|---|---|---|---|
| `--color-syntax-blue-400` | `#569cd6` | `--color-syntax-blue-700` | `#0000ff` |
| `--color-syntax-orange-300` | `#ce9178` | `--color-syntax-red-800` | `#a31515` |
| `--color-syntax-green-500` | `#6a9955` | `--color-syntax-green-700` | `#008000` |
| `--color-syntax-lime-200` | `#b5cea8` | `--color-syntax-teal-700` | `#098658` |
| `--color-syntax-yellow-200` | `#dcdcaa` | `--color-syntax-brown-700` | `#795e26` |
| `--color-syntax-teal-400` | `#4ec9b0` | `--color-syntax-cyan-700` | `#267f99` |
| `--color-syntax-sky-200` | `#9cdcfe` | `--color-syntax-navy-800` | `#001080` |

### Semantische Farben

`x @ n %` heißt `color-mix(in srgb, var(x) n%, transparent)`.

| Token | Dunkel | Hell |
|---|---|---|
| `--color-bg-base` | `neutral-900` | `neutral-0` |
| `--color-bg-sidebar` | `neutral-950` | `neutral-50` |
| `--color-bg-surface` | `neutral-840` | `neutral-0` |
| `--color-bg-popover` | `neutral-840` | `neutral-0` |
| `--color-bg-hover` | `neutral-800` | `neutral-100` |
| `--color-bg-selected` | `neutral-750` | `slate-100` |
| `--color-border-subtle` | `neutral-820` | `neutral-150` |
| `--color-border` | `neutral-700` | `neutral-200` |
| `--color-fg-primary` | `neutral-175` | `neutral-700` |
| `--color-fg-secondary` | `neutral-300` | `neutral-600` |
| `--color-fg-muted` | `neutral-400` | `neutral-500` |
| `--color-accent` | `orange-400` | `orange-600` |
| `--color-fg-on-accent` | `orange-990` | `neutral-0` |
| `--color-accent-subtle` | `orange-400 @ 16 %` | `orange-600 @ 10 %` |
| `--color-accent-text` | `orange-300` | `orange-700` |
| `--color-toggle-on` | `orange-400` | `orange-600` |
| `--color-toggle-off` | `neutral-650` | `neutral-225` |
| `--color-fg-on-toggle` | `neutral-75` | `neutral-0` |
| `--color-status-running` | `blue-400` | `blue-600` |
| `--color-status-waiting` | `amber-400` | `amber-700` |
| `--color-status-error` | `red-400` | `red-600` |
| `--color-status-paused` | `neutral-400` | `neutral-500` |
| `--color-status-completed` | `green-400` | `green-700` |
| `--color-diff-add-bg` | `green-400 @ 11 %` | `green-50` |
| `--color-diff-del-bg` | `red-400 @ 11 %` | `red-50` |
| `--color-diff-add-fg` | `green-400` | `green-700` |
| `--color-diff-del-fg` | `red-400` | `red-600` |
| `--color-diff-hunk-bg` | `neutral-850` | `slate-50` |
| `--color-code-keyword` | `syntax-blue-400` | `syntax-blue-700` |
| `--color-code-string` | `syntax-orange-300` | `syntax-red-800` |
| `--color-code-comment` | `syntax-green-500` | `syntax-green-700` |
| `--color-code-number` | `syntax-lime-200` | `syntax-teal-700` |
| `--color-code-function` | `syntax-yellow-200` | `syntax-brown-700` |
| `--color-code-type` | `syntax-teal-400` | `syntax-cyan-700` |
| `--color-code-variable` | `syntax-sky-200` | `syntax-navy-800` |

### Weitere Tokens

| Token | Wert |
|---|---|
| `--font-sans` | `'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif` |
| `--font-mono` | `'Cascadia Code', 'Cascadia Mono', Consolas, ui-monospace, monospace` |
| `--font-size-2xs` · `xs` · `sm` · `md` · `lg` · `xl` | 11 · 12 · 12.5 · 13 · 13.5 · 18 px (`md` = Grundschrift der Oberfläche, `lg` = Chat-Text und Überschriften) |
| `--space-2xs` · `xs` · `sm` · `md` · `lg` · `xl` · `2xl` · `3xl` · `4xl` · `5xl` | 2 · 4 · 6 · 8 · 10 · 12 · 16 · 20 · 24 · 32 px |
| `--radius-sm` · `md` · `lg` · `xl` · `full` | 4 · 6 · 8 · 10 · 999 px |
| `--shadow-popover-dark` / `--shadow-popover-light` (roh), semantisch `--shadow-popover` | `0 10px 30px rgb(0 0 0 / 0.45)` / `0 10px 30px rgb(0 0 0 / 0.14)` |
| `--duration-fast` · `--duration-base` · `--ease-out` | 100 ms · 160 ms · `cubic-bezier(0.2, 0, 0, 1)` |
| `--z-base` … `--z-tooltip` | 0 · 10 · 20 · 30 · 40 · 50 · 60 (base, dropdown, sticky, overlay, modal, toast, tooltip) |

Beide Schriften sind auf Windows 11 vorinstalliert; es wird keine Schrift mit der App ausgeliefert.

## Abweichungen bis Meilenstein 3

Was die Oberfläche in Meilenstein 2a bewusst anders oder gar nicht baut ([Plan-README](../../planning/2026-09-28_m2a-durchstich-chat/README.md), „Keine Wegwerf-Oberfläche“):

- **Fehlt ganz** (kein toter Knopf): Reiter „Changes“ und „Artefakte“ (M5), Hintergrund-Knopf, `+` und `/` (M2b), ⋯-Menü und Umbenennen (M4), Einstellungen-Knopf (M6), Schritt „Repositories“ in Neue Session (M3).
- **Neue Session:** Der Agent-Abschnitt trägt die Nummer 2, solange „Repositories“ fehlt.
- **Status „Abgebrochen“:** Haken-Symbol in gedämpfter Farbe, Sidebar-Gruppe „Abgeschlossen“.
- **Status „Startet“:** dasselbe Symbol wie „Läuft“.
- **Status „Wartet“:** Anzeige „Wartet“ statt „Wartet auf dich“ (Sidebar-Zeile sagt weiter „wartet auf deine Antwort“).
- **Denkaufwand-Punkte:** wie im Entwurf — die gewählte Stufe ist der große Punkt, nicht ein Füllstand.
- **Leerzustand:** Erklärsatz ohne Worktrees („Er arbeitet in einem eigenen Ordner, damit parallele Agenten sich nicht in die Quere kommen.“).
- **Werkzeug-Zeile „unterbrochen“:** Ein Aufruf, der bei Pause oder Abbruch noch lief, zeigt hinter dem Ziel „unterbrochen“ in gedämpfter Farbe — nie „nicht ausgeführt“, denn er kann trotzdem gelaufen sein. Ein fehlgeschlagener Aufruf zeigt den Werkzeugnamen in der Fehlerfarbe.
- **Rückfrage mit Mehrfachauswahl:** Optionen schalten um (gewählt: Rahmen in Akzentfarbe), darunter der Knopf „Antworten“; ohne Mehrfachauswahl sendet der Klick sofort. Mehrere Fragen stehen nacheinander im selben Kasten, jede mit eigener Nummerierung.
- **Beantwortete Rückfrage:** Der Kasten bleibt im Verlauf, die Knöpfe sind gesperrt, der Kopf lautet „Claude hat gefragt“ in gedämpfter Farbe mit neutralem Rahmen, die Fußzeile „Antwort: …“ nennt die Antwort bzw. wie die Frage erledigt wurde („Erlaubt“, „Pausiert“, „Nicht beantwortet“ …).
- **Markdown und Code-Blöcke:** ohne Tafel, gebaut nach Plan M2a Phase 5 — Code-Block mit Kopfzeile (Sprache links, „Kopieren“ rechts) auf `bg-surface`, Syntaxfarben nach VS Code Dark+ / Light+; Links öffnen im Standardbrowser.
- **Eingabeleiste:** ohne die Knöpfe `+` und `/`, Platzhalter „Nachricht an Claude …“ ohne den Zusatz „(/ für Skills, @ für Dateien)“. Wartet der Agent auf eine Rückfrage, lautet er „Antwort an Claude …“; in den Status „Abgebrochen“ und „Fehler“ ist das Feld gesperrt und nennt den Grund. Umschalt+Tab wechselt den Modus reihum, Esc pausiert (ein offenes Menü schließt Esc zuerst).
- **Fehler-Kasten:** „Protokoll anzeigen“ klappt die letzten Zeilen der Fehlerausgabe im Kasten auf (Schrift `font-mono` 12 px / 19 px auf `bg-base`, höchstens 240 px hoch); „Agent neu starten“ steht nur am letzten Fehler und nur im Status „Fehler“.

## Platzhalter im Entwurf

- Alle Inhalte sind Beispieldaten: Sessions, Nachrichten, Dateien, Diffs, Skill-Namen, Modellbeschreibungen.
- Die Changes-Daten sind für jede Session dieselben; nur der Diff von `backend/src/auth/oauth.ts` ist ausgearbeitet.
- Die Artefakt-Vorschauen sind skizzierte Stellvertreter; die App zeigt das echte Artefakt.
- Hintergrund-Daten gibt es nur für die Session „OAuth Login“; der Pfad `…\workspaces\<session>\.scratch` ist ein Platzhalter — wo der Scratchpad-Ordner liegt, entscheidet Meilenstein 3 (Frage in GAPS).
- Die Auswahlfelder in „Neue Session“ und in den Einstellungen sind nur als geschlossene Knöpfe gezeichnet; „Archivieren“, „Zurückspulen“, „Verlauf exportieren“ und die Agent-Knöpfe haben im Prototyp keine Funktion.
- Hover- und Tastaturfokus-Zustände sind nicht gezeichnet (die Zeichenfläche unterstützt sie in eingebetteten Tafeln nicht); Fokus in der Umsetzung: 2 px Ring `accent` mit 2 px Abstand.

## Offene technische Fragen

Ob Skills aus mehreren Repositories, Artefakte und Anhänge mit der Claude-Kommandozeile so funktionieren wie gezeichnet, klärt der Durchstich in Meilenstein 2 — Fragen in [../../knowledge/GAPS.md](../../knowledge/GAPS.md).
