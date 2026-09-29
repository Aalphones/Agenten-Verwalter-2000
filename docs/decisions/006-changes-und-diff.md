# 006 — Changes und Diff: drei Blickwinkel gegen die Basis, nur Plumbing, eigener Diff, Nachladen statt Beobachten

**Status:** angenommen · **Datum:** 2026-09-29

## Kontext

Meilenstein 5 zeigt, was der Agent in den Worktrees einer Session geändert hat — über alle Repositories der Session, mit Dateibaum, Übersicht und dem Unified Diff einer Datei ([PROJECT.md](../PROJECT.md), [Entwurf](../design/2026-09-28_hauptansichten/README.md), Tafeln `Changes` und `Diff`). Die Anzeige stammt aus Git, nie aus Aussagen des Agenten (AGENTS.md, Regel 2). Randbedingung: Der Agent arbeitet gleichzeitig im selben Worktree und committet dort selbst; die App liest mit, während er schreibt. Basis ist `base_commit` aus [ADR 005](005-repositories-und-worktrees.md).

## Optionen

- **Blickwinkel:** (a) nur „alles seit der Basis“; (b) drei Blickwinkel — alles, nur committet, nur uncommitted.
- **Diff-Quelle:** (a) `git diff` und `git status`; (b) nur Plumbing-Befehle (`diff-index`, `diff-tree`, `ls-files`, `rev-list`).
- **Umbenennungen:** (a) erkennen (`-M`); (b) abschalten (`--no-renames`).
- **Anzeige des Diffs:** (a) Monaco Diff Editor; (b) eigene Zeilen, die der Core fertig liefert, virtualisiert gerendert.
- **Aktualisieren:** (a) Dateisystem-Beobachter je Worktree; (b) Nachladen bei Anlass (Session gewählt, Status geändert, Fenster fokussiert) plus 5-s-Takt, solange der Reiter offen ist und der Agent arbeitet.

## Entscheidung

- **(b) Drei Blickwinkel, alle gegen `base_commit`.** `all` = Basis → Arbeitsverzeichnis plus untracked Dateien; `committed` = Basis → `HEAD` des Session-Branches; `uncommitted` = `HEAD` → Arbeitsverzeichnis plus untracked Dateien, gestagte Änderungen zählen als uncommitted. Der Core liefert je Datei die Zahlen aller drei Blickwinkel auf einmal; die Oberfläche schaltet nur um. Eine Datei, die committet angelegt und danach uncommitted gelöscht wurde, fehlt unter „Alle“ und steht unter beiden anderen — das ist korrekt.
- **(b) Nur Plumbing.** Belegt am 2026-09-29 im Git-Quelltext (`builtin/diff.c`, `refresh_index_quietly`): `git diff` nimmt bei angefassten, aber inhaltlich gleichen Dateien kurz die Sperre `index.lock` und beachtet dabei `GIT_OPTIONAL_LOCKS` nicht — ein gleichzeitiges `git commit` des Agenten scheitert dann mit „index.lock exists“. Plumbing liest nur. Zusätzlich setzt `git/` für jeden Aufruf `GIT_OPTIONAL_LOCKS=0`.
- **Dateimenge aus `--numstat`, Art aus `--name-status`.** Belegt am 2026-09-29 mit Git 2.55: `diff-index --name-status` meldet eine nur angefasste Datei als `M`, `--numstat` lässt sie weg. Eine Datei, die nur in `--name-status` steht, wird verworfen.
- **Untracked Dateien** kommen aus `ls-files --others --exclude-standard` und zählen als neu angelegt. Ihre Zeilen zählt der Core selbst; über 8 MiB oder mit einem NUL-Byte in den ersten 8000 Bytes gelten sie als binär.
- **(b) `--no-renames`.** Die Erkennung rät über Ähnlichkeit, kostet Zeit und der Entwurf kennt nur A/M/D.
- **(b) Eigener Diff.** Der Entwurf verlangt zwei 48-px-Nummernspalten, eine 20-px-Vorzeichenspalte, Abschnittsköpfe auf eigenem Hintergrund und 20 px Zeilenhöhe — das bildet Monaco nicht ab, und es brächte mehrere MB sowie die vollständigen Dateiinhalte beider Seiten mit. Der Core liefert Zeilen (Art, alte Nummer, neue Nummer, Text), die Oberfläche rendert sie mit `@tanstack/react-virtual`. Höchstens 20 000 Zeilen je Diff, danach „Gekürzt …“.
- **(b) Nachladen statt Beobachten.** Ein Beobachter kostet je Worktree Ressourcen, auch wenn niemand hinsieht. Gemessen am 2026-09-29: alle Lese-Aufrufe eines Repositorys mit rund 900 Dateien brauchen zusammen etwa 0,8 s.
- **Nur lesen.** Die Changes-Ansicht legt keine Worktrees an und repariert nichts; ein fehlender Worktree wird gemeldet. Die Reparatur bleibt bei `worktrees::ensure` vor dem Agent-Start.
- **Ein Repository, ein Thread.** Die Repositories einer Session werden nebeneinander gelesen; ein Fehler trifft nur den Eintrag seines Repositorys.

## Konsequenzen

- Eine umbenannte Datei erscheint doppelt: gelöscht (D) und neu (A).
- Änderungen des Agenten erscheinen bis zu 5 s verzögert.
- Keine Syntaxfarben im Diff.
- Der Monaco Diff Editor entfällt aus dem Stack.
- Artefakte gehören nicht zu Meilenstein 5; ob die Claude-Kommandozeile sie überhaupt meldet, ist offen.
- „Basis für Changes“ als Einstellung folgt in Meilenstein 6; bis dahin gilt `base_commit`.
