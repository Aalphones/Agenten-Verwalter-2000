// Inhalt des Beispiel-Berichts: die echte Umsetzung „Session-Dateien“ (ADR 071, v0.71.0).
// Echt: Commits, Zeiten, Zeilenzahlen, Code, Screenshots, Risiken (STATE.md, FINDINGS.md).
// Beispiel: Stationsnummern #8–#13, die Station „Abnahme“, die Texte des Agenten.

window.REPORT = {
  umsetzung: 'Session-Dateien',
  // Ziel: wörtlich aus dem Plan (docs/planning/…/README.md) — kostet keine Tokens.
  summary: [
    'Im Reiter „Dateien“ steht unter den Repositories ein Knoten <b>„Session-Dateien“</b>. Er zeigt je Session des Vorhabens (auch Stationen einer Umsetzung) die Dateien in ihren beiden Scratchpads, die Dateien außerhalb der Repositories, die sie geschrieben hat, und jede Datei, die sie im Chat verlinkt hat.',
  ],
  kpi: [
    ['Phasen', '5', 'von 5'],
    ['Stopps', '7', 'beim Schreiben angelegt'],
    ['Commits', '6', 'aus Git'],
    ['Dateien', '104', 'aus Git'],
    ['Zeilen', '+4.681 −608', 'aus Git'],
  ],
  map: `flowchart TD
  A["Antwort im Chat"] -->|"Pfad erkannt"| L[("session_links")]
  W["Write / Edit des Agenten"] --> F[("session_files")]
  S["Scratchpads"] --> G
  L --> G{"Grenze"}
  F --> G
  G -->|"erlaubt"| B["Betrachter-Adresse"]
  G -->|"erlaubt"| K["Knoten im Dateibaum"]
  B --> D["Datei-Ansicht"]
  K --> D
  D --> X{"Sperre für Skripte"}
  click L call goStop("s1-tabelle")
  click G call goStop("s2-grenze")
  click B call goStop("s3-range")
  click K call goStop("s4-knoten")
  click D call goStop("s5-sperre")
  click X call goStop("s2-sperre")`,
  risks: [
    'Oberfläche nur in Vite-Prüfseiten gesehen, nicht in der echten App.',
    'VS Code, Im Dateisystem anzeigen, Standardprogramm und Spulen im Video in der echten App ungeprüft.',
    'Liste lädt kalt 1,2–1,5 s; die Oberfläche zeigt dafür einen Ladezustand.',
  ],
  chapters: [
    {
      key: '1', title: 'Verweise im Chat erfassen', station: '#8', phase: 'Phase 1 · Umsetzung', time: '25.11. 18:22', commits: ['10a353f'], files: 17, lines: '+374 −20',
      text: 'Jeder absolute Pfad in einer Antwort landet in einer neuen Tabelle; der Scratchpad der Kommandozeile wird gespeichert.',
      stops: ['s1-tabelle'],
      checks: { by: '#14 Review', src: 'junit.xml · lcov.info · mutants/outcomes.json', chain: true, tests: [12, 0, 0], cov: [92, '22 von 24'], mut: [83, 10, 2] },
      journey: [
        { t: 'Tabelle für Verweise angelegt, ein Pfad je Session mit erstem und letztem Auftauchen.', files: ['022_session_links.sql', 'session_links.rs'], stop: 's1-tabelle' },
        { t: 'Pfade aus Antworten gezogen: Inline-Code und Ziele von Markdown-Links.', files: ['links.rs'] },
        { t: 'Erst auch relative Pfade erfasst; zu viele Fehltreffer, deshalb nur noch absolute.', files: ['links.rs'], detour: true },
        { t: 'Scratchpad der Kommandozeile gespeichert statt nur im Speicher gehalten.', files: ['sessions.rs', 'registry.rs'] },
      ],
      review: { by: '#14', items: [] },
    },
    {
      key: '2', title: 'Liste, Grenze und Sperre', station: '#9', phase: 'Phase 2 · Umsetzung', time: '25.11. 19:01', commits: ['35ab05f'], files: 39, lines: '+1.440 −114',
      text: 'Der Core listet, liest und öffnet Session-Dateien, nur innerhalb einer klaren Grenze; ausführbare Dateien sind gesperrt.',
      stops: ['s2-grenze', 's2-sperre'],
      checks: { by: '#14 Review', src: 'junit.xml · lcov.info · mutants/outcomes.json', chain: true, tests: [41, 0, 2], cov: [87, '61 von 70'], mut: [71, 17, 7] },
      journey: [
        { t: 'Typen für Datei, Gruppe und Herkunft festgelegt und an die Oberfläche durchgereicht.', files: ['model.rs', 'SessionFile.ts'] },
        { t: 'Scan über Scratchpad, Kommandozeilen-Scratchpad und erfasste Verweise.', files: ['scan.rs'] },
        { t: 'Grenze gezogen: gezeigt wird nur, was die Session genannt oder selbst angelegt hat.', files: ['access.rs'], stop: 's2-grenze' },
        { t: 'Sperre zuerst über die Dateiendung von Rust; „x.bat.“ rutschte durch, jetzt zählt der Name nach dem letzten Punkt.', files: ['file_links/mod.rs'], stop: 's2-sperre', detour: true },
        { t: 'Prüfprogramm gegen echte Pfade auf diesem Rechner geschrieben.', files: ['session-files-probe.rs'] },
      ],
      review: {
        by: '#14',
        diagram: {
          caption: 'Weg eines Pfads bis zum Standardprogramm',
          code: `flowchart LR
  A[Pfad aus Chat oder Liste]
  X[abgelehnt]
  E[öffnen]
- R{im Repository?}
- A --> R
- R -- nein --> X
- R -- ja --> E
+ B{genannt oder<br/>selbst angelegt?}
+ A --> B
+ B -- nein --> X
+ B -- ja --> C[echter Pfad<br/>hinter Verknüpfung]
+ C --> D{ausführbar?<br/>genannt oder echt}
+ D -- ja --> Y[gesperrt]
+ D -- nein --> E
+ click B call goStop("s2-grenze")
+ click D call goStop("s2-sperre")`,
        },
        items: [
          { status: 'offen', text: 'Die Meldung der Sperre nennt den Pfad nicht; wer zwei Dateien öffnet, weiß nicht, welche gesperrt war.', where: 'file_links/mod.rs:224', stop: 's2-sperre' },
          { status: 'behoben', text: 'Eine Verknüpfung im Scratchpad konnte aus der Grenze hinauszeigen.', where: 'access.rs:34', stop: 's2-grenze' },
          { status: 'behoben', text: '„.cmd“ fehlte in der Liste gesperrter Endungen.', where: 'file_links/mod.rs:12' },
        ],
      },
    },
    {
      key: '3', title: 'Betrachter-Adresse', station: '#10', phase: 'Phase 3 · Umsetzung', time: '26.11. 07:53', commits: ['0197ce8', 'a0116ae'], files: 25, lines: '+404 −118',
      text: 'Einzelne Dateien bekommen eine Adresse im Artefakt-Server, mit Range für Video und Ton.',
      stops: ['s3-range'],
      checks: { by: '#14 Review', src: 'junit.xml · lcov.info · mutants/outcomes.json', chain: true, tests: [18, 0, 0], cov: [76, '84 von 110'], mut: [64, 23, 13] },
      journey: [
        { t: 'Handle mit kanonischem Pfad: ausgeliefert wird nur, solange dort dieselbe Datei liegt.', files: ['handles.rs'] },
        { t: 'Artefakt-Server liefert geprüfte Dateien unter dem Handle mit eigenem CSP-Bereich.', files: ['server.rs'] },
        { t: 'Range-Anfragen für Video und Ton, damit Spulen geht.', files: ['server.rs'], stop: 's3-range' },
        { t: 'Rückfall auf Rohtext an eine Stelle gezogen; die alte Funktion hatte keinen Aufrufer mehr.', files: ['common.js'] },
      ],
      review: {
        by: '#14',
        items: [
          { status: 'offen', text: 'Jede Range-Anfrage liest die ganze Datei in den Speicher; bei großen Videos teuer.', where: 'server.rs:319', stop: 's3-range' },
          { status: 'behoben', text: 'viewer.showRaw() zeigte den Dateitext, ohne den Status der Antwort zu prüfen.', where: 'common.js:20' },
        ],
      },
    },
    {
      key: '4', title: 'Knoten im Dateibaum', station: '#11', phase: 'Phase 4 · Umsetzung', time: '26.11. 09:25', commits: ['27297d5'], files: 26, lines: '+1.404 −165',
      text: 'Der Knoten „Session-Dateien“ steht im Baum; Dateilinks im Chat springen dorthin.',
      stops: ['s4-knoten'],
      checks: { by: '#11 Umsetzung', src: 'pnpm check', chain: true },
      journey: [
        { t: 'Knoten „Session-Dateien“ unter den Repositories, gegliedert nach Orten und Ordnern.', files: ['SessionFilesNode.tsx'] },
        { t: 'Datei öffnet rechts als Text mit „← Übersicht“ und Pfadkette.', files: ['SessionFileViewer.tsx'], stop: 's4-knoten' },
        { t: 'Liste flackerte beim Neuladen; jetzt bleibt die alte stehen, bis die neue da ist.', files: ['SessionFilesNode.tsx'], detour: true },
        { t: 'Dateilinks im Chat springen an die Datei im Baum.', files: ['openFromLink.ts'] },
      ],
    },
    {
      key: '5', title: 'Datei-Ansicht', station: '#12', phase: 'Phase 5 · Umsetzung', time: '26.11. 10:19', commits: ['d58b04a'], files: 32, lines: '+1.059 −191',
      text: 'Jede Datei zeigt sich passend zu ihrem Typ, mit vier Knöpfen; Skripte sperren das Standardprogramm.',
      stops: ['s5-sperre', 's5-schmal'],
      checks: { by: '#12 Umsetzung', src: 'pnpm check', chain: true },
      // Sichtabnahme: je Bildschirm ein Aufruf report_screen. Fotos aus der Prüfung von Phase 5 (echt), Entwurfsbilder aus dem freigegebenen Entwurf der Session-Dateien (echt).
      screens: [
        {
          id: 'sc5-sperre', name: 'Gesperrtes Standardprogramm', by: ['#12', 'Umsetzung'],
          text: 'Der Knopf bleibt sichtbar, ist aber gesperrt; den Grund nennt die Metazeile, damit niemand rätselt, warum nichts passiert.',
          deviation: 'Hinweis steht rechts in der Metazeile statt in eigener Zeile darunter.',
          shots: [
            { label: '1366 · hell', src: '_review-bericht-entwurf/sperre-hell.png', w: 1366, h: 800,
              design: { src: '_review-bericht-entwurf/e-sperre-hell.png', w: 1366, h: 800 },
              marks: [{ n: 1, x: 1072, y: 50, w: 184, h: 30, text: 'Knopf gestrichelt, nicht klickbar' }, { n: 2, x: 1020, y: 92, w: 330, h: 24, text: 'Grund in der Metazeile' }] },
            { label: '1366 · dunkel', src: '_review-bericht-entwurf/sperre-dunkel.png', w: 1366, h: 800,
              design: { src: '_review-bericht-entwurf/e-sperre-dunkel.png', w: 1366, h: 800 },
              marks: [{ n: 1, x: 1172, y: 44, w: 186, h: 30, text: 'Knopf gestrichelt, nicht klickbar' }, { n: 2, x: 1020, y: 110, w: 330, h: 24, text: 'Grund in der Metazeile' }] },
          ],
          steps: [
            { open: 'nachweis-labor01.sh im Knoten „Session-Dateien“', act: 'Knopf „Mit Standardprogramm öffnen“ ansehen', expect: 'gestrichelt, Grund in der Metazeile', after: { src: '_review-bericht-entwurf/sperre-hell.png', w: 1366, h: 800 } },
            { open: 'AGENTS.md aus admin-app-main', act: '„Mit Standardprogramm öffnen“ klicken', expect: 'Fehlerzeile „Öffnen fehlgeschlagen …“, kein Programm startet', before: { src: '_review-bericht-entwurf/sperre-dunkel.png', w: 1366, h: 800 }, after: { src: '_review-bericht-entwurf/oeffnen-fehler.png', w: 1366, h: 800 } },
          ],
        },
        {
          id: 'sc5-schmal', name: 'Detail unter 600 px', by: ['#12', 'Umsetzung'],
          text: 'Unter 600 px stehen die vier Knöpfe in Kurzform; der Baum weicht einem Rücksprung.',
          deviation: 'Rücksprung heißt „← Baum“ statt „← Dateien“; Kurzform „Öffnen“ wie im Entwurf.',
          shots: [
            { label: '430 · dunkel', src: '_review-bericht-entwurf/schmal.png', w: 430, h: 800, narrow: true,
              design: { src: '_review-bericht-entwurf/e-schmal.png', w: 430, h: 736 },
              marks: [{ n: 1, x: 20, y: 122, w: 66, h: 26, text: 'Rücksprung zum Baum' }, { n: 2, x: 20, y: 229, w: 280, h: 29, text: 'Knöpfe in Kurzform' }] },
          ],
        },
        {
          id: 'sc5-typen', name: 'Betrachter je Dateityp', by: ['#12', 'Umsetzung'],
          text: 'Bild, PDF und Video öffnen im passenden Betrachter; der Entwurf hatte hier nur Platzhalter.',
          deviation: null,
          shots: [
            { label: 'Bild', src: '_review-bericht-entwurf/bild.png', w: 1366, h: 800, marks: [] },
            { label: 'PDF', src: '_review-bericht-entwurf/pdf.png', w: 1366, h: 800, marks: [] },
            { label: 'Video', src: '_review-bericht-entwurf/video.png', w: 1366, h: 800, marks: [] },
          ],
        },
      ],
      journey: [
        { t: 'Weiche nach Typ: Bild, Video, Ton und PDF im Betrachter-Rahmen, Textformate mit Schalter „Vorschau“.', files: ['ViewerFrame.css', 'SessionFileViewer.tsx'] },
        { t: 'Vier Knöpfe zum Öffnen; das Standardprogramm ist für Skripte gesperrt und sagt warum.', files: ['FileActions.tsx', 'ExecutableLockHint.tsx'], stop: 's5-sperre' },
        { t: 'Knopfleiste brach im schmalen Rahmen um; unter einer Breite wird sie zum Menü.', files: ['FileActions.css'], stop: 's5-schmal', detour: true },
      ],
    },
  ],
  stops: {
    's1-tabelle': {
      title: 'Neue Tabelle für Verweise', kind: 'data', chapter: '1', by: ['#8', 'Umsetzung'],
      why: [
        'Verlinkte Pfade brauchen einen festen Platz, damit die Liste sie nach einem Neustart noch kennt.',
        'Ein Pfad steht je Session genau einmal; erstes und letztes Auftauchen genügen, ein Zähler wäre Ballast.',
      ],
      blocks: [
        {
          type: 'diagram', caption: 'Tabellen nach Migration 022',
          code: `erDiagram
  sessions ||--o{ session_links : "verlinkt"
  sessions {
    TEXT id PK
    TEXT cli_scratchpad_dir "neu"
    INTEGER links_scanned "neu"
  }
  session_links {
    TEXT session_id FK "Teil des Schlüssels"
    TEXT path PK "Teil des Schlüssels"
    REAL first_seen_at
    REAL last_seen_at
  }`,
        },
        {
          type: 'code', file: 'src-tauri/src/db/migrations/022_session_links.sql', lang: 'sql', commit: '10a353f', isNew: true, add: 10, start: 1,
          text: `CREATE TABLE session_links (
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  path          TEXT NOT NULL,
  first_seen_at REAL NOT NULL,
  last_seen_at  REAL NOT NULL,
  PRIMARY KEY (session_id, path)
) WITHOUT ROWID;

ALTER TABLE sessions ADD COLUMN cli_scratchpad_dir TEXT;
ALTER TABLE sessions ADD COLUMN links_scanned INTEGER NOT NULL DEFAULT 0;`,
          anchors: [{ n: 1, from: 1, to: 7 }, { n: 2, from: 9, to: 9 }, { n: 3, from: 10, to: 10 }],
          notes: [
            { n: 1, text: 'Ein Pfad je Session genau einmal: der Schlüssel aus Session und Pfad. Löschen der Session räumt mit auf.' },
            { n: 2, text: 'Der Scratchpad der Kommandozeile überlebt jetzt den Neustart, vorher lag er nur im Speicher.' },
            { n: 3, text: 'Merker: ältere Antworten sind nachgelesen. Das Nachlesen läuft einmal je Session.' },
          ],
        },
      ],
    },
    's2-grenze': {
      title: 'Grenze für fremde Pfade', kind: 'sec', chapter: '2', by: ['#9', 'Umsetzung'], look: 'entscheidet, welche Datei der Verwalter überhaupt zeigt',
      why: [
        'Jede Anfrage der Oberfläche nennt einen absoluten Pfad. Erlaubt ist er nur, wenn er in einem Scratchpad oder Repository des Vorhabens liegt oder eine Session ihn selbst genannt hat.',
        'Das Schaubild zeigt die Reihenfolge der Prüfungen, der Code darunter ist ihre Umsetzung.',
      ],
      blocks: [
        {
          type: 'diagram', caption: 'Prüfungen in allowed_absolute',
          code: `flowchart LR
  P["Pfad aus der Oberfläche"] --> A{"absolut, ohne<br>Datenstrom?"}
  A -- nein --> X["Absage"]
  A -- ja --> C["echten Ort<br>bestimmen"]
  C --> F{"vorhanden?"}
  F -- nein --> NF["nicht gefunden"]
  F -- ja --> O{"Scratchpad oder<br>Repository?"}
  O -- ja --> OK["erlaubt"]
- O -- nein --> X
+ O -- nein --> N{"von Session<br>genannt?"}
+ N -- ja --> OK
+ N -- nein --> X`,
        },
        {
          type: 'code', file: 'src-tauri/src/session_files/access.rs', lang: 'rust', commit: '35ab05f', isNew: true, add: 113, start: 19,
          text: `/// Der echte Pfad der Session-Datei \`path\` — oder die Absage. Der Pfad kommt aus der Oberfläche.
pub fn allowed_absolute(input: &SessionFilesInput, path: &str) -> Result<PathBuf, CommandError> {
    if !Path::new(path).is_absolute() || file_links::has_stream_colon(path) {
        return Err(not_a_session_file());
    }
    let canonical: PathBuf = match fs::canonicalize(path) {
        Ok(canonical) => canonical,
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return Err(CommandError::FileNotFound(path.to_owned()));
        }
        Err(error) => return Err(error.into()),
    };
    if !canonical.is_file() {
        return Err(CommandError::FileNotFound(path.to_owned()));
    }
    if !is_in_open_folder(input, &canonical) && !is_named(input, path, &canonical) {
        return Err(not_a_session_file());
    }
    filesystem::plain_path(&canonical)
}`,
          anchors: [{ n: 1, from: 21, to: 23 }, { n: 2, from: 24, to: 30 }, { n: 3, from: 34, to: 36 }],
          notes: [
            { n: 1, text: 'Datenströme wie datei.txt:geheim fliegen raus, bevor das Dateisystem gefragt wird.' },
            { n: 2, text: 'Geprüft wird der echte Ort: „..“, Verknüpfungen und Kurznamen sind aufgelöst.' },
            { n: 3, text: 'Zwei Wege hinein: liegt in einem offenen Ordner oder wurde von einer Session genannt. Eine nie genannte Datei in Downloads bleibt zu.' },
          ],
        },
      ],
    },
    's2-sperre': {
      title: 'Sperre für ausführbare Dateien', kind: 'sec', chapter: '2', by: ['#9', 'Umsetzung'], look: 'ein Klick darf kein Skript starten',
      why: [
        '„Mit Standardprogramm öffnen“ würde ein Skript ausführen. Der Core sperrt deshalb nach Endung, unter Unix zusätzlich nach Ausführungsbit — für den genannten und den echten Pfad.',
      ],
      blocks: [
        {
          type: 'code', file: 'src-tauri/src/file_links/mod.rs', lang: 'rust', commit: '35ab05f', add: 173, del: 28, start: 198,
          // Aus den Testläufen: überlebte Mutanten und neue Zeilen, die kein Test ausführt.
          mutants: [{ line: 208, text: '„||“ → „&&“ fällt keinem Test auf: Es fehlt ein Fall, in dem nur das Ausführungsbit gesetzt ist.' }],
          cov: { miss: [250, 251] },
          // Diff-Zeilen aus Git: [art, alte Nr., neue Nr., Text]; „d“ = vorher, entfernt.
          rows: [["c", 130, 198, "    }"], ["d", 131, null, "    Err(CommandError::FileNotAllowed("], ["d", 132, null, "        \"Liegt in keinem Repository des Vorhabens\".to_owned(),"], ["d", 133, null, "    ))"], ["a", null, 199, "    Ok(FileLinkTarget::SessionFile {"], ["a", null, 200, "        path: found.to_string_lossy().into_owned(),"], ["a", null, 201, "        line: line_of(raw),"], ["a", null, 202, "    })"], ["a", null, 203, "}"], ["a", null, 204, ""], ["a", null, 205, "/// Ob die Datei ausführbar ist und deshalb nie ans Standardprogramm geht: ihre Endung steht in"], ["a", null, 206, "/// `EXECUTABLE_EXTENSIONS`, unter Unix auch bei gesetztem Ausführungsbit."], ["a", null, 207, "pub fn is_executable(path: &Path) -> bool {"], ["a", null, 208, "    has_executable_name(path) || has_executable_bit(path)"], ["a", null, 209, "}"], ["a", null, 210, ""], ["a", null, 211, "/// Der Pfad, den das Standardprogramm bekommen darf: der echte hinter Verknüpfungen und Kurznamen —"], ["a", null, 212, "/// und weder er noch der gefragte ist ausführbar."], ["a", null, 213, "pub fn program_target(path: &Path) -> Result<PathBuf, CommandError> {"], ["a", null, 214, "    let real = filesystem::plain_path(&fs::canonicalize(path)?)?;"], ["a", null, 215, "    if is_executable(path) || is_executable(&real) {"], ["a", null, 216, "        return Err(CommandError::FileNotAllowed(EXECUTABLE_LOCKED.to_owned()));"], ["a", null, 217, "    }"], ["a", null, 218, "    Ok(real)"], ["a", null, 219, "}"], ["a", null, 220, ""], ["a", null, 221, "/// Gezählt wird, was nach dem letzten Punkt des Namens steht, nicht `Path::extension`: eine Datei"], ["a", null, 222, "/// namens `.bat` hat für Rust keine Endung, für Windows schon. Punkte und Leerzeichen am Ende"], ["a", null, 223, "/// streicht Windows beim Öffnen."], ["a", null, 224, "fn has_executable_name(path: &Path) -> bool {"], ["a", null, 225, "    let Some(name) = path.file_name() else {"], ["a", null, 226, "        return false;"], ["a", null, 227, "    };"], ["a", null, 228, "    let name = name.to_string_lossy();"], ["a", null, 229, "    let effective: &str = if cfg!(windows) {"], ["a", null, 230, "        name.trim_end_matches(['.', ' '])"], ["a", null, 231, "    } else {"], ["a", null, 232, "        &name"], ["a", null, 233, "    };"], ["a", null, 234, "    effective"], ["a", null, 235, "        .rsplit_once('.')"], ["a", null, 236, "        .is_some_and(|(_, extension): (&str, &str)| {"], ["a", null, 237, "            EXECUTABLE_EXTENSIONS"], ["a", null, 238, "                .iter()"], ["a", null, 239, "                .any(|known: &&str| known.eq_ignore_ascii_case(extension))"], ["a", null, 240, "        })"], ["a", null, 241, "}"], ["a", null, 242, ""], ["a", null, 243, "#[cfg(unix)]"], ["a", null, 244, "fn has_executable_bit(path: &Path) -> bool {"], ["a", null, 245, "    use std::os::unix::fs::PermissionsExt;"], ["a", null, 246, ""], ["a", null, 247, "    fs::metadata(path).is_ok_and(|metadata: fs::Metadata| {"], ["a", null, 248, "        metadata.is_file() && metadata.permissions().mode() & 0o111 != 0"], ["a", null, 249, "    })"]],
          text: `/// Der Pfad, den das Standardprogramm bekommen darf: der echte hinter Verknüpfungen und Kurznamen —
/// und weder er noch der gefragte ist ausführbar.
pub fn program_target(path: &Path) -> Result<PathBuf, CommandError> {
    let real = filesystem::plain_path(&fs::canonicalize(path)?)?;
    if is_executable(path) || is_executable(&real) {
        return Err(CommandError::FileNotAllowed(EXECUTABLE_LOCKED.to_owned()));
    }
    Ok(real)
}

/// Gezählt wird, was nach dem letzten Punkt des Namens steht, nicht \`Path::extension\`: eine Datei
/// namens \`.bat\` hat für Rust keine Endung, für Windows schon. Punkte und Leerzeichen am Ende
/// streicht Windows beim Öffnen.
fn has_executable_name(path: &Path) -> bool {
    let Some(name) = path.file_name() else {
        return false;
    };
    let name = name.to_string_lossy();
    let effective: &str = if cfg!(windows) {
        name.trim_end_matches(['.', ' '])
    } else {
        &name
    };
    effective
        .rsplit_once('.')
        .is_some_and(|(_, extension): (&str, &str)| {
            EXECUTABLE_EXTENSIONS
                .iter()
                .any(|known: &&str| known.eq_ignore_ascii_case(extension))
        })
}`,
          anchors: [{ n: 1, from: 199, to: 202 }, { n: 2, from: 223, to: 225 }, { n: 3, from: 224, to: 224 }, { n: 4, from: 237, to: 241 }],
          notes: [
            { n: 1, text: 'Vorher lehnte target() alles außerhalb der Repositories ab. Jetzt wird daraus eine Session-Datei, und erst die Sperre darunter entscheidet, ob das Standardprogramm sie bekommt.' },
            { n: 2, text: 'Genannter und echter Pfad: auch eine Verknüpfung, die auf eine .bat zeigt, fällt unter die Sperre.' },
            { n: 3, rev: '#14 · offen', text: 'Die Meldung nennt den Pfad nicht; wer zwei Dateien öffnet, weiß nicht, welche gesperrt war.' },
            { n: 4, text: 'Windows streicht Punkte und Leerzeichen am Ende: „x.bat.“ ist dieselbe Datei wie „x.bat“.' },
          ],
        },
      ],
    },
    's3-range': {
      title: 'Spulen im Video über Range', kind: 'flow', chapter: '3', by: ['#14', 'Review'], look: 'jede Spanne liest die ganze Datei',
      why: [
        'Ein Video spult nur, wenn der Server Teilstücke liefert. Der Artefakt-Server beantwortet jetzt eine einzelne Byte-Spanne mit 206, alles andere mit der ganzen Datei.',
      ],
      blocks: [
        {
          type: 'diagram', caption: 'Vom Klick bis zum Spulen',
          code: `sequenceDiagram
  participant A as Datei-Ansicht
  participant C as Core
  participant S as Artefakt-Server
  participant V as video
+ A->>C: file_view_url(Datei)
+ C->>C: Grenze prüfen, Handle anlegen
+ C-->>A: Adresse mit Token
  A->>S: Betrachter-Seite laden
  V->>S: GET mit Range bytes=0-
- S-->>V: 200, immer die ganze Datei
+ S-->>V: 206 Partial Content
+ V->>S: GET mit Range bytes=5000000-
+ S-->>V: 206 Partial Content`,
          broken: `sequenceDiagram
  participant A as Datei-Ansicht
  participant C as Core
  A->>C file_view_url(Datei)
  C-->>A: Adresse mit Token`,
        },
        {
          type: 'code', file: 'src-tauri/src/artifacts/server.rs', lang: 'rust', commit: '0197ce8', add: 231, del: 47, start: 316,
          text: `/// Eine Rohdatei, auf Wunsch nur eine Spanne daraus: ohne \`206\` spult \`<video>\` nicht.
fn raw_reply(
    content_type: &'static str,
    mut body: Vec<u8>,
    range: Option<&str>,
    scope: &str,
) -> Reply {
    let size = body.len() as u64;
    let span = range.map_or(Ok(None), |header: &str| byte_range(header, size));
    let mut reply = page_reply(content_type, Vec::new(), scope);
    reply.accepts_ranges = true;
    match span {
        Ok(None) => reply.body = body,
        Ok(Some((first, last))) => {
            // Beide liegen unter \`size\`, also unter der Länge von \`body\`.
            body.truncate(last as usize + 1);
            body.drain(..first as usize);
            reply.status = 206;
            reply.reason = "Partial Content";
            reply.body = body;
            reply.content_range = Some(format!("bytes {first}-{last}/{size}"));
        }
        Err(()) => {
            reply.status = 416;
            reply.reason = "Range Not Satisfiable";
            reply.content_type = TEXT_PLAIN;
            reply.content_range = Some(format!("bytes */{size}"));
        }
    }
    reply
}`,
          anchors: [{ n: 1, from: 319, to: 319 }, { n: 2, from: 329, to: 336 }, { n: 3, from: 338, to: 343 }],
          notes: [
            { n: 1, risk: true, text: 'body kommt vollständig gelesen an. Jede Spanne lädt die ganze Datei in den Speicher, bei großen Videos spürbar.' },
            { n: 2, text: 'Eine Spanne: zuschneiden und mit 206 antworten. Ohne 206 spult der Browser nicht.' },
            { n: 3, text: 'Unlesbare Spanne: 416 mit „bytes */Größe“, wie RFC 9110 es verlangt.' },
          ],
        },
      ],
    },
    's4-knoten': {
      title: 'Datei aus dem Knoten öffnen', kind: 'ui', chapter: '4', by: ['#11', 'Umsetzung'],
      why: [
        'Ein Klick im Knoten öffnet die Datei rechts mit Pfadkette. Dieselbe Ansicht erreicht ein Dateilink aus dem Chat.',
      ],
      blocks: [
        {
          type: 'code', file: 'src/features/files/SessionFileViewer.tsx', lang: 'typescript', commit: '27297d5', isNew: true, add: 109, start: 9,
          stale: { commit: 'd58b04a', phase: 'Phase 5', add: '+95' },
          text: `interface SessionFileViewerProps {
  /** Session, über die der Core die Datei liest. */
  sessionId: string;
  /** Absoluter Pfad der Datei. */
  path: string;
  line: number | null;
  /** Gruppe, unter der die Datei gewählt wurde; \`undefined\`, solange die Liste fehlt. */
  group: SessionFileGroup | undefined;
  /** Eintrag der Liste; \`undefined\`, solange sie fehlt oder die Datei nicht mehr führt. */
  file: SessionFile | undefined;
  onOverview: () => void;
}`,
          anchors: [{ n: 1, from: 15, to: 18 }],
          notes: [
            { n: 1, text: 'Gruppe und Eintrag dürfen fehlen, solange die Liste lädt (kalt 1,2–1,5 s). Die Datei steht trotzdem schon rechts.' },
          ],
        },
        {
          type: 'image', src: '_review-bericht-entwurf/datei-offen.png', w: 1366, h: 800, caption: 'Prüfseite Phase 4: Datei aus dem Knoten geöffnet',
          marks: [{ n: 2, x: 0, y: 218, w: 340, h: 462 }, { n: 3, x: 438, y: 44, w: 390, h: 30 }],
          notes: [
            { n: 2, text: 'Knoten „Session-Dateien“: je Session Scratchpad und weitere Orte, mit Anzahl.' },
            { n: 3, text: 'Pfadkette bis zur Datei; „← Übersicht“ führt zurück.' },
          ],
        },
      ],
    },
    's5-sperre': {
      title: 'Gesperrter Knopf mit Grund', kind: 'sec', chapter: '5', by: ['#12', 'Umsetzung'],
      why: [
        'Bei Skripten bleibt der Knopf sichtbar, aber gesperrt; die Metazeile sagt, warum.',
        'Der Knopf verweist per aria-describedby auf diese Zeile, ein Screenreader liest den Grund mit.',
      ],
      blocks: [
        {
          type: 'pair',
          code: {
            file: 'src/features/files/FileActions.tsx', lang: 'typescript', commit: 'd58b04a', isNew: true, add: 103, start: 82,
            text: `      <button
        type="button"
        className="files-button files-button--small"
        title={isGone ? GONE_TITLE : 'Mit Standardprogramm öffnen'}
        disabled={isGone || executable}
        aria-describedby={executable ? lockId : undefined}
        onClick={(): void => {
          run(() => openFileDefault(sessionId, file), 'Öffnen fehlgeschlagen');
        }}
      >
        <span className="file-actions__long">Mit Standardprogramm öffnen</span>
        <span className="file-actions__short">Öffnen</span>
      </button>`,
            anchors: [{ n: 1, from: 86, to: 86 }, { n: 2, from: 87, to: 87 }],
          },
          image: {
            src: '_review-bericht-entwurf/sperre.png', w: 1366, h: 800, caption: 'Prüfseite Phase 5, dunkel',
            marks: [{ n: 1, x: 1174, y: 45, w: 183, h: 28 }, { n: 2, x: 1022, y: 109, w: 326, h: 25 }],
          },
          notes: [
            { n: 1, text: 'Gesperrt, nicht versteckt: der Knopf bleibt an seinem Platz, die Leiste springt nicht.' },
            { n: 2, text: 'Verweist auf die Zeile mit dem Grund in der Metazeile.' },
          ],
        },
        {
          type: 'code', file: 'src/components/ExecutableLockHint.tsx', lang: 'typescript', commit: 'd58b04a', isNew: true, add: 17, start: 9,
          text: `/** Die Zeile unter dem Kopf einer ausführbaren Datei: sagt, warum „Mit Standardprogramm öffnen“ gesperrt ist
 *  (ADR 071). */
export function ExecutableLockHint({ id }: ExecutableLockHintProps): ReactElement {
  return (
    <span id={id} className="executable-lock-hint">
      ⚠ Standardprogramm gesperrt: würde das Skript ausführen
    </span>
  );
}`,
          anchors: [{ n: 3, from: 14, to: 14 }],
          notes: [{ n: 3, text: 'Derselbe Wortlaut im Reiter „Artefakte“, die Sperre gilt dort genauso.' }],
        },
      ],
    },
    's5-schmal': {
      title: 'Kurzformen unter 600 px', kind: 'ui', chapter: '5', by: ['#12', 'Umsetzung'],
      why: [
        'Ist der Detailbereich schmaler als 600 px, stehen die Kurzformen der Knöpfe. Gemessen wird der Detailbereich, nicht das Fenster.',
      ],
      blocks: [
        {
          type: 'pair',
          code: {
            file: 'src/features/files/FileActions.css', lang: 'css', commit: 'd58b04a', isNew: true, add: 20, start: 1,
            text: `/* Kurzformen der Knöpfe: gilt in einem Detailbereich (\`.file-viewer\`) unter 600 px. */
.file-actions__short {
  display: none;
}

@container file-detail (max-width: 600px) {
  .file-actions__long {
    display: none;
  }

  .file-actions__short {
    display: inline;
  }
}

.file-actions__status {
  min-width: 0;
  color: var(--color-fg-muted);
  font-size: var(--font-size-xs);
}`,
            anchors: [{ n: 1, from: 6, to: 6 }, { n: 2, from: 7, to: 13 }],
          },
          image: {
            src: '_review-bericht-entwurf/schmal.png', w: 430, h: 800, narrow: true, caption: 'Prüfseite Phase 5, Detailbereich 430 px',
            marks: [{ n: 1, x: 12, y: 116, w: 406, h: 680 }, { n: 2, x: 20, y: 229, w: 280, h: 29 }],
          },
          notes: [
            { n: 1, text: 'Container file-detail: zählt die Breite des Detailbereichs, nicht des Fensters.' },
            { n: 2, text: 'Lange Beschriftung aus, Kurzform an: VS Code · Ordner · Öffnen.' },
          ],
        },
      ],
    },
  },
};

