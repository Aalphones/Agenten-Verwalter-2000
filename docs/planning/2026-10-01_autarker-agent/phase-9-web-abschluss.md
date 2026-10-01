# Phase 9 — Web (WebFetch, WebSearch über Brave); Doku, Abschluss

Ziel: Das Modell kann Webseiten abrufen und — mit Brave-Schlüssel — im Web suchen. Danach sind Doku, ADR und Glossar fertig und der Plan ist abnahmebereit.

## Kontext

- [README.md](README.md): „Festgelegte Entscheidungen“ (Web, Rechte, Abhängigkeiten), „Kontrakt“ (Werkzeuge `WebFetch`, `WebSearch`), „Finale Abnahmekriterien“, „Smoke-Checkliste“.
- Phase 2/5: `tools/mod.rs`, `llm.rs` (`complete` für die Zusammenfassung), `session.rs` (Fenster).
- Brave Search API — **Endpunkt, Header und Antwortfelder beim Umsetzen gegen die offizielle Doku von Brave prüfen**; Annahme hier: `GET https://api.search.brave.com/res/v1/web/search` mit Parametern `q` und `count`, Header `Accept: application/json` und `X-Subscription-Token: <Schlüssel>`, Treffer unter `web.results[]` mit `title`, `url`, `description` (kann `<strong>`-Auszeichnung enthalten).
- Abhängigkeit `html2text` nach `mode-dependencies` (aktuelle Version, API der Version lesen).
- `src-tauri/src/voice/model_file.rs` (`ureq`, Lesen ohne Größenlimit — hier bewusst mit Limit).
- Fehlerklassen: `ureq` liefert bei Status ab 400 `Err` — Statuscodes für die Fehlersätze unten aus dem Fehler (`ureq::Error::StatusCode`) lesen. Vault `sprachen/typescript.md` („`fetch` wirft nicht bei HTTP-Fehlerstatus“) betrifft TypeScript, hier nicht einschlägig.

## AK der Phase

- „Hol https://www.rust-lang.org und sag mir in zwei Sätzen, worum es geht“ → Werkzeug-Gruppe `WebFetch`, Antwort mit „Quelle: …“.
- Mit `VERWALTER_BRAVE_API_KEY` (vor dem Start des Verwalters gesetzt): „Such im Web nach der aktuellen Version von Tauri“ → `WebSearch` mit Trefferliste, danach typischerweise `WebFetch` auf einen Treffer.
- Ohne Schlüssel bietet der Agent `WebSearch` nicht an (Werkzeugliste in `init`), und das Modell sagt auf Nachfrage, dass es nicht suchen kann.
- Falscher Schlüssel → Fehler „Brave lehnt den Schlüssel ab (Status <n>).“ an das Modell.
- Modus „Manuell“: beide Werkzeuge fragen nach.
- Alle finalen AK der README sind erfüllt; `pnpm check` grün, lokal und in der GitHub-Prüfung.

## Checkliste

### WebFetch `standalone/tools/web_fetch.rs`

- [ ] `url` muss mit `http://` oder `https://` beginnen, sonst Fehler. `ureq`-Agent mit Gesamt-Zeitlimit 30 s, Header `User-Agent: Agenten-Verwalter/<App-Version>`; Weiterleitungen folgt `ureq` selbst.
- [ ] Höchstens 5 MB lesen (`into_reader().take(5 * 1024 * 1024)`). `Content-Type` `text/html` → `html2text` (Zeilenbreite 100); `text/*`, `application/json`, `application/xml` → als Text; sonst Fehler „Inhaltstyp <typ> wird nicht unterstützt.“
- [ ] Text auf höchstens (Fenster × 0,4 × 4) Zeichen kürzen. Unteranfrage über `llm::complete` ohne Werkzeuge: System „You answer a question about a web page using only the page content provided. Answer in the language of the question. Be concise.“, Benutzer „<prompt>\n\n---\n<Seitentext>“. Ergebnis = Antwort + „\n\nQuelle: <endgültige URL>“. `cancel` gilt.
- [ ] Fehler: Status ab 400 → „Seite antwortet mit Status <n>.“; Verbindung → „Seite nicht erreichbar: <fehler>“.

### WebSearch `standalone/tools/web_search.rs`

- [ ] Schlüssel aus `VERWALTER_BRAVE_API_KEY` (getrimmt); leer oder fehlt → das Werkzeug fehlt in `definitions` (Hauptagent und Subagenten).
- [ ] Anfrage nach der Annahme im Kontext, `count=10`, `q` über die Query-Parameter-Funktion von `ureq` (kodiert selbst), Zeitlimit 15 s. Treffer je Zeile „<title> — <url> — <description>“, HTML-Auszeichnung aus `description` per `Regex::new("<[^>]+>")` entfernt. Keine Treffer → „Keine Treffer.“
- [ ] Fehler: 401/403 → „Brave lehnt den Schlüssel ab (Status <n>).“; 429 → „Brave-Kontingent erschöpft (Status 429).“; sonst „Websuche fehlgeschlagen: <fehler>“. Der Schlüssel erscheint nie in Fehlertexten oder auf stderr.

### Einbindung

- [ ] `tools/mod.rs`: beide Werkzeuge in `definitions` und `run`; `permissions::decide`: `Manual` → `Ask`, sonst `Allow`.
- [ ] `prompt.rs`: im Basis-Prompt einen Satz, dass Websuche nur mit `WebSearch` in der Werkzeugliste geht und `WebFetch` für bekannte Adressen dient.

### Doku und Abschluss

- [ ] `AGENTS.md`, Tabelle „Befehle“: Zeile `VERWALTER_BRAVE_API_KEY` — „Schlüssel der Brave Search API für die Websuche des Agenten in der Betriebsart „Autark“; ohne ihn sucht der Agent nicht im Web. Muss beim Start des Verwalters gesetzt sein.“
- [ ] ADR 016 vollständig: alle Konsequenzen der Phasen 1–9 stehen drin, dazu „Suchanfragen gehen an Brave, Seitenabrufe an die jeweilige Seite — nichts an Anthropic.“
- [ ] `docs/knowledge/claude-stream-json.md`: Abschnitt „Nachbau im eigenen Agenten“ mit Verweis auf den Kontrakt in diesem Plan und auf `src-tauri/src/standalone/` — wer `translate.rs` ändert, prüft dort mit.
- [ ] `docs/PROJECT.md`: unter Scope „Agent“ die Betriebsart „Autark“ ergänzen; in „Danach …“ „LM-Studio-Provider“ als erledigt durch ADR 015/016 kennzeichnen.
- [ ] `docs/glossary.md`: Eintrag **Autarker Agent** — „Der eigene Agent des Verwalters für die Betriebsart Autark: gleiche Werkzeugnamen wie Claude Code, Modell aus LM Studio, Subagenten, Hintergrundprozesse, MCP-Server und Web ohne Anthropic ([ADR 016](decisions/016-autarker-agent.md)).“
- [ ] `docs/code-map.md`, Zeile „Autarker Agent“: `tools/web_fetch`, `tools/web_search`; Stand-Satz oben aktualisieren.
- [ ] Commit `feat(standalone): WebFetch und Websuche über Brave`.
- [ ] Smoke-Checkliste der README an den Benutzer übergeben (Abnahme macht er), danach Archivierung und Release nach [releases.md](../../conventions/releases.md) über `mode-implementing`.

## Report-Back
