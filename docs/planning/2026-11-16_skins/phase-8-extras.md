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

- [ ] `src/features/skins/tips.ts` (Liste, `pickTip(date)`), `src/features/skins/SkinTip.tsx`, Einbau in `NewSessionIntro.tsx`.
- [ ] `src/features/skins/useKonami.ts` (Tastenfolge, Ziel-Prüfung über `src/lib/keyTargets.ts`), Einbau in die Kategorie „Skins“; Paket „Vera“ über `skinsCreate` + `skinsSave` + `SettingsChange.SkinFigures`.
- [ ] Doku: `docs/code-map.md` (Tipps, Easter Eggs).

## Report-Back