window.KINDS = {
  data: ['Datenmodell', '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>'],
  sec: ['Sicherheit', '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'],
  flow: ['Ablauf', '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>'],
  ui: ['Oberfläche', '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>'],
};

// Zustände der Entwurfsleiste: welche Station die Kopfzeile zeigt und wie weit der Bericht ist.
window.STATES = {
  bereit: { session: '#13', name: 'Abnahme', status: ['wait', 'wartet auf dich'], back: 'Phase 6 · Abnahme', chapters: 5, files: 104, badge: ['ready', 'wartet auf Abnahme'], canAccept: true },
  waechst: { session: '#11', name: 'Phase 4 · Umsetzung', status: ['run', 'läuft'], back: 'Phase 4 · Knoten im Dateibaum', chapters: 4, running: '4', files: 58, badge: ['grow', 'wächst · Phase 4 läuft'], canAccept: false, fresh: '3' },
  abgenommen: { session: '#13', name: 'Abnahme', status: ['done', 'fertig'], back: 'Phase 6 · Abnahme', chapters: 5, files: 104, badge: ['done', 'abgenommen · 26.11. 11:02 von dir'], canAccept: false, closed: true },
  fehler: { session: '#13', name: 'Abnahme', status: ['wait', 'wartet auf dich'], back: 'Phase 6 · Abnahme', chapters: 5, files: 104, badge: ['ready', 'wartet auf Abnahme'], canAccept: true, broken: true },
};
