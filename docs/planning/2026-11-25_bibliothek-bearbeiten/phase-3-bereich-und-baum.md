# Phase 3 — Oberfläche: Bereich, Baum, Übersicht, Ansicht

**Rating:** standard · baut auf Phase 1 und 2 · Entwurf verbindlich: `artifacts/entwurf-bibliothek-bearbeiten.html`

## Kontext (lesen vor dem ersten Edit)

- `README.md` dieses Plans; `artifacts/README.md` (welcher Teil des Entwurfs gilt, was Beispiel ist). Den Entwurf im Browser öffnen und die Zustände der Entwurfsleiste durchklicken.
- `docs/conventions/react.md`, `docs/conventions/typescript.md`, `docs/conventions/tailwind.md` (BEM-CSS je Komponente, Tokens aus `src/styles/theme.css`).
- `src/stores/sessions.ts` — `showSettings`, `openSettings`, `closeSettings`; jede `select*`/`open*`-Aktion setzt die anderen Flags zurück.
- `src/app/App.tsx` — `renderMain` (Zweig `showSettings`), Ctrl K (`setIsVaultOpen`), Strg P (Kommentar „Strg P: aus jeder Ansicht …“).
- `src/app/Sidebar.tsx` — Knopf „Bibliothek“ in `sidebar__toolbar`, Prop `onOpenVault`, Markierung `sidebar__tool--active` bei Einstellungen; `src/app/Sidebar.css`.
- `src/features/vault/VaultSearchDialog.tsx` — `act(hit, reveal)`; `VaultPreview.tsx` (Knöpfe „Öffnen“/„Im Ordner zeigen“); `vaultGroups.ts` — `LIBRARY_GROUPS`, `subgroupLabel`, `ROOT_LABEL`; `VaultIcons.tsx` (Gruppen-Symbole); `VaultSearchDialog.css` (Gruppenfarben `--color-group-*`, Linie `border-left: 2px solid color-mix(…45%…)`).
- `src/features/files/RepoTree.tsx` + `buildTreeRows.ts` — Muster virtualisierter Baum mit Zeilen-Modell; `src/features/files/FileViewer.tsx` — Kopf mit Pfad und Knöpfen; `FilesView.tsx` — linke Spalte, Übersicht, schmale Breite.
- `src/lib/vault.ts` (Wrapper aus Phase 1/2), `src/lib/bindings/VaultTree*.ts`.

## AK der Phase

