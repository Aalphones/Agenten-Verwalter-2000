# Phase 1 — Core: Kommentar-Ziel, Prüfung, Text an den Agenten

Lesen: [README.md](README.md) (Kontrakt, Entscheidungen), `src-tauri/src/review/model.rs`, `src-tauri/src/review/mod.rs`, `send` und `comment_folders` in `src-tauri/src/sessions/registry.rs`, `src-tauri/src/sessions/registry/artifacts.rs` (`artifacts_dir`), `src-tauri/src/attachments/mod.rs` (`message_content`, `inline_block`, `take_for_workspace`, `WORKSPACE_FOLDER`), `src-tauri/src/tldr/transcript.rs` (`entry_block`, `line_label`), [docs/conventions/rust.md](../../conventions/rust.md).

## AK der Phase

1. `CommentTarget` und das Feld `target` stehen wie im Kontrakt; ein JSON ohne `target` deserialisiert zu `CommentTarget::Diff`.
2. `review::validate` lehnt ab: Diff wie heute; Artefakt mit leerem `file`/`selector` oder `selector` über 300 Zeichen; Bild mit `width == 0`, `height == 0` oder Rechteck außerhalb von `image_width × image_height`. Fehler wie heute als `CommandError::Internal` mit deutschem Satz.
3. `agent_text` schreibt je Art den Ort aus dem Entwurf, Abschnitt 4: Diff unverändert; Artefakt `Artefakt <artefakte-Ordner>\<file> — Element <selector>` plus Code-Zaun mit `code` (ohne Vorzeichen); Bild `Bild <path> — Bereich x <x>, y <y>, <width> × <height> Pixel (Bild <image_width> × <image_height>)` ohne Code-Zaun. Überschrift nach der Entscheidung im README.
4. `send` legt jedem Bild-Kommentar, dessen `attachment_id` nicht unter den Anhängen dieser Nachricht ist, das Bild als zusätzlichen Anhang **nur** für `message_line` bei; der Chat-Eintrag bleibt wie heute. Liegt der Anhang unter dieser Nachricht, nimmt der Kommentar dessen neuen Pfad nach `take_for_workspace`.
5. Ein Bild-Pfad außerhalb von `<Workspace>\.anhaenge` wird abgelehnt (kanonischer Pfad, Präfixvergleich), statt eine beliebige Datei an den Agenten zu schicken.
6. Die TL;DR-Zeile (`tldr/transcript.rs`) nennt Artefakt-Kommentare als `Kommentar zu Artefakt <file>: <text>` und Bild-Kommentare als `Kommentar zu Bild <name>: <text>`.

## Checkliste

- [ ] `review/model.rs`: `CommentTarget` nach Kontrakt; `ReviewComment` bekommt `#[serde(default)] pub target: CommentTarget` als erstes Feld. In `src-tauri/examples/gen-bindings.rs` `CommentTarget::export_all(&cfg)?` neben `ReviewComment` eintragen; `pnpm bindings`.
- [ ] `review/mod.rs` `validate`: `match &comment.target` mit den drei Fällen aus AK 2. Konstante `MAX_SELECTOR_CHARS: usize = 300`.
- [ ] `review/mod.rs` `agent_text`: Überschrift aus `comments.iter().all(|c| c.target == CommentTarget::Diff)`; `location()` bekommt einen `match` auf `target`. Für Artefakt liefert `folders[i]` den Ordner `.artefakte` (siehe nächster Punkt); fehlt er, steht nur `Artefakt <file>`. Der Code-Zaun (`fence`) entfällt bei Bild-Kommentaren; bei Artefakt-Kommentaren ist `sign` leer.
- [ ] `registry.rs` `comment_folders`: für `CommentTarget::Artifact` `Some(self.artifacts_dir(session_id)?)` (Fehler → `None`), für `Image` `None`, für `Diff` unverändert.
- [ ] `registry.rs` `send`: nach `take_for_workspace` (heute Zeile ~897) die Kommentare in eine veränderliche Kopie `let mut comments = comments.to_vec();` holen; für jedes `Image` mit `attachment_id` unter `sent_attachments` dessen `path` übernehmen. Für alle übrigen Bild-Kommentare neue Funktion `attachments::reattach(path: &Path, workspace: &Path) -> Result<Attachment, CommandError>` (in `attachments/mod.rs`): kanonisiert `path`, prüft Präfix `<kanonischer Workspace>\.anhaenge`, liest Größe und Namen, `kind = Image`, `id = uuid`. Die Zusatz-Anhänge gehen nur in `message_line(&agent_text, &with_extra)`; `push_user` bekommt weiter `sent_attachments` und die angepasste `comments`-Kopie. Mehrere Kommentare auf dasselbe Bild hängen es nur einmal an (nach `path` entdoppeln).
- [ ] `tldr/transcript.rs` `entry_block`: `match` auf `target` nach AK 6.
- [ ] `docs/decisions/035-kommentare-artefakt-bild.md` (Kontext / Optionen / Entscheidung / Konsequenzen): Optionen (a) Bildschirmfoto des Artefakts über WebView2 — verworfen, neue Abhängigkeit und der Agent ändert HTML, nicht Pixel; (b) Skript-Brücke per `postMessage` — gewählt; (c) nur Kommentar zur ganzen Datei — zu grob. Konsequenzen: jede HTML-Antwort des Artefakt-Servers trägt ein angehängtes Skript; Bild-Kommentare können ein früheres Bild erneut an den Agenten schicken.
- [ ] `pnpm check` grün, Commit `feat(review): Kommentar-Ziel Artefakt und Bild im Core`.

## Report-Back
