# Phase 3 — Oberfläche: zwei Fenster in der Kopfzeile, Doku-Abschluss

Rating: standard · Commit-Scope: `ui`

## Kontext (vor dem Start lesen)

- [README.md](README.md) dieses Plans: „Kontrakt“ und „Finale Abnahmekriterien“.
- Generierte Typen aus Phase 1 und 2 unter `src/lib/bindings/` (`SessionContext`, `ContextBreakdown`, `UsageStatus`, `UsageSnapshot`, …).
- [docs/conventions/react.md](../../conventions/react.md), [typescript.md](../../conventions/typescript.md), [tailwind.md](../../conventions/tailwind.md) (Tokens + BEM-CSS je Komponente).
- Code: `src/app/SessionHeader.tsx` + `.css` (Kontext-Balken, Knopf „Hintergrund“ als Stil-Muster, `CONTEXT_WARNING_PERCENT`), `src/components/Popover.tsx` + `.css` (Hülle: Esc, Klick daneben, muss Kind eines `position: relative`-Elements sein, das auch den Auslöser enthält), `src/components/ModelMenu.tsx` (Muster: Auslöser + `Popover` in einem Anker), `src/lib/background.ts` (Muster Wrapper + `listen`), `src/features/background/useSessionBackground.ts` (Muster Hook mit Abo + Nachladen), `src/styles/theme.css` (drei Blöcke: hell, `prefers-color-scheme: dark`, `[data-theme="dark"]`), `src/features/changes/changesScope.ts` (`formatCount`).
- Vault-Fehlerklassen: geprüft (React, TypeScript) — keine einschlägig.

## Abnahmekriterien

1. **Kontext-Auslöser:** Der bestehende Kontext-Balken samt „42k / 200k“ ist ein `<button>` (Optik unverändert, dazu Hover-Hintergrund wie der Knopf „Hintergrund“ und Fokus-Rahmen); Tooltip „Kontext dieser Session — Klick zeigt, was ihn belegt“. Klick schaltet das Kontext-Fenster (`Popover`, `placement="below"`, `align="end"`, Breite 360, `label="Kontext"`).
2. **Kontext-Fenster mit Aufschlüsselung**, von oben nach unten:
   - Titel „Kontext“, darunter das Modell (`breakdown.model`, Mono) und „98,3k / 1,0M Tokens (10 %)“ (`totalTokens`, `maxTokens`, Prozent gerundet).
   - Gestapelter Balken, 8 px hoch, volle Breite: je belegte Kategorie (`!isFree`) ein Segment mit Breite `tokens / maxTokens`, Farben `--color-chart-1` … `--color-chart-7` nach Reihenfolge der belegten Kategorien (ab der 8. wieder von vorn); Rest = Spur (`--color-bg-hover`). Gibt es `autoCompactThreshold`, markiert eine 1-px-Linie in `--color-fg-muted` die Stelle `threshold / maxTokens`.
   - Tabelle mit Spaltenköpfen „Kategorie“, „Tokens“, „Anteil“: je Kategorie Farbpunkt (freie: Spur-Farbe mit Rand `--color-border`), deutscher Name, Tokens formatiert, Anteil mit einer Nachkommastelle („0,3 %“). Namen übersetzt: `System prompt` → „Systemprompt“, `System tools` → „Systemwerkzeuge“, `MCP tools` → „MCP-Werkzeuge“, `MCP server instructions` → „MCP-Server-Anweisungen“, `Memory files` → „Memory-Dateien“, `Skills` → „Skills“, `Messages` → „Nachrichten“, `Free space` → „Freier Platz“, `Autocompact buffer` → „Puffer fürs Zusammenfassen“; Unbekanntes unverändert.
   - Bei `autoCompactThreshold`: Zeile „Automatisches Zusammenfassen ab 167k Tokens“ mit Info-Icon, Tooltip „Ab hier fasst Claude den bisherigen Verlauf zusammen, um Platz zu schaffen.“
   - Abschnitt „Memory-Dateien“ (nur wenn vorhanden): je Datei Pfad (Mono; länger als 48 Zeichen → „…“ + die letzten 47 Zeichen, in TS gekürzt, kein CSS-Trick; voller Pfad als `title`) und Tokens rechts.
   - Fußzeile: „Stand 13:58“ (Uhrzeit aus `fetchedAt`, `HH:MM`); bei `isAgentRunning` rechts Knopf „Aktualisieren“ (ruft `refreshContext`), sonst „· Agent ruht“ ohne Knopf.
