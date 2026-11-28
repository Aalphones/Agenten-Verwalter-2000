# Phase 3 — Core: Haiku erklärt den Diff

Status: complete · Rating: standard · Modell: sonnet

## Kontext

Lesen vor dem ersten Edit:

- `README.md` dieses Plans (Kontrakt: Notiz von Haiku), Report-Back der Phasen 1 und 2, ADR 075.
- `src-tauri/src/report/tidy.rs` — `TIDY_SYSTEM`, `TIDY_SCHEMA`, `TidyAnswer`, `haiku_input`, `check`, `tidy_markdown`.
- `src-tauri/src/report/mod.rs` — `tidy_phase`, `haiku_input_of`.
- `src-tauri/src/report/assemble.rs` — `derived_stops` (Phase 2), `phase_of`, `ReportNote`-Bau in `note_of`.
- `src-tauri/src/report/range.rs` — `file_patches`.
- `src-tauri/src/retro/tools.rs` — `cut_middle`.
- Entwurf: `artifacts/bericht-ohne-eintraege.html`, Zustand „Geordnet“ — Randnotiz „Haiku · aus dem Diff“ am ersten Code-Block eines Stopps aus dem Diff.
- Fehlerklassen (Vault): keine einschlägig (kein Git-Schreiben, keine Oberfläche).

## AK der Phase

