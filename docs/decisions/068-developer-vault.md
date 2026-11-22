# 068 — Developer Vault: eigener Ordner, wegwerfbarer FTS5-Index, Werkzeuge für Agenten

**Status:** angenommen · **Datum:** 2026-11-22

## Kontext

Gute Lösungen, Snippets, Ideen und Designs sollen über Projekte hinweg wiederverwendbar sein, statt in jeder Session neu gesucht oder gebaut zu werden. Der Benutzer sammelt sie in einem Ordner (Developer Vault), der auch ohne Verwalter als gewöhnliche Dateiablage funktioniert und über ein Laufwerk oder Git synchronisiert werden darf. Agenten sollen darin suchen und gezielt laden, ohne den Ordner als Arbeitsverzeichnis zu bekommen. Andere Wissenssammlungen des Benutzers bleiben getrennt: der Verwalter liest und indexiert nur den eingestellten Ordner.

## Optionen

- **Ablage des Index:** (a) Tabellen in `verwalter.db` — verworfen: eine Migration für Daten, die jederzeit aus den Dateien neu entstehen, und ein langer Abgleich hielte die Sperre der Hauptdatenbank; (b) eigene Datei `<Datenordner>\vault\index.db` — gewählt: darf gelöscht werden, Schemawechsel = Neuaufbau, keine Migration; (c) Index im Vault-Ordner — verworfen: würde mitsynchronisiert, kollidiert zwischen zwei Rechnern.
- **Änderungen erkennen:** (a) Dateisystem-Watcher (`notify`) plus Startabgleich — verworfen für Version 1: neue Abhängigkeit, Ereignisse auf Cloud-Laufwerken unzuverlässig, Abgleich trotzdem nötig; (b) Abgleich beim Start, auf Knopfdruck, nach Änderung der Einstellung und vor einer Suche, wenn der letzte älter als 30 s ist — gewählt: Größe und Änderungszeit entscheiden, ob gelesen wird, der Hash, ob neu zerlegt wird.
- **Suche:** (a) linear wie die Archiv-Suche (ADR 029) — verworfen: der Vault wächst über Jahre; (b) SQLite FTS5 (im gebündelten SQLite eingeschaltet), Zerleger `unicode61` mit Wortanfang-Suche — gewählt; (c) zusätzlich `trigram` für Wortteile — zurückgestellt, bis die Nutzung den Bedarf zeigt.
- **Metadaten:** (a) Pflichtschema je Eintrag — verworfen: behindert das Ablegen; (b) alles optional, aus Frontmatter bzw. `manifest.yaml`, sonst aus Inhalt und Namen abgeleitet — gewählt. Ein Ordner mit `manifest.yaml` ist ein Eintrag (Artefakt); ein eigener Leser für einfaches YAML, weil der Frontmatter-Leser der Skills keine Listen kennt und unverändert bleiben soll.
- **Zugang für Agenten:** über den MCP-Zugang (ADR 046) als Satz `vault_` mit `vault_search` und `vault_get`, angeboten nur bei eingeschaltetem Vault. `vault_get` gibt nur eingelesene Dateien heraus — was `.gitignore`, `.vaultignore` oder ein führender Punkt ausschließt, bleibt draußen.

## Entscheidung

Eigene Index-Datei mit Tabellen `files`, `artifacts`, `sections` und `sections_fts`; Abgleich ohne Watcher; FTS5 mit `unicode61`; optionale Metadaten; zwei Werkzeuge für Agenten; ein Suchdialog für den Benutzer (`Strg+K`); die erste Nachricht einer Station nennt bis zu drei passende Treffer. Der Verwalter schreibt nur beim Grundgerüst in den Vault-Ordner, und nur in einen leeren.

## Konsequenzen

- Ohne Vault-Ordner oder ausgeschaltet ändert sich am Verwalter nichts; kein Thread liest Dateien.
- Zusammengesetzte deutsche Wörter werden nur über ihren Anfang gefunden („Lade“ findet „Ladebalken“, „Balken“ nicht).
- Auf einem Laufwerk, das Dateien nur online hält, lädt der erste Abgleich jede Datei herunter.
- Der Index ist pro Rechner; zwei Rechner mit demselben Vault bauen je ihren eigenen.
- `ToolResult` des MCP-Zugangs kennt jetzt auch ein Bild (`vault_get` auf Bilddateien).
- Semantische Suche (lokales ONNX-Modell) baut auf `sections` auf und ist ein eigener Plan.
