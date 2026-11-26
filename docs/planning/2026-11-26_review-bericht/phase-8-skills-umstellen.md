# Phase 8 — Skills umstellen (User-Skills, facepass-Projekt-Skills), Plan fertig

Rating: standard. Die Anweisungen außerhalb des Verwalters verlangen in Stationen einer Umsetzung keine HTML-Berichte und keine Abnahme-Artefakte mehr, sondern die Werkzeuge des Review-Berichts; die Abnahme läuft über den Reiter „Review“. Danach „Plan fertig“ für diesen Plan.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt: Werkzeuge, „Anweisung an Stationen“ (Wortlaut der App), „Von mir gesetzt“ (Plan-Vorlage als HTML bleibt; Review-Datei und Wiki-Kapitel bleiben, nur ihre HTML-Kopie entfällt)
- **Vor jedem Write in eine Regeldatei:** `~/.claude/knowledge/topics/regeldateien.md` (Inhalt, Ort, Spiegeln) und `~/.claude/knowledge/topics/skill-evolution.md` (Decision-Log statt Plan-Datei). `~/.claude/CLAUDE.md` zeigt auf den Master `G:\Meine Ablage\U104_Agents\CLAUDE.md`.
- User-Skills (Fundstellen vom 2026-11-26):
  - `~/.claude/CLAUDE.md` Zeile „**HTML-Berichte landen zusätzlich als Artefakt im Vorhaben.**“ (Abschnitt „Projekt-Docs“)
  - `~/.claude/skills/mode-implementing/SKILL.md` Abschnitt „Im Agenten-Verwalter (beide Profile)“
  - `~/.claude/skills/mode-implementing/WORK.md` Abschnitt „Im Agenten-Verwalter: Stationen“ und Zeile 51 „Verifikation = Selbst-Smoke … ein Artefakt light (curl-Zeile / Screenshot) in den Report-Back“
  - `~/.claude/skills/mode-reviewing/SKILL.md` (Abschnitt zur Ablage des Ergebnisses, `docs/reviews/`)