1. Die Haiku-Eingabe hat einen Abschnitt `## Ohne Erklärung` mit einer Zeile je Stopp aus dem Diff (`d1`, `d2` … in Stopp-Reihenfolge) und darunter je Datei Kopf und Patch; ein Patch höchstens 3 000 Zeichen, der ganze Abschnitt höchstens 20 000 Zeichen (`cut_middle`); Dateien mit `omittedRows > 0` stehen nur mit Kopfzeile drin.
2. Haikus Antwort darf `explain: [{ id, text }]` enthalten (`id` aus `d1…`, `text` höchstens 300 Zeichen); `check` verwirft unbekannte und doppelte IDs; fehlende IDs sind erlaubt.
3. Gespeichert wird in `tidy_json` zusätzlich `explain_stops: [{ id, group }]` (vom Core, nicht von Haiku), damit die Zuordnung beim späteren Laden stabil bleibt.
4. Beim Laden trägt der erste Code-Block jedes Stopps aus dem Diff, dessen Gruppe eine Erklärung hat, eine `ReportNote` mit `entry: None`, `label: "H"`, `kind: Why`, `by: "Haiku · aus dem Diff"`, `from`/`to` = erste und letzte neue Zeilennummer der hinzugefügten Zeilen des Blocks (ohne hinzugefügte Zeile: `1`/`1`), `open: None`, `moved: false`.
5. Hat eine Phase weder zu ordnende Einträge noch Spur, aber Stopps aus dem Diff, ruft `tidy_phase` Haiku trotzdem (Bedingung aus Phase 1 um „und keine Stopps aus dem Diff“ erweitert).
6. `report-probe <Kopie> 73cb952b-6cdf-4e41-bae2-a3300187e377 tidy 2 --haiku` (deren Phase 2, Station #14) liefert eine Antwort mit mindestens einer Erklärung und `Prüfung ok`.
7. `powershell -File scripts/check.ps1` endet mit `exit 0`.

## Checkliste

- [x] `tidy.rs`: `TidyAnswer` um `#[serde(default)] pub explain: Vec<TidyExplain>` und `#[serde(default)] pub explain_stops: Vec<ExplainStop>` erweitern (`TidyExplain { id: String, text: String }`, `ExplainStop { id: String, group: String }`).
- [x] `TIDY_SCHEMA`: Eigenschaft `"explain":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["id","text"],"properties":{"id":{"type":"string","pattern":"^d[0-9]+$"},"text":{"type":"string","maxLength":300}}}}` — nicht in `required`; `explain_stops` steht **nicht** im Schema.
- [x] `TIDY_SYSTEM` ergänzen: „explain: für jede ID aus „Ohne Erklärung“ höchstens zwei Sätze, was die Änderungen dieses Repositorys bewirken und warum, gestützt auf Patch und Spur; nichts erfinden, was dort nicht steht.“
- [x] `haiku_input` bekommt einen vierten Parameter `unexplained: &str` und hängt ihn als `## Ohne Erklärung` vor `## Spur` an (leer → Abschnitt entfällt).
- [x] `report/mod.rs`: in `tidy_phase` die Stopps aus dem Diff der Phase ermitteln — dafür in `assemble.rs` eine öffentliche Funktion `derived_files_of_phase(view, index, entries, ctx, catalog) -> Vec<(String /*group*/, String /*label*/, Vec<(RepoRange-Index, FileStat)>)>`, die dieselbe Auswahl trifft wie `derived_stops` (eine Quelle für beide: `derived_stops` ruft sie). Patches über `range::file_patches`. IDs `d1…` in Reihenfolge der Gruppen; `explain_stops` vor dem Speichern in die Antwort setzen.
- [x] `check(answer, to_order, explain_ids: &[String])`: unbekannte oder doppelte `explain`-IDs → `Err("dN unbekannt"/"dN doppelt")`.
- [x] `assemble.rs`: nach `derived_stops` je Stopp die Erklärung über `answer.explain_stops` (Gruppe → ID) und `answer.explain` (ID → Text) suchen und die Notiz nach AK 4 an den ersten Code-Block hängen.
- [x] `tidy_markdown`: Erklärungen als Zeilen `Erklärung <Label>: <Text>` unter das Ergebnis.
- [x] `report-probe tidy`: druckt den Abschnitt „Ohne Erklärung“ der Eingabe und die `explain`-Zeilen der Antwort.
- [x] Probe nach AK 6 gegen eine Kopie (`scripts/db-copy.ps1`); Ausgabe gekürzt in den Report-Back.
- [x] `scripts/check.ps1` grün; Commit mit einzeln genannten Dateien.

## Report-Back

Alle AK am Code abgeglichen; `scripts/check.ps1` endet mit `exit 0`.

**Probe** (DB-Kopie, Umsetzung `73cb952b-…`, `tidy 2 --haiku`): Abschnitt „Ohne Erklärung“ 19 710 Zeichen, `d1 · Agenten-Verwalter-2000`, `d2 · facepass`, `d3 · U104_Agents`; Antwort mit drei Erklärungen, Prüfung bestanden. Das `tidy_json` in die Kopie geschrieben, danach `view`: je Stopp aus dem Diff genau eine Notiz `(H) Why … Haiku · aus dem Diff` am ersten Block (AK 3, 4).

**Abweichungen von der Checkliste:**

- Der Abschnitt wird je Stopp gekürzt (Anteil an 20 000 Zeichen, kurze Stopps zuerst), nicht als Ganzes: in der ersten Probe fiel mit dem Schnitt über alles die Überschrift von `d2` weg, und Haiku schrieb die facepass-Änderungen `d1` zu.
- Statt `derived_files_of_phase` gibt es `unexplained_of_phase` (liefert `Vec<tidy::Unexplained>` samt Patchs, nimmt die fertigen Bereiche); die gemeinsame Auswahl mit `derived_stops` ist `unshown_files`.
- Die Notiz entsteht in `derived_stops` selbst, dort ist die Gruppe des Stopps bekannt.
- `TidyAnswer::explanation_of` überspringt leere Texte. Der Satz in `TIDY_SYSTEM` zu leerem „Zu ordnen“ nennt jetzt Spur und „Ohne Erklärung“.
- `report-probe tidy --haiku` druckt zusätzlich das zu speichernde `tidy_json`.

**Grenzen:** Die Patchs gehen ungefiltert an das Ordnungs-Modell. Gekürzte Patchs können Dateien aus Haikus Sicht verdecken (in der zweiten Probe nannte eine Etappe fehlende Patchs). Ordnen liest jetzt zusätzlich die Git-Bereiche der Phase. Nicht in der laufenden App gelaufen.
