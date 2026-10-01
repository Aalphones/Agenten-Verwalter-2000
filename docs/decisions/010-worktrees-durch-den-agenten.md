# 010 — Worktrees entscheidet der Agent: Haupt-Checkout per `--add-dir`, Ticket-Worktrees nach seiner Namensregel

**Status:** angenommen · **Datum:** 2026-09-30

## Kontext

Bisher legte die App pro Session und Repository einen Worktree mit Branch `verwalter/<slug>` an ([ADR 005](005-repositories-und-worktrees.md)). Das Regelwerk des Agenten (`CLAUDE.md`, Skills) soll aber selbst entscheiden, ob er direkt im Haupt-Checkout arbeitet oder in einem Ticket-Worktree mit Ticket-Branch. Die Namensregel dieses Regelwerks ist ein Nachbarordner `<repo>-wt-<Name>` neben dem Haupt-Checkout. Mehrere Sessions können nacheinander denselben Ticket-Worktree bearbeiten, und das Merge-Gate braucht den ganzen Branch gegen den Standard-Branch, nicht nur die Änderungen einer Session.

## Optionen

- **Wo der Agent arbeitet:** (a) App-Worktree wie bisher; (b) Schalter in „Neue Session“; (c) Haupt-Checkout per `--add-dir`, Ticket-Worktrees nach der Namensregel des Agenten freigegeben (`--allowedTools`) und der Session zugeordnet, sobald ihr Agent sie benutzt; (d) wie (c), aber Worktrees im Session-Ordner mit Ortsvorgabe im Systemprompt.
- **Welche Ticket-Worktrees zur Session gehören:** (1) alle `-wt-`-Worktrees des Repositorys; (2) die seit Session-Start neuen; (3) die vom Agenten der Session benutzten.

## Entscheidung

- **(c) mit (3).** Gegen (b) spricht, dass die Regel im Agenten-Regelwerk steht und nicht pro Session geklickt wird. Gegen (d) spricht, dass das Regelwerk den Ort festlegt und die App sich danach richtet; außerdem schreibt Claude den Systemprompt bei der ersten Anfrage einer Unterhaltung fest (`--system-prompt-snapshot`). Gegen (1) und (2) spricht, dass parallele Sessions auf demselben Repository sonst fremde Tickets sehen.
- **Freigabe per `--allowedTools`:** je Haupt-Checkout `Edit(//<laufwerk>/<elternordner>/<repo>-wt-*/**)` und `Read(…)` mit demselben Muster. Belegt am 2026-09-30 mit Claude Code 2.1.284: Ohne Freigabe verweigert Claude Schreibzugriffe im Nachbarordner. Mit der Regel liest und schreibt er im Modus „Automatisch bearbeiten“ ohne Rückfrage; ein anderer Nachbarordner bleibt gesperrt. `Edit`-Regeln decken alle Schreibwerkzeuge ab, `Write(…)` ignoriert Claude.
- **Ticket-Worktrees werden gegen den Standard-Branch gemessen**, nicht gegen den Session-Start.
- **Alte Sessions behalten ihre App-Worktrees.** Die Spalte `session_repositories.checkout` unterscheidet `app_worktree` (Standardwert, alle Sessions vor dieser Entscheidung) von `main`.

## Konsequenzen

- Die Sicherheitsgrenze umfasst die Haupt-Checkouts und alle `<repo>-wt-*`-Nachbarordner der Session-Repositories.
- Parallele Sessions auf demselben Repository teilen sich den Haupt-Checkout; die App verhindert das nicht.
- Die App hängt an der Namensregel `-wt-` (Konstante `TICKET_WORKTREE_INFIX`). Ändert das Regelwerk sie, muss die App nachziehen.
- Ein Ticket-Worktree erscheint in einer Session erst, wenn ihr Agent ihn benutzt hat.
- Die App räumt Ticket-Worktrees nie auf.
- Enthält ein Pfad Glob-Zeichen (`*`, `?`, `[`), greift die Freigabe nicht zuverlässig.
- ADR 005 gilt nur noch für Sessions vor dieser Entscheidung.
- Ordner ohne Git ([ADR 018](018-ordner-ohne-git.md)) haben weder Ticket-Worktrees noch Freigaben.
