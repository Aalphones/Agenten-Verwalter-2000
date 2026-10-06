# Plan: Artefakte — HTML-Seiten des Agenten im Reiter „Artefakte“

Ein Agent legt Berichte, Präsentationen, Diagramme und Design-Entwürfe als HTML-Datei im Ordner `.artefakte` des Vorhabens ab; der Verwalter zeigt sie im Reiter „Artefakte“ (Session-Kopfzeile und Vorhaben-Übersicht) als echte, bedienbare Seite, abgeschottet vom Verwalter selbst, und lädt sie nach jedem Speichern von allein neu.

Design (verbindlich): [docs/design/2026-10-05_artefakte/](../../design/2026-10-05_artefakte/README.md) — [artefakte.html](../../design/2026-10-05_artefakte/artefakte.html) im Browser öffnen. Es führt die Tafel `Artifacts.dc.html` aus [docs/design/2026-09-28_hauptansichten/](../../design/2026-09-28_hauptansichten/README.md) fort.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [docs/code-map.md](../../code-map.md), [docs/glossary.md](../../glossary.md), die Konventionen unter [docs/conventions/](../../conventions/), [ADR 014](../../decisions/014-changes-je-session.md) (Tabelle `session_files`), [ADR 022](../../decisions/022-scratchpad-im-workspace.md) (Vorbild für Ordner + Anweisung), [ADR 023](../../decisions/023-dateiverweise-im-chat.md) (Öffnen über das Opener-Plugin). ADR 026 entsteht in Phase 1 (024 und 025 sind an „MCP-Anmeldung“ und „Git-Werkzeuge“ vergeben).

**Fehlerklassen geprüft:** React (`frameworks/react.md`) — nur testbezogene Klassen, in diesem Projekt ohne automatisierte Tests nicht einschlägig; für Tauri und Rust gibt es keine Entity. Keine einschlägig.

## Phasen

| Phase | Inhalt | Rating | Status |
|---|---|---|---|
| 1 | [Core: Ordner, Liste, Protokoll, Sicherheitsprobe](phase-1-core-und-protokoll.md) | heikel | complete |
| 2 | [Reiter „Artefakte“ mit Liste und Vorschau](phase-2-reiter.md) | standard | complete |
| 3 | [Vollbild](phase-3-vollbild.md) | standard | pending |
| 4 | [Anweisung an den Agenten, Karte im Chat, Abschluss](phase-4-anweisung-und-karte.md) | standard | pending |

Reihenfolge fest: 2 braucht Liste und Protokoll aus 1, 3 baut auf der Vorschau aus 2 auf, die Karte in 4 öffnet den Reiter aus 2. Unabhängig vom Plan „Autark“: die Anweisung läuft über `--append-system-prompt`, das der autarke Agent schon liest (`standalone/args.rs`).

## Kontrakt (Core ↔ Oberfläche)

**Ordner:** `<Workspace des Vorhabens>\.artefakte\` (`Session.workspace` ist für alle Sessions eines Vorhabens derselbe Ordner). Ein **Artefakt** ist jede Datei mit Endung `.html` oder `.htm` (Groß-/Kleinschreibung egal) **direkt** in diesem Ordner. Unterordner tragen Bilder, Skripte und Stylesheets, die eine Seite relativ einbindet; sie sind selbst keine Artefakte.

**Typen** (Rust, `derive(Serialize, TS)`, `serde(rename_all = "camelCase")`, in `src-tauri/src/artifacts/model.rs`, Export in `src-tauri/examples/gen-bindings.rs`):

```rust
pub struct Artifact {
    /// Dateiname im Ordner, z. B. "quartalsbericht-q3.html".
    pub file: String,
    /// Inhalt von <title>, sonst der Dateiname ohne Endung.
    pub title: String,
    /// Letzte Änderung der Datei, ms seit 1970.
    pub modified_at: f64,
    /// Session des Vorhabens, die die Datei zuletzt mit einem schreibenden Werkzeug angefasst hat
    /// (Tabelle `session_files`); `None`, wenn keine (z. B. per Shell geschrieben).
    pub session_id: Option<String>,
    pub session_number: Option<u32>,
    pub session_name: Option<String>,
}

