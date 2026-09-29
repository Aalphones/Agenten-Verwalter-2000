# Findings — Meilenstein 2b Anhänge, Skills, Hintergrund

Erkenntnisse aus der Umsetzung, getaggt nach Ziel-Phase:

```text
- [ ] → Phase N: <Erkenntnis>
```

- [ ] → Phase 4: `ChatEntry` (`kind: 'user'`) hat `attachments: Attachment[]` als **Pflichtfeld**, nicht optional — der Core füllt alte Einträge beim Laden mit `[]` und schickt das Feld immer. `entry.attachments ?? []` ist unnötig. `Attachment.sizeBytes` ist `number`.
- [ ] → Phase 4: AK 2, 3, 5, 6 aus Phase 1 (Anhänge landen im Zwischenordner, wandern beim Senden nach `<Workspace>\.anhaenge`, Ablehnung bei offener Rückfrage, Zwischenordner nach Neustart leer) sind nur am Code geprüft. Beim ersten Lauf mit der neuen Eingabeleiste einmal gezielt mitprüfen.
- [ ] → Phase 2: `SessionState::push_user(outbox, text, attachments)` ist der eine Ort, an dem `skill` dazukommt. `SessionRegistry::create` nimmt `NewSession { task, attachment_ids, repository_ids, model, effort, mode }`; die Skill-Liste für „Neue Session“ läuft ohnehin über `skill_list_for_repositories`.
