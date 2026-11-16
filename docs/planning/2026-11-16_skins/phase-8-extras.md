# Phase 8 — Tipps und Easter Eggs

Rating: mechanisch. Kleine Freuden, nur mit eingeschaltetem Skin bzw. Schalter „Easter Eggs“, nie ungefragt mitten in der Arbeit.

## Kontext (lesen)

- `src/features/projects/NewSessionIntro.tsx` (Einstiegsansicht einer neuen Session)
- Phase 3/4: `stores/skins.ts`, `SkinStage`, `lookFor`, Seite „Skins“
- Entwurf: Abschnitt „Easter Egg“ im Skript (Konami-Code)

## AK

1. Tipp: Ist ein Figurenpaket aktiv, zeigt `NewSessionIntro` unten eine Zeile mit Bühne „klein“ (Fach `think`, sonst `other`; ohne Bild nur Text) und „<Fachname-Figur> weiß: <Tipp>“ bzw. ohne Bild „Tipp: <Tipp>“. Tipp zufällig je Anzeige aus: „Strg+; öffnet eine Nebenfrage, ohne die Session zu stören.“, „Esc unterbricht den Agenten, die Session bleibt.“, „/btw stellt eine Frage am Rand.“, „Im Reiter Artefakte siehst du alles, was der Agent dir zeigen will.“, „Rechtsklick auf markierten Text im Chat öffnet eine Nebenfrage dazu.“. Der Figurenname ist der Paketname ohne Klammerzusatz.
2. Konami-Code (↑ ↑ ↓ ↓ ← → ← → B A) auf der Seite „Skins“ bei „Easter Eggs“ = an und Fokus nicht in einem Eingabefeld: legt einmalig das Figurenpaket „Vera“ an (nur Texte, Inhalte wie im Entwurf) und aktiviert es; ein zweites Mal aktiviert es nur.
3. 4. Mai (lokales Datum) und „Easter Eggs“ an: Tipp-Zeile lautet „Möge die Macht mit dir sein.“ statt eines Tipps.
4. Session Nummer 42 und „Easter Eggs“ an: `NewSessionIntro` zeigt zusätzlich gedämpft „Session 42 – die Antwort auf fast alles.“
5. „Easter Eggs“ aus → nichts davon.

## Checkliste

- [x] `src/features/skins/tips.ts` (Liste, `pickTip(date, isEasterEggs, roll)`), `src/features/skins/SkinTip.tsx`, Einbau in `NewSessionIntro.tsx`.
- [x] `src/features/skins/useKonami.ts` (Tastenfolge, Ziel-Prüfung über `src/lib/keyTargets.ts`), `unlockVera.ts` (Paket „Vera“ über `createSkin` + `saveSkin`), Einbau in `SettingsView` (aktiv bei „Easter Eggs“ an und Kategorie „Skins“ bzw. Editor sichtbar); aktiviert über `save({ kind: 'skinFigures' })`.
- [x] Doku: `docs/code-map.md` (Tipps, Easter Eggs).

## Report-Back

Status: complete. `pnpm check` grün, nicht in der echten App gelaufen.

- Bühne der Tipp-Zeile: Größe `toast` (50 × 31); Figur aus Fach „Denken“ mit Bild, sonst „Sonstiges“ mit Bild, sonst nur Text „Tipp: …“.
- 4. Mai: die Zeile zeigt den Gruß allein (ohne „<Name> weiß:“), nur mit „Easter Eggs“ an und aktivem Figurenpaket (ohne Paket gibt es keine Tipp-Zeile).
- Session 42: eigene gedämpfte Zeile in `NewSessionIntro`, unabhängig vom Figurenpaket, nur mit „Easter Eggs“ an.
- Vera: ein vorhandenes Figurenpaket namens „Vera“ wird nur aktiviert, nicht überschrieben. Texte für Suchen, Lesen, Schreiben, Shell, Denken, Commit sind neu formuliert (der Entwurf kürzt sie mit „…“).
- Wackelstellen: Konami-Taste auf der Seite (Fokus nach Klick auf einen Knopf zählt als „nicht im Eingabefeld“); Zufall der Tipps und Datum nur beim Öffnen der Ansicht gezogen.
