# Plan: Bibliothek ansehen und bearbeiten

**Stand:** 2026-11-25 · **ADR:** 072 (neu, Phase 1) · **Migration:** keine · **Entwurf:** [artifacts/entwurf-bibliothek-bearbeiten.html](artifacts/entwurf-bibliothek-bearbeiten.html) (verbindlich, siehe [artifacts/README.md](artifacts/README.md))

Der Knopf „Bibliothek“ der Seitenleiste öffnet einen eigenen Bereich im Hauptfenster: links der Baum der Bibliothek (Gruppen wie im Suchdialog, darunter jeder Skill- und Wissensordner mit allen Dateien), rechts die Datei mit Editor (CodeMirror 6) bzw. Vorschau. Speichern prüft auf fremde Änderungen, schreibt atomar, zieht den Suchindex nach und spiegelt Skills, Befehle, Ausgabestile und `CLAUDE.md` sofort nach `~\.claude`. Neue Dateien lassen sich in vorhandenen Ordnern anlegen, jede Datei lässt sich löschen (Papierkorb des Verwalters, Rückgängig). Das Suchfeld des Bereichs findet Namen und Inhalte; Ctrl K springt aus jeder Ansicht hinein. Der bisherige Suchdialog entfällt.

## Phasen

| Nr | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Kern: Baum, Lesen, Schreiben, Spiegeln | [phase-1-kern-lesen-schreiben.md](phase-1-kern-lesen-schreiben.md) | heikel | pending |
| 2 | Kern: Vorschau-Adresse der Bibliothek | [phase-2-vorschau-adresse.md](phase-2-vorschau-adresse.md) | standard | pending |
| 3 | Oberfläche: Bereich, Baum, Übersicht, Ansicht | [phase-3-bereich-und-baum.md](phase-3-bereich-und-baum.md) | standard | pending |
| 4 | Oberfläche: Editor, Speichern, Entwürfe | [phase-4-editor.md](phase-4-editor.md) | heikel | pending |
| 5 | Oberfläche: Neue Datei und Löschen | [phase-5-neue-datei-und-loeschen.md](phase-5-neue-datei-und-loeschen.md) | standard | pending |
| 6 | Suchdialog entfernen, Ctrl K umstellen | [phase-6-suchdialog-entfernen.md](phase-6-suchdialog-entfernen.md) | mechanisch | pending |

## Kontrakt (Tauri-Grenze)

Alle Pfade relativ zur Bibliothek, Trenner `/`, ohne führenden oder folgenden Trenner. Typen in `src-tauri/src/vault/model.rs`, Bindings per `pnpm bindings`.

| Befehl | Eingabe | Rückgabe | Fehler |
|---|---|---|---|
| `vault_tree` | — | `VaultTree` | `internal` (Bibliothek nicht bereit) |
| `vault_read_text` | `path: String` | `VaultText` | `internal` mit Satz (außerhalb, nicht erlaubt, zu groß, keine Textdatei), `io` |
| `vault_write_text` | `request: VaultWrite` | `VaultWriteOutcome` | `internal` mit Satz (außerhalb, nicht erlaubt, Typ nicht bearbeitbar, Ordner fehlt), `io` |
| `vault_delete_file` | `path: String` | `VaultDeleted` | `internal` mit Satz (außerhalb, nicht erlaubt, fehlt), `io` |
| `vault_restore_file` | `trash_id: String` | `VaultRestoreOutcome` | `internal` (Eintrag fehlt), `io` |
| `vault_preview_url` | `path: String` | `String` (Adresse im Artefakt-Server, Phase 2) | `internal` |