1. **Einstieg** (Ctrl K stellt erst Phase 6 um): `sessions.ts` bekommt `showLibrary` mit `openLibrary()`/`closeLibrary()` analog zu Einstellungen; `openLibrary` setzt `showSettings`, `showNewSession`, `showProjectOverview`, `showImplementation` auf `false`, und jede andere Navigations-Aktion setzt `showLibrary: false`. `App.renderMain` zeigt `<LibraryView />` vor dem Zweig `showSettings`. Der Knopf „Bibliothek“ der Seitenleiste ruft `openLibrary`, trägt bei `showLibrary` die Klasse `sidebar__tool--active` und `aria-current="page"`, Titel „Bibliothek“.
2. **Suchfeld** (rechts in der Leiste, Platzhalter „Name oder Inhalt suchen“, `kbd` „Ctrl K“): Name — Teilstring des Pfads, ohne Groß/Klein, ab 1 Zeichen, im Frontend; Inhalt — ab 3 Zeichen, 200 ms entprellt, `findInVault({ text, kind: null, tags: [], under: null, limit: 200, anyTerm: false })`, Treffer über `hit.file`. Der Baum zeigt die Vereinigung, alle Treffer aufgeklappt; eine Datei, die nur über den Inhalt trifft, trägt „im Text“ (Schrift 11 px, gedämpft). Öffnen eines Inhaltstreffers setzt `openLine = hit.line` im Store (Phase 4 springt dorthin). Kein Treffer → Zeile „Keine Datei passt zu „<text>“.“. Während des Abgleichs (`isScanning`) zusätzlich „Index wird aufgebaut …“ unter dem Feld.
3. **Leiste über dem Baum** (Entwurf `.tb`): links „<n> Dateien · Stand <HH:MM>“ aus `VaultStatus.files`/`scannedAt`, daneben Zustandspunkt („gespiegelt“ grau; „<n> ungespeichert“ in `--color-status-waiting`; „Abgleich gescheitert“ in Fehlerfarbe, wenn `useEnvironment().mirrorError` gesetzt); rechts das Suchfeld aus AK 2. Kein weiterer Knopf.
4. **Baum** (`LibraryTree`, virtualisiert mit `@tanstack/react-virtual` wie `RepoTree`): Zeile „Übersicht“ oben; je Gruppe ein klebender Kopf (Symbol aus `VaultIcons`, Name in Großbuchstaben, Anzahl der Einträge), Kopf und Inhalt einer Gruppe in einem gemeinsamen Abschnitt, damit Köpfe sich nicht überlagern; darunter Untergruppen in der Reihenfolge von `LIBRARY_GROUPS` (Wissen: Ordnernamen alphabetisch, „Hauptordner“ zuletzt) mit Anzahl; Einträge alphabetisch nach Titel. Ein Datei-Artefakt ist eine Dateizeile mit Typkürzel und Titel; ein Ordner-Artefakt klappt in Unterordner (zuerst, alphabetisch, mit Anzahl) und Dateien (danach, alphabetisch). Gruppenlinie links in der Gruppenfarbe wie im Suchdialog. Zeilenhöhe 24 px (Untergruppe 26 px), bei `pointer: coarse` 44 px. Aufklappzustand im Store `library.ts` (nicht persistent); beim Öffnen einer Datei klappt der Pfad auf und die Zeile scrollt in die Mitte.
5. **Übersicht** (keine Datei offen): Abschnitt „Ungespeichert“ (nur wenn Entwürfe da sind; ab Phase 4 befüllt) und „Zuletzt geändert“ (8 bearbeitbare Dateien nach Änderungszeit absteigend: Typkürzel, Titel des Eintrags + Dateipfad im Eintrag, Beschreibung, Zeit „heute HH:MM“/„gestern“/Datum).
6. **Datei-Kopf und Meta-Zeile** (`LibraryFileView`): Brotkrumen Gruppe / Untergruppe / Eintrag / Unterordner / **Datei**; rechts „Im Ordner zeigen“ (`vault_open` reveal) und „Extern öffnen“ (`vault_open`); unter 640 px Breite der Detailspalte Kurzformen „Ordner“/„Extern“. Meta-Zeile: voller Pfad (links gekürzt, `direction: rtl`), Größe, „geändert …“, Spiegel-Hinweis („gespiegelt nach ~\.claude“ bei Pfaden, für die `mirror::entry_of` gilt — Regel im Frontend gespiegelt als Funktion `isMirroredPath` in `libraryPaths.ts` mit Kommentar auf die Rust-Quelle; sonst „nur in der Bibliothek“ in Grau).
7. **Ansicht ohne Editor** (bis Phase 4 für alle Dateien, danach nur für nicht bearbeitbare): Bild und PDF und alles mit Betrachter in einem `iframe` mit `vaultPreviewUrl(path) + '?view=1'` und `sandbox="allow-scripts"`; Leiste „Nur Ansicht — <ENDUNG>-Dateien bearbeitet der Verwalter nicht.“ (bei nicht bearbeitbaren); sonst leerer Zustand „Keine Ansicht für diesen Typ“ mit „Extern öffnen“.
8. **Zustände:** Index lädt → Skelett-Zeilen; keine Bibliothek gewählt → leerer Zustand „Noch keine Bibliothek gewählt“ mit Knopf „Ordner in den Einstellungen wählen“ (öffnet Einstellungen); Fehler beim Laden des Baums → Satz aus `commandErrorText` mit „Erneut laden“. Der Baum lädt bei `vault://changed` neu (`onVaultChanged`), ohne Aufklappzustand und Auswahl zu verlieren.
9. **Schmal** (Container der Hauptfläche ≤ 780 px): Baum und Datei wechseln sich ab; in der Datei steht „← Bibliothek“ vorn im Kopf; Suchfeld nimmt die volle Breite.

## Checkliste

- [ ] `src/stores/library.ts`: `openPath`, `openLine`, `expanded: Record<string, boolean>`, `filter`, `focusFilterTick`, Aktionen `openLibraryFile(path, line?)`, `toggle`, `setFilter`, `focusFilter`, `closeFile`.
- [ ] `src/features/vault/libraryRows.ts`: reine Funktion `buildLibraryRows(tree, expanded, filter, openPath): LibraryRow[]` (Arten `group`, `subgroup`, `artifact`, `folder`, `file`, mit Tiefe, Anzahl, Schlüssel); `src/features/vault/libraryPaths.ts`: `isMirroredPath`, `fileKindLabel` (Typkürzel wie im Entwurf: MD, HTM, CSS, JS, PY, PS, CMD, YML, {}, XML, TXT, IMG, PDF, sonst …).
- [ ] `src/features/vault/useLibraryTree.ts` (laden, `vault://changed`, Fehler).
- [ ] Komponenten mit je eigener CSS-Datei (BEM-Block `library`): `LibraryView.tsx`, `LibraryToolbar.tsx`, `LibraryTree.tsx`, `LibraryOverview.tsx`, `LibraryFileView.tsx`, `LibraryPreviewFrame.tsx`.
- [ ] `sessions.ts`, `App.tsx`, `Sidebar.tsx` wie AK 1; Suchfeld wie AK 2 in `LibraryToolbar.tsx`, Inhaltssuche in `useLibrarySearch.ts` (eigener Hook; `useVaultSearch.ts` nicht anfassen, Phase 6 entscheidet über ihn).
- [ ] Phase-2-Beleg in der laufenden App: `galerie.html` des Baukastens mit `?view=1` weglassen und direkt laden → CSS greift; Ergebnis im Report-Back.
- [ ] `docs/code-map.md`: Zeile „Bibliothek“ um die Oberfläche (`LibraryView` …, Store `library.ts`) ergänzen; `docs/glossary.md`: „Bibliothek (Bereich)“ — Hauptansicht zum Ansehen und Bearbeiten der Bibliothek.
- [ ] `pnpm check` grün.

## Report-Back
