# FINDINGS — Kommentare an Artefakt und Bild

Format: `- [ ] → Phase N: <Erkenntnis>` — offen, bis die betroffene Phase sie aufgenommen hat.

- [ ] → Phase 2: `ReviewComment.target` ist im generierten TypeScript-Typ erforderlich und als diskriminierte Union (`diff` / `artifact` / `image`) abgebildet. Neue Konstruktoren müssen ihr Ziel setzen; der bestehende Diff-Einstieg setzt nun `{ kind: 'diff' }`.