```rust
pub struct VaultTree { pub layout: VaultLayout, pub artifacts: Vec<VaultTreeArtifact> }
pub struct VaultTreeArtifact {
    pub path: String, pub title: String, pub description: String, pub kind: String,
    pub group: String, pub subgroup: String,
    /// true: Ordner-Artefakt (Skill-Ordner, Ordner mit manifest.yaml), sonst eine einzelne Datei.
    pub is_folder: bool,
    pub files: Vec<VaultTreeFile>,
}
pub struct VaultTreeFile { pub path: String, pub size: i64, pub modified_ms: i64, pub editable: bool }
pub enum LineEnding { Lf, Crlf }
pub struct VaultText { pub path: String, pub text: String, pub hash: String, pub modified_ms: i64, pub line_ending: LineEnding, pub bom: bool }
pub struct VaultWrite {
    pub path: String, pub text: String,
    /// None: Datei neu anlegen (darf nicht existieren). Some: Hash beim Öffnen.
    pub expected_hash: Option<String>,
    /// true: fremde Änderung überschreiben („Meine Fassung speichern“).
    pub force: bool,
    pub line_ending: LineEnding, pub bom: bool,
}
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum VaultWriteOutcome {
    Saved { hash: String, modified_ms: i64, size: i64, mirror: VaultMirror, environment: Option<EnvironmentStatus> },
    /// Auf der Platte liegt nicht mehr der Stand von `expected_hash`.
    Changed { modified_ms: i64 },
    /// Neu anlegen, aber die Datei gibt es schon.
    Exists,
}
#[serde(tag = "state", rename_all = "camelCase")]
pub enum VaultMirror { NotMirrored, Mirrored, Pending { reason: String }, Failed { message: String } }
pub struct VaultDeleted { pub path: String, pub trash_id: String, pub mirror_copy: MirrorCopy }
#[serde(tag = "state", rename_all = "camelCase")]
pub enum MirrorCopy { NotMirrored, Removed, Kept { reason: String } }
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum VaultRestoreOutcome {
    Restored { path: String, mirror: VaultMirror, environment: Option<EnvironmentStatus> },
    /// Am alten Ort liegt inzwischen wieder eine Datei; nichts überschrieben.
    Exists { path: String },
}
```

## Finale AK

1. Der Knopf „Bibliothek“ der Seitenleiste und Ctrl K aus jeder Ansicht öffnen den Bereich im Hauptfenster (markiert wie „Einstellungen“); Ctrl K setzt den Fokus ins Suchfeld. Den Suchdialog gibt es nicht mehr.
2. Der Baum zeigt genau die Dateien, die der Suchindex der Bibliothek kennt, gegliedert wie der Suchdialog; jeder Skill-Ordner und jeder Ordner mit `manifest.yaml` klappt in seine Unterordner und Dateien auf.
3. Jede Textdatei bis 2 MiB mit einer der Endungen aus Phase 1 lässt sich bearbeiten und mit Strg S oder „Speichern“ speichern; Bild und PDF zeigt der Bereich nur an, alles andere bekommt „Extern öffnen“.
4. Wurde die Datei seit dem Öffnen woanders geändert, speichert der Verwalter nicht still, sondern fragt (Abbrechen · Neu laden · Meine Fassung speichern).
5. Nach dem Speichern einer Datei in einem Skill-Ordner, eines Befehls, eines Ausgabestils oder von `CLAUDE.md` liegt die neue Fassung in `~\.claude`; die Zeile unter dem Kopf sagt „gespiegelt“ oder warum nicht.
6. Zeilenenden und BOM einer Datei bleiben beim Speichern unverändert.
7. Ungespeicherte Änderungen überleben Wechsel in andere Ansichten und einen Neustart der App; die Seitenleiste zeigt einen Punkt am Knopf „Bibliothek“.
8. Markdown hat Bearbeiten/Vorschau; die HTML-Vorschau lädt CSS, JS und Bilder aus ihrem Ordner.
9. In einem Ordner des Baums lässt sich eine neue Datei mit erlaubter Endung anlegen; sie öffnet sich danach im Editor.
10. Jede Datei des Baums lässt sich ohne Rückfrage löschen und mit „Rückgängig“ zurückholen; sie liegt 30 Tage im Papierkorb des Verwalters. Eine gespiegelte Kopie in `~\.claude` mit gleichem Inhalt wird mit entfernt und beim Zurückholen wieder gespiegelt.
11. Das Suchfeld findet Dateien nach Name (ab 1 Zeichen) und Inhalt (ab 3 Zeichen, Suchindex); Öffnen eines Inhaltstreffers springt zur Fundstelle.
12. Der Verwalter schreibt und löscht nie außerhalb der Erlaubnisliste der Bibliothek, nie in eine Datei, die `.vaultignore` oder `.gitignore` der Bibliothek ausschließt, und nie in einen Pfad mit `..` oder über eine Verknüpfung nach draußen.

## Von mir gesetzt

