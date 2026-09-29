# Findings — Meilenstein 3 Repositories & Worktrees

Erkenntnisse aus der Umsetzung, getaggt nach Ziel-Phase:

```text
- [ ] → Phase N: <Erkenntnis>
```

- [x] → Phase 4: `worktrees::create_all` nimmt beim Fehlschlag das **gescheiterte** Repository mit in den Rückbau (`rollback(workspace, &planned[..=index])`): `git worktree add -b` kann Branch und Worktree schon angelegt haben, bevor es mit Fehler endet (etwa wenn ein `post-checkout`-Hook fehlschlägt). Das ist gefahrlos, weil der Branch vorher nachweislich frei war (`free_branch`) und der Workspace-Ordner frisch ist. Für die Probe zu AK 5 taugt genau das besser als ein von Hand belegter Zielordner (dessen Pfad kennt man vor dem Anlegen nicht, weil er aus der neuen Session-ID entsteht): im zweiten Repository `.git\hooks\post-checkout` mit `exit 1` anlegen.
- [x] → Phase 3: Ein gescheitertes Anlegen erreicht das Formular heute über den generischen Zweig von `describeStartError` als „Session konnte nicht starten: <Repository>: <Git-Meldung>“. Bei `repositoryMissing` steht dort nur der nackte Pfad (die serialisierte `message` ist der Variant-Inhalt, nicht der `Display`-Text), bei `gitNotFound` gar nichts Brauchbares — beide brauchen eigene Texte im Formular.