pub struct ArtifactList {
    /// Absoluter Pfad des Ordners `.artefakte`, auch wenn es ihn noch nicht gibt.
    pub dir: String,
    /// Adresse des Ordners auf dem Artefakt-Server, mit `/` am Ende
    /// (`http://127.0.0.1:<port>/<token>/<session-id>/`); gilt nur, solange die App läuft.
    pub base_url: String,
    /// Neueste Änderung zuerst.
    pub items: Vec<Artifact>,
}
```

**Commands** (`src-tauri/src/commands/artifacts.rs`, Wrapper `src/lib/artifacts.ts`):

| Command | Rückgabe | Wirkung |
|---|---|---|
| `artifacts_list(session_id: String)` | `ArtifactList` | Artefakte des Vorhabens, zu dem die Session gehört; fehlt der Ordner, ist `items` leer |
| `artifact_open_in_browser(session_id: String, file: String)` | `()` | öffnet `<Ordner>\<file>` mit dem Standardprogramm (Opener-Plugin, wie `file_link_open`); `file` muss ein Artefakt aus der Liste sein |

**Artefakt-Server** (`src-tauri/src/artifacts/server.rs`, gestartet in `setup` in `src-tauri/src/lib.rs`, verwaltet als State `ArtifactServer`): eigener HTTP-Server auf `127.0.0.1` mit Zufalls-Port, `std::net`, keine neue Abhängigkeit. Adresse `http://127.0.0.1:<port>/<token>/<session-id>/<pfad>`; `<token>` ist je App-Start zufällig (UUID v4), `<pfad>` relativ zum Ordner `.artefakte`, Segmente prozent-kodiert. Kein eigenes Tauri-Protokoll: Tauri stuft Seiten eines von der App registrierten Protokolls als „lokal“ ein (volle Rechte der App), und die Init-Skripte samt Invoke-Key laufen unter Windows auch im iframe (FINDINGS → Phase 1); `127.0.0.1` ist für Tauri entfernte Herkunft, jeder Befehl wird ohne Remote-Capability abgewiesen. Antwort-Header: `Content-Type` nach Endung, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Access-Control-Allow-Origin: *`, `Content-Security-Policy` = **Artefakt-CSP** (unten). `Host` ≠ `127.0.0.1:<port>` → 403 (DNS-Rebinding); falscher Token, unbekannte Session, fehlende Datei → 404; Pfade außerhalb des Ordners → 403; andere Methode als `GET` → 405.

TS-Helfer in `src/lib/artifacts.ts`:

```ts
export function artifactUrl(baseUrl: string, file: string, modifiedAt: number): string {
  const path: string = file.split('/').map(encodeURIComponent).join('/');
  return `${baseUrl}${path}?v=${String(modifiedAt)}`;
}
```

**Abschottung:**

- Vorschau-`<iframe>` mit `sandbox="allow-scripts allow-forms allow-modals"` (ohne `allow-same-origin`, ohne `allow-popups`, ohne `allow-top-navigation`) und `allow="fullscreen"`.
- **Artefakt-CSP** (Antwort-Header jeder Datei des Servers, `<scope>` = `http://127.0.0.1:<port>/<token>/<session-id>/`): `default-src <scope> https: data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src <scope> https:; form-action 'none'; base-uri <scope>` — Internet über https erlaubt, `ipc:`/`http://ipc.localhost` und die Ordner anderer Sessions nicht.
- **App-CSP** in `src-tauri/tauri.conf.json` bekommt `frame-src http://127.0.0.1:*` dazu (der Port ist erst zur Laufzeit bekannt); sonst bleibt sie unverändert.