3. **Kontext-Fenster ohne Aufschlüsselung** (`breakdown === null`): Titel, „42k von 200k Tokens belegt“ aus der Session-Zusammenfassung und darunter bei laufendem Agenten „Aufschlüsselung wird geladen …“, sonst „Die Aufschlüsselung kommt mit der nächsten Antwort des Agenten.“
4. **Kontingent-Auslöser** (`UsageButton`) zwischen Kontext und Laufzeit: 32 px breiter Mini-Balken (wie der Kontext-Balken) + Mono-Text „5h 80 %“ (Eintrag mit `kind === 'session'`). Ab 90 % Füllung und Text in `--color-status-waiting`. Vor dem ersten Stand „5h –“; ohne `session`-Eintrag im Stand nur „Kontingent“. Tooltip „Kontingent deines Claude-Abos (5-Stunden-Fenster) — Klick für Details“. Klick schaltet das Kontingent-Fenster (`Popover`, `below`, `end`, Breite 380, `label="Kontingent"`).
5. **Kontingent-Fenster**, von oben nach unten:
   - Titel „Kontingent“, rechts daneben „Abo: Pro“ (`plan`, erster Buchstabe groß), falls vorhanden.
   - Je Eintrag in `limits`: Bezeichnung links, Prozent rechts, Balken 6 px (Warnfarbe ab 90 %), darunter klein „Zurückgesetzt in 2 Std.“. Bezeichnungen: `session` → „Session (5 Std.)“, `weekly_all` → „Woche (alle Modelle)“, `weekly_opus` → „Woche (Opus)“, `weekly_sonnet` → „Woche (Sonnet)“, sonst der Rohwert. Restzeit: < 60 min „in N Min.“, < 48 h „in N Std.“, sonst „in N Tagen“; fehlt `resetsAt` oder liegt er in der Vergangenheit → Zeile weglassen.
   - `limits` leer → „Für dieses Konto meldet Claude kein Kontingent (zum Beispiel bei Anmeldung per API-Schlüssel).“
   - Abschnitt „Was treibt den Verbrauch?“ (nur wenn `day` oder `week` da): Umschalter „Tag“ | „Woche“ (zwei Knöpfe im Stil der Reiter in `SessionHeader.css`, Standard „Tag“, `aria-pressed`), darunter klein „Näherung aus den Sessions auf diesem Rechner — ohne andere Geräte und claude.ai“. Je Eintrag in `behaviors` eine fette Zeile + eine gedämpfte Erklärung:
     - `long_context`: „{p} % deines Verbrauchs lief mit mehr als 150k Kontext“ / „Lange Sessions kosten mehr, auch mit Cache. Für ein neues Thema eine neue Session anlegen.“
     - `cron`: „{p} % kam aus Sessions, die 8+ Stunden aktiv waren“ / „Oft Hintergrund- oder Schleifen-Sessions; Dauerbetrieb summiert sich schnell.“
     - `high_parallel`: „{p} % lief, während 4+ Sessions parallel arbeiteten“ / „Alle Sessions teilen sich ein Kontingent.“
     - unbekannter `key`: „{p} % · {key}“ ohne Erklärung.
     - Sind `skills` da: fette Zeile „{p} % kam aus /{name}“ für den ersten Eintrag + Erklärung „Aufwendige Skills lassen sich eingrenzen oder per Frontmatter auf ein günstigeres Modell legen.“, dann Tabelle „Skills“ / „Anteil“ mit allen Einträgen („/name“, „29 %“).
     - Letzte Zeile klein: „1.288 Anfragen · 64 Sessions“.
   - Fehler (`error !== null`): Zeile in `--color-status-error` „Kontingent nicht abrufbar: {error}“ über der Fußzeile; ein vorhandener Stand bleibt darüber sichtbar.
   - Fußzeile: „Stand 13:58“ (fehlt ohne Stand) und rechts Knopf „Aktualisieren“ (`refreshUsage(true)`); während `isLoading` deaktiviert mit Text „Lädt …“.
6. **Nachladen:** `useUsage` lädt beim Einhängen (`loadUsage` + `refreshUsage(false)`), bei jedem `usage://changed` (`loadUsage`), beim Öffnen des Fensters (`refreshUsage(false)`) und alle 300 s per Intervall, wenn `document.visibilityState === 'visible'` (`refreshUsage(false)`). `useSessionContext` lädt beim Öffnen (`refreshContext` + `loadContext`), bei `context://changed` mit passender Session-ID (`loadContext`, nur solange geöffnet) und bei Session-Wechsel neu.
7. Zahlen deutsch: Tokens < 1000 als ganze Zahl, < 1 Mio. als „98,3k“, darüber „1,0M“ (eine Nachkommastelle, Komma); Prozent „10 %“ mit normalem Leerzeichen — eine Funktion für alle Stellen.
8. Beide Fenster schließen mit Esc und Klick daneben; hell und dunkel lesbar; `pnpm check` grün.

## Checkliste

### Wrapper und Tokens

