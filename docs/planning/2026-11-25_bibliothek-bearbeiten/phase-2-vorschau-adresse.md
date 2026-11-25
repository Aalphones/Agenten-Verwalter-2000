# Phase 2 — Kern: Vorschau-Adresse der Bibliothek

**Rating:** standard · baut auf Phase 1 (`vault::edit::path_allowed`)

## Kontext (lesen vor dem ersten Edit)

- `README.md` dieses Plans (Kontrakt: `vault_preview_url`).
- `docs/decisions/026-artefakte.md` (warum ein eigener Server auf `127.0.0.1` statt eines Tauri-Protokolls).
- `src-tauri/src/artifacts/server.rs` — `ArtifactServer::base_url`, `Connection::answer` (Aufteilung `<token>/<session>/<pfad>`, `?view=1`, `?list=1`, `with_bridge`, `artifact_csp`, `content_type`).
- `src-tauri/src/artifacts/mod.rs` — `kind_of`; `src-tauri/src/artifacts/viewers/mod.rs` — `render`.
- `src-tauri/src/vault/edit.rs` (Phase 1) — `path_allowed`; `src-tauri/src/vault/mod.rs` — `status`.
- Wo die App den Server als State hält: in `src-tauri/src/lib.rs` nach `artifacts::server::start` suchen; Muster für einen Befehl, der `base_url` liest: in `src-tauri/src/commands/artifacts.rs` nach `base_url` suchen.

## AK der Phase

1. Adresse `http://127.0.0.1:<port>/<token>/bibliothek/<pfad>` liefert die Datei `<pfad>` der Bibliothek, wenn `vault::edit::path_allowed` sie zulässt und sie eine Datei ist; sonst 404 (Datei fehlt) bzw. 403 (nicht erlaubt). Der Name `bibliothek` kollidiert nicht mit Session-IDs (UUIDs).
2. `?view=1` liefert wie bei Artefakten den Betrachter nach `kind_of` (Bild, PDF, Markdown, Text …); `?list=1` und Ordner-Ziele gibt es im Bibliotheks-Bereich nicht (404).
3. HTML bekommt `with_bridge` (Speicher-Ersatz und Brücke) wie Artefakte; CSP mit dem Bereich `http://127.0.0.1:<port>/<token>/bibliothek/` als `scope` (`artifact_csp`), damit relative CSS-, JS- und Bild-Verweise derselben Bibliothek laden, aber keine Session-Ordner.
4. `ArtifactServer::library_base_url()` gibt `<origin>/<token>/bibliothek/` zurück; Befehl `vault_preview_url(path)` prüft `path_allowed` und gibt `library_base_url() + <pfad prozentkodiert je Segment>` zurück (Segmente einzeln mit `percent_encode`, `/` bleibt).
5. Wrapper `vaultPreviewUrl(path)` in `src/lib/vault.ts`.

## Checkliste

- [ ] `server.rs`: Konstante `LIBRARY_SCOPE: &str = "bibliothek"`; in `answer` nach dem Dekodieren von `session_part` verzweigen, bevor die Session-Registry gefragt wird; eigene Methode `answer_library(&self, relative: &str, wants_viewer: bool) -> Reply`. Wurzel und Layout aus `crate::vault::status(&self.app)` (nur `VaultState::Ready` mit `dir`, sonst 404); Layout über `vault::library::layout(&root)`.
- [ ] `library_base_url` an `ArtifactServer`.
- [ ] Befehl `vault_preview_url` in `commands/vault.rs`, registrieren, `pnpm bindings`, Wrapper.
- [ ] Prüfen per Prüfprogramm ohne App geht hier nicht (Server braucht die App) — stattdessen in Phase 3 in der laufenden App; im Report-Back vermerken.
- [ ] `docs/code-map.md`: Zeile „Artefakte“/„MCP-Zugang“ nicht anfassen; Zeile „Bibliothek“ um „Vorschau über den Artefakt-Server (`/bibliothek/`)“ ergänzen.
- [ ] `pnpm check` grün.

## Report-Back