**Chat-Eintrag** (`src-tauri/src/agents/event.rs`, `ChatEntry`): neue Variante `Artifact { seq: u32, path: String, file: String }` — `path` ungekürzt wie vom Werkzeug genannt, `file` der Dateiname. In TS `kind: 'artifact'`. Gespeichert wie alle Einträge als JSON, keine Migration.

**Aktualisierung:** keine Ereignisse. Die Oberfläche fragt `artifacts_list` alle 2 s ab, solange eine Session oder Übersicht sichtbar ist; die Vorschau lädt neu, sobald sich `modifiedAt` des gezeigten Artefakts ändert (`?v=` in der Adresse).

## Finale Abnahmekriterien

1. Bittet man den Agenten (Betriebsart Claude, Claude Code + LM Studio und Autark) um einen Bericht als HTML-Seite, legt er sie unter `<Workspace>\.artefakte\` ab, und sie erscheint ohne Klick innerhalb von 2 s im Reiter „Artefakte“.
2. Die Seite läuft mit Skripten und lädt Bibliotheken über https (Beispiel: Chart.js von cdn.jsdelivr.net), aber erreicht weder den Verwalter (keine Befehle, kein `parent`, kein `__TAURI_INTERNALS__`) noch Dateien außerhalb von `.artefakte`.
3. Artefakte gehören dem Vorhaben: jede Session und die Übersicht zeigen dieselbe Liste; ein Eintrag nennt seine Session („diese Session“ bzw. „#N Name“).
4. Der Reiter erscheint erst ab dem ersten Artefakt im Vorhaben; ohne Artefakt springt eine offene Artefakt-Ansicht auf Chat bzw. Übersicht zurück.
5. Speichert der Agent die gezeigte Seite neu, lädt die Vorschau von selbst nach; „Neu laden“, „Vollbild“, „Im Chat besprechen“ (nur in einer Session) und „Im Browser öffnen“ funktionieren.
6. Nach jedem `Write` auf ein Artefakt steht im Chat eine Karte; „In der Session ansehen“ öffnet den Reiter mit genau diesem Artefakt.

## Smoke-Checkliste (Abgleich am Plan-Ende durch den User)

Wackelstellen zuerst:

1. **Abschottung:** [artifacts/sicherheitsprobe.html](artifacts/sicherheitsprobe.html) und [artifacts/probe-bild.svg](artifacts/probe-bild.svg) in den Ordner `.artefakte` eines Test-Vorhabens kopieren, im Reiter öffnen. Jede Zeile der Seite steht auf „wie erwartet“ (grün). Eine rote Zeile → nicht abnehmen.
2. **Selbst nachladen:** im Chat „Mach die Balken im Bericht grün“ → die Vorschau zeigt nach dem Speichern grüne Balken, ohne Klick.
3. **Vollbild:** einen Vortrag mit Folien bauen lassen, Vollbild, in die Folie klicken, Pfeiltasten blättern; Maus an den oberen Rand → „Vollbild beenden“ erscheint, Klick → Fenster wieder normal, App unverändert.
4. Ein Vorhaben ohne Artefakt hat keinen Reiter „Artefakte“; nach dem ersten Artefakt erscheint er mit „1“ in Session-Kopfzeile und Übersicht.
5. Karte im Chat nach dem Schreiben; „In der Session ansehen“ wählt dieses Artefakt aus.
6. „Im Browser öffnen“ öffnet die Datei im Standard-Browser; „Im Chat besprechen“ setzt „Zu Artefakt „Titel“ (Pfad): “ in die Eingabeleiste.
7. Ein Artefakt aus Session #1 zeigt in Session #2 „#1 Name“, in Session #1 „diese Session“.
8. Betriebsart „Claude Code + LM Studio“ und „Autark“: Frage „Wo legst du Artefakte ab?“ nennt den Ordner `.artefakte`.
9. Devtools der App (Entwicklungsmodus), Konsole: `const l = await window.__TAURI_INTERNALS__.invoke('artifacts_list', { sessionId: '<session-id>' }); (await fetch(l.baseUrl + '..%5C..%5Cverwalter.db')).status` → 403 oder 404, nie 200.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