- **Ort des Bereichs:** Hauptfenster wie „Einstellungen“ (Flag `showLibrary` im Sessions-Store). Der Suchdialog entfällt (Entscheidung des Benutzers 2026-11-25); seine Aufgaben übernimmt der Bereich (Phase 6 listet sie).
- **Modul- und Ordnernamen bleiben `vault`** (ADR 069): Kern `src-tauri/src/vault/edit.rs`, Oberfläche in `src/features/vault/`, Store `src/stores/library.ts`.
- **Baum aus dem Index, nicht von der Platte:** dieselbe Erlaubnisliste wie Suche und Agenten-Werkzeuge; eine extern angelegte Datei erscheint nach dem nächsten Abgleich (`vault://changed`).
- **Schreibprüfung ohne Index:** Regeln statt Index-Zeile, damit eine gerade angelegte Datei vor dem nächsten Abgleich speicherbar ist.
- **Atomar schreiben:** Temp-Datei mit Punkt am Anfang im selben Ordner, dann `fs::rename` (ersetzt unter Windows); Punkt-Dateien liest der Abgleich nicht.
- **Spiegeln nach jedem Speichern einer gespiegelten Datei** über `environment::run_mirror` — kopiert wie der Knopf „Spiegeln“ alles, was in der Bibliothek neuer ist.
- **Entwürfe in `localStorage`** (Schlüssel `verwalter.library.drafts`) samt Hash beim Öffnen; beim Speichern greift dieselbe Konfliktprüfung.
- **Rückmeldung nach dem Speichern in der Meta-Zeile**, kein Toast (die App hat keinen).
- **HTML-Vorschau zeigt den gespeicherten Stand** (der Server liest von der Platte); Markdown-Vorschau rendert den aktuellen Text mit `src/components/Markdown.tsx`.
- **Löschen** (Entscheidung des Benutzers 2026-11-25) nur für Dateien, nicht für Ordner; ohne Rückfrage, mit Rückgängig (Entwurfsregel des Benutzers). Papierkorb `%USERPROFILE%\.verwalter\bibliothek-papierkorb\` (außerhalb von Bibliothek und Google Drive, nicht im Git der Bibliothek), Einträge älter als 30 Tage räumt der Start der App weg.
- **Gespiegelte Kopie geht mit:** Löschen entfernt die Kopie in `~\.claude`, wenn sie denselben Inhalt hat — sonst bliebe ein gelöschter Skill für Agenten aktiv, weil der Abgleich nie löscht. Weicht sie ab, bleibt sie und der Bereich sagt es.
- **Kein Umbenennen**; dafür „Im Ordner zeigen“.
- **Suchfeld statt Suchdialog:** Name im Frontend, Inhalt über die vorhandene Suche (`findInVault`); Treffer erscheinen im Baum, keine eigene Trefferliste.
- **Keine Tabs:** eine Datei zur Zeit; Entwürfe anderer Dateien bleiben trotzdem erhalten.
- **Ctrl K** öffnet den Bereich mit Fokus im Suchfeld (bisher Suchdialog); Strg P bleibt die Dateisuche der Dateien-Ansicht.

## Konfidenz

- 🟡 **CodeMirror-Versionen und gemeinsame Pakete:** `@codemirror/language` und `@lezer/highlight` müssen genau einmal im Bundle liegen, sonst greifen Syntaxfarben nicht (im Entwurf nachgestellt). Check in Phase 4: `pnpm why @codemirror/language @codemirror/state @lezer/highlight` zeigt je Paket eine Version.
- 🟡 **`fs::rename` auf dem Google-Drive-Laufwerk:** Ersetzen per Rename ist unter Windows dokumentiert, auf einem Drive-Laufwerk nicht erprobt. Check in Phase 1: `vault-probe write` zweimal gegen eine Datei in `G:\…\_vault\inbox\` und danach Inhalt, Änderungszeit und Drive-Sync-Zustand ansehen.
- 🟡 **Ignorier-Regeln beim Schreiben:** geprüft werden nur `.gitignore` und `.vaultignore` der Wurzel; eine tiefer liegende `.gitignore` ignoriert der Abgleich, die Schreibprüfung nicht. Folge: Datei wird gespeichert, erscheint aber nicht im Baum. Geprüft am 2026-11-25: in `skills/`, `commands/`, `output-styles/`, `memory/` und `_vault/` liegt keine `.gitignore` oder `.vaultignore`; heute also ohne Wirkung.

Fehlerklassen geprüft: `sprachen/typescript` und `frameworks/react` — keine einschlägig (beide betreffen Tests bzw. HTTP); für Rust, Tauri und CodeMirror gibt es keinen Eintrag.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
