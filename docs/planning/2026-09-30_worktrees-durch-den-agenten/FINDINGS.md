# Findings

Format: `- [ ] → Phase N: <Erkenntnis>` — offen, bis die genannte Phase sie aufgreift.

- [ ] → Phase 4: Texte in `ChangesToolbar.tsx` passen nicht zu Ticket-Worktree-Einträgen: `BASE_TITLE` („gegen diesen Stand werden alle Änderungen der Session gemessen") und der Titel von „Committed" („Schon als Commit im Session-Branch"). Ein Ticket-Worktree wird gegen den Standard-Branch gemessen und enthält Änderungen mehrerer Sessions; im Haupt-Checkout gibt es keinen Session-Branch mehr.