- facepass-Projekt-Skills unter `C:\Users\smick\develop\easyfitness\facepass\.claude\skills\` (Fundstellen vom 2026-11-26):
  - `project-implementing/references/bildschirm-abnahme.md` Zeile 9 („Fotos der Abnahme liegen als Artefakt vor … HTML-Seite …“) und „Abnahme-Paket“
  - `project-implementing/auftraege/phasen-review.md` Zeilen 27 und 37 (Sichtabnahme-Seite prüfen, Ausgabezeile)
  - `project-implementing/references/abschluss.md` Zeilen 12 und 44 (Abnahme-Sicht; „Bericht als Wiki-Kapitel … plus Artefakt im Vorhaben“)
  - `project-implementing/references/modi.md` Zeilen 7 und 73 (Abnahme-Weg)
  - `project-reviewing/references/merge-gate.md` Zeile 45 und `project-reviewing/references/merge-mechanik.md` Zeile 66 („dieselbe Fassung als Artefakt im Vorhaben“)
  - `project-committing/references/merge.md` Zeile 30 (Prüfstein „Diff gesehen“)
  - facepass-`AGENTS.md` und `project-committing/SKILL.md` (Commit-Regeln dieses Repos)
- Fehlerklassen (Vault `werkzeuge/claude-code`): „Textsuche in einem Punkt-Ordner liefert stumm null“ — in `.claude/`-Ordnern mit `Grep` und ausdrücklichem `path` bzw. per Read prüfen, ein leerer Treffer ist kein Beleg; (Vault `werkzeuge/git`): CRLF-Anker bei Ersetzungsskripten — Edits mit dem Edit-Werkzeug, nicht per Skript.

## AK

1. **User-Ebene:** Die Zeile „HTML-Berichte landen zusätzlich …“ in `CLAUDE.md` nennt die Ausnahme: in einer Station einer Umsetzung mit den Werkzeugen `mcp__verwalter__report_*` entsteht kein HTML-Bericht; Erklärungen, Befunde und Schaubilder gehen per `report_note`/`report_figure` in den Review-Bericht.
2. `mode-implementing/SKILL.md` (Abschnitt „Im Agenten-Verwalter“) und `WORK.md` (Abschnitt „Stationen“, Zeile „Verifikation“) sagen: Umsetzung und Nachbesserung erklären per `report_note` nach einer Folge von Edits; Nachbesserung meldet `resolves`; Bildschirmfotos für die Sichtabnahme per `report_screen` (je Bildschirm, Fotos je Breite und Thema, Entwurfsbild, Abweichung, Klickpfad), einzelne Belege per `report_figure` mit `text` statt Artefakt; der Benutzer nimmt im Reiter „Review“ ab.
3. `mode-reviewing/SKILL.md`: im Verwalter zusätzlich jeder Befund als `report_note` mit `kind: "finding"` und `at`, Architektur-Zusammenhang als `report_figure` mit Markern `+ `/`- `/`~ `; die Review-Datei bleibt.
4. **facepass:** Abnahme-Paket und Sichtabnahme laufen über `report_screen` (ein Aufruf je Bildschirm: Fotos 1440 und 390 px hell und dunkel vom echten Gerät, abgenommener Entwurf als `design`, Abweichungen in `deviation`, Klickpfade als `steps` mit Vorher/Nachher), keine HTML-Seite; `phasen-review.md` prüft die Sichtabnahme im Reiter „Review“; Merge-Review-Bericht bleibt Wiki-Kapitel, die Kopie als Artefakt entfällt, Befunde zusätzlich als `report_note`; Abnahme-Weg nennt im Verwalter den Reiter „Review“ (Changes-Ansicht bzw. IDE bleiben außerhalb).
5. Jede geänderte Zeile ist in Klartext ohne harte Zeilenumbrüche im Absatz geschrieben; keine Erwähnung von Zeremonie oder `~/.claude` in committeten facepass-Dateien außer dem Werkzeugnamen.
6. User-Ebene: Eintrag im Decision-Log nach `skill-evolution.md` und Spiegeln nach `regeldateien.md` erledigt.
7. facepass: vor dem ersten Write `git status`; ist der Baum nicht sauber oder steht er nicht auf dem Standard-Branch, 🔴 an den Benutzer statt zu schreiben. Sonst Commit nach `project-committing` von facepass auf einem eigenen Branch `docs/review-bericht-skills`, Push dieses Branches; kein Merge ohne Benutzer.
8. „Plan fertig“ nach `mode-implementing` für diesen Plan (Archiv, Version, Tag nach `docs/conventions/releases.md`); `pnpm check` grün.

## Checkliste

- [ ] `regeldateien.md` und `skill-evolution.md` lesen.
- [ ] User-Ebene: `CLAUDE.md`, `mode-implementing/SKILL.md`, `mode-implementing/WORK.md`, `mode-reviewing/SKILL.md` ändern; Decision-Log-Eintrag; Spiegeln.
- [ ] facepass: `git -C C:\Users\smick\develop\easyfitness\facepass status`; Branch anlegen; die sieben Fundstellen oben ändern; vor dem Commit erneut `Grep` nach `HTML-Seite`, `Artefakt im Vorhaben`, `Sichtabnahme-Seite` mit `path` auf `.claude\skills` — verbleibende Treffer einzeln begründen oder ändern.
- [ ] facepass: Commit und Push des Branches nach `project-committing`.
- [ ] Verwalter-Repo: `docs/PROJECT.md` (Meilenstein/Scope um „Review-Bericht“), `docs/code-map.md` Stand-Satz am Kopf, `docs/glossary.md` geprüft.
- [ ] „Plan fertig“: Plan nach `docs/archive/2026-11/` (bzw. aktuellem Monat), Release nach `docs/conventions/releases.md`.

## Report-Back