- [x] `src/lib/context.ts`: `loadContext(sessionId)` (`context_load`), `refreshContext(sessionId): Promise<boolean>` (`context_refresh`), `onContextChanged(callback)` (`context://changed`, Nutzlast `ContextChangedEvent`) — JSDoc mit `@throws` wie in `src/lib/background.ts`.
- [x] `src/lib/usage.ts`: `loadUsage()` (`usage_load`), `refreshUsage(force: boolean)` (`usage_refresh`), `onUsageChanged(callback)` (`usage://changed`, ohne Nutzlast).
- [x] `src/styles/theme.css`: semantische Tokens `--color-chart-1` … `--color-chart-7` in **allen drei** Blöcken. Hell: `blue-600`, `orange-600`, `green-700`, `amber-700`, `syntax-teal-700`, `red-600`, `neutral-500`. Dunkel (beide Blöcke gleich): `blue-400`, `orange-400`, `green-400`, `amber-400`, `syntax-teal-400`, `red-400`, `neutral-400`. Jeweils als `var(--color-…)` auf die vorhandenen Rohwerte.

### Kontext

- [x] `src/features/context/formatTokens.ts`: `formatTokens(tokens: number): string` und `formatPercent(value: number, digits: 0 | 1): string` nach AK 7; dazu `formatClock(ms: number): string` (`HH:MM`, `toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })`). Wird auch von `usage` importiert.
- [x] `src/features/context/categoryLabels.ts`: Übersetzungstabelle aus AK 2 + `categoryLabel(name)`.
- [x] `src/features/context/useSessionContext.ts`: `useSessionContext(sessionId: string, isOpen: boolean): SessionContext | null` nach AK 6; Fehler mit `console.error` wie in `SessionHeader.runAction`.
- [x] `src/features/context/ContextPopover.tsx` + `ContextPopover.css` (BEM-Block `context-popover`): Props `session: SessionSummary`, `onClose`. Rendert `Popover` mit Inhalt nach AK 2/3.
- [x] `SessionHeader.tsx`: `const [openPanel, setOpenPanel] = useState<'context' | 'usage' | null>(null)`; Kontext-Anzeige in `<div className="session-header__anchor">` (`position: relative`) mit `<button className="session-header__context" …>` und bei `openPanel === 'context'` `<ContextPopover …/>`. Beim Session-Wechsel schließt ein offenes Fenster: in `App.tsx` bekommt `<SessionHeader>` `key={currentSession.id}` (hat bisher keinen `key`), damit der Zustand mit der Session neu beginnt.

### Kontingent

- [x] `src/features/usage/usageTexts.ts`: Bezeichnungen der `kind`s, Texte der `behaviors` samt Erklärungen (AK 5), `formatResetIn(resetsAt: string, now: number): string | null`.
- [x] `src/features/usage/useUsage.ts`: `useUsage(isOpen: boolean): UsageStatus | null` nach AK 6.
- [x] `src/features/usage/UsagePopover.tsx` + `.css` (Block `usage-popover`): Props `status: UsageStatus | null`, `onClose`. Umschalter Tag/Woche als lokaler `useState<'day' | 'week'>('day')`.
- [x] `src/features/usage/UsageButton.tsx` + `.css` (Block `usage-button`): Props `isOpen`, `onToggle`, `onClose`; ruft `useUsage(isOpen)`, rendert Anker `position: relative` mit Knopf nach AK 4 und bei `isOpen` `UsagePopover`. In `SessionHeader` zwischen Kontext und Laufzeit, gesteuert über `openPanel === 'usage'`.

### Doku

- [x] `docs/code-map.md`: Oberflächen-Spalte der Zeilen „Kontext“ (`src/features/context/`, Wrapper `src/lib/context.ts`, Auslöser in `src/app/SessionHeader.tsx`) und „Kontingent“ (`src/features/usage/`, Wrapper `src/lib/usage.ts`) füllen; `SessionHeader.tsx` in der Zeile „App-Rahmen“ um „Kontext-Fenster, Kontingent-Anzeige“ ergänzen; Chart-Tokens in der Zeile „Design-Tokens“ erwähnen.
- [x] `docs/glossary.md`: „Kontext-Aufschlüsselung“ (was den Kontext der Session belegt, von der Claude-Kommandozeile gemeldet, letzter Stand im Speicher des Core), „Kontingent“ (Nutzungsgrenzen des Claude-Abos: 5-Stunden-Fenster und Woche; englisch „Usage“), „Hilfsprozess“ (kurz gestarteter `claude.exe` nur für eine Abfrage, ohne Session).
- [x] README dieses Plans: Status aller Phasen, Summary/Files/Commits füllen; STATE.md auf die Smoke-Checkliste zeigen lassen.

## Report-Back
