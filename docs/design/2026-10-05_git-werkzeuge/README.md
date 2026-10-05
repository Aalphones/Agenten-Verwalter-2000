# Design-Entwurf: Git in den Changes

**Status:** abgenommen am 2026-10-05 als Grundlage des Plans [Git-Werkzeuge](../../planning/2026-10-05_git-werkzeuge/README.md). Vorbild ist die Ansicht „Source Control“ in VS Code; nachgebaut wird die Bedienung, eingebaut in den Reiter „Changes“ statt als eigenes Panel. Wo die Umsetzung abweichen muss, wird erst dieser Entwurf geändert, dann der Code.

## Ansehen

- [git-werkzeuge.html](git-werkzeuge.html) direkt im Browser öffnen — anders als die älteren Entwürfe braucht diese Tafel keine Design-Zeichenfläche von claude.ai.
- Die Leiste ganz oben gehört nicht zur App: Theme (dunkel/hell), Zustand des Agenten (arbeitet/ruht, zeigt die Sperren) und „Neues markieren“ — gestrichelt umrandet ist, was der Entwurf hinzufügt; alles andere ist die heutige App, vereinfacht nachgezeichnet.
- Farbwerte sind die Hex-Werte der semantischen Tokens aus `src/styles/theme.css` (Stand 2026-10-05).

## Grundidee

Die Changes zeigen schon heute, was die Session geändert hat, getrennt nach Uncommitted und Committed, je Repository. Genau das ist der Stoff, mit dem man committet und pusht — also bekommen die Changes die Git-Bedienung, statt dass ein zweites Panel dieselben Dateien noch einmal auflistet.

## Was die Tafel zeigt

| Bereich | Zeigt |
|---|---|
| Kopfzeile | unverändert bis auf eine Branch-Pille direkt hinter Titel und Status: Branch des ersten Repositorys, ↓/↑, Punkt bei offenen Änderungen, „+N“ bei weiteren Repositories; Tooltip listet alle; Klick öffnet die Changes. Rechts bleiben Hintergrund, Kontext, Nutzung und Laufzeit, wie sie sind. |
| Hinweis über dem Dateibaum | solange der Agent arbeitet: was wartet, mit „Pausieren“ |
| Repository-Zeile im Dateibaum | Branch-Knopf (Menü: suchen, neuer Branch, neuer Branch als Ticket-Worktree, lokale und Remote-Branches), Pull ↓N, Push ↑N, ⋯ (Fetch, Pull mit Rebase, Stash, Merge, Branch löschen, im Explorer / in VS Code öffnen) |
| Commit-Feld je Repository | Nachricht (Strg+Enter), ✦ schlägt eine Nachricht nach `docs/conventions/commits.md` vor, Knopf „Commit · N Dateien“, Menü mit Commit & Push und „Letzten Commit ergänzen“ |
| Uncommitted | jede Datei mit Haken „geht in den nächsten Commit“; Dateien der Session sind vorab angehakt; beim Überfahren „Verwerfen“ mit Rückfrage |
| Fremde Änderungen | Zeile „N weitere Änderungen im Ordner — nicht von dieser Session“, aufklappbar, nicht angehakt — committet werden sie nur, wenn man sie bewusst anhakt |
| Committed | eigene Commits mit Kennzeichnung „noch nicht gepusht“ |
| Übersicht (rechts, ohne gewählte Datei) | je Repository ↓/↑ bzw. „synchron“; darunter der Verlauf als Graph mit Branch-/Tag-Marken, eigene Commits als „diese Session“, eingehende Commits als gestrichelte Zeile mit Pull |
| Dialoge | Wechsel mit offenen Änderungen (Abbrechen · Mitnehmen · Beiseitelegen und wechseln), Push abgelehnt (Pull, dann Push), Verwerfen |

## Entscheidungen, die der Entwurf vorschlägt

- **Git lebt in den Changes, nicht in der Kopfzeile:** die Kopfzeile bekommt nur die Anzeige (Branch-Pille), alle Handgriffe sitzen dort, wo die Dateien stehen.
- **Sperre bei arbeitendem Agenten:** Branch wechseln, Pull und Verwerfen warten, bis der Agent ruht — sie ändern Dateien unter ihm. Commit und Push bleiben frei.
- **Eigene Änderungen vorab angehakt, fremde nicht:** nutzt die vorhandene Zuordnung der Changes (ADR 014), damit ein Commit nicht versehentlich Fremdes mitnimmt.
- **Anzeige aus Git, nie aus dem Agenten** (Critical Rule 2).

## Offene Fragen

- Pille in der Kopfzeile: nur das erste Repository plus „+N“, oder alle nebeneinander bis zu einer Grenze?
- Verlauf über alle Branches oder nur den aktuellen als Standard?
- Fremde Änderungen: heute zeigen die Changes sie gar nicht — reicht die zugeklappte Zeile, oder sollen sie erst mit einem Schalter erscheinen?
