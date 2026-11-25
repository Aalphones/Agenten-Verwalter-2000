# Phase 6 — Suchdialog entfernen, Ctrl K umstellen

**Rating:** mechanisch · baut auf Phase 3–5 · eigener Commit (alte Form entfernen)

## Kontext (lesen vor dem ersten Edit)

- `README.md` dieses Plans (AK 1, AK 11).
- `src/app/App.tsx` — `isVaultOpen`, `setIsVaultOpen`, Ctrl-K-Handler (Zweig mit `event.key.toLowerCase() === 'k'`), `<VaultSearchDialog …>`, Prop `onOpenVault` an `Sidebar`.
- `src/app/Sidebar.tsx` — `onOpenVault` (seit Phase 3 durch `openLibrary` ersetzt; prüfen, dass kein Aufrufer bleibt).
- `src/features/vault/` — Dateien des Dialogs (unten).

## Was der Suchdialog leistet und wo es jetzt liegt (verstanden)

| Aufgabe des Dialogs | jetzt |
|---|---|
| Ctrl K aus jeder Ansicht | Ctrl K öffnet den Bereich, Fokus ins Suchfeld (diese Phase) |
| Volltextsuche über Anweisungen, Skills, Wissen mit Gruppen | Suchfeld des Bereichs, Treffer im gegliederten Baum (Phase 3) |
| Vorschau mit Beschreibung, Bild | Datei-Ansicht und Übersicht des Bereichs (Phase 3/4) |
| Öffnen im Standardprogramm, Im Ordner zeigen | Knöpfe „Extern öffnen“, „Im Ordner zeigen“ im Datei-Kopf (Phase 3) |
| Ausschnitte mit hervorgehobenen Fundstellen | entfällt; Sprung zur Fundstelle im Editor (Phase 4) |

Nicht betroffen: die Werkzeuge `vault_search`/`vault_get` der Agenten, `vault_find` im Kern, die Einstellungszeilen (`LibraryDirRow`, `LibrarySearchRow`, `VaultRows.css`, `vaultTexts.ts`), `vaultGroups.ts` und `VaultIcons.tsx` (vom Baum genutzt).

## AK der Phase

1. Ctrl K (ohne Shift/Alt) ruft aus jeder Ansicht `openLibrary()` und `focusFilter()`; im Bereich markiert der zweite Druck den Text im Feld. Titel des Sidebar-Knopfs: „Bibliothek (Ctrl K)“.
2. Gelöscht: `VaultSearchDialog.tsx`, `VaultSearchDialog.css`, `VaultPreview.tsx`, `VaultHitRow.tsx`, `HighlightedText.tsx`, `snippetSegments.ts`; `useVaultSearch.ts` nur, wenn `Grep` danach keinen Aufrufer findet. `App.tsx` ohne `isVaultOpen`.
3. Kern: `vault_preview` (Bild als `data:`-Adresse) nur entfernen, wenn kein Aufrufer mehr existiert (Grep auf `loadVaultImage` und `vault_preview` in `src/`); dann Befehl, Registrierung, Wrapper `loadVaultImage` und `tools::image_data_url` nur, wenn `vault_get` sie nicht mehr nutzt — sonst bleibt `image_data_url`.
4. `Grep` auf `VaultSearchDialog|VaultPreview|VaultHitRow|HighlightedText|snippetSegments|onOpenVault|isVaultOpen` in `src/` ist leer.

## Checkliste

- [ ] Ctrl K in `App.tsx` umstellen, Dialog-Zustand und -Einbindung entfernen.
- [ ] Dateien löschen (AK 2), Kern-Rest prüfen (AK 3), `pnpm bindings` falls ein Befehl fällt.
- [ ] `docs/code-map.md`: Zeile „Bibliothek“ ohne Suchdialog, mit Bereich; `docs/glossary.md`: „Suchdialog (Bibliothek)“ als entfallen markieren oder streichen; `docs/decisions/069-bibliothek.md` nicht ändern (Geschichte), ADR 072 nennt die Ablösung.
- [ ] `pnpm check` grün; eigener Commit.

## Report-Back
