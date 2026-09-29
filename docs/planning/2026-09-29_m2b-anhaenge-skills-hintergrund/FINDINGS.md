# Findings — Meilenstein 2b Anhänge, Skills, Hintergrund

Erkenntnisse aus der Umsetzung, getaggt nach Ziel-Phase:

```text
- [ ] → Phase N: <Erkenntnis>
```

- [ ] → Phase 4: `ChatEntry` (`kind: 'user'`) hat `attachments: Attachment[]` als **Pflichtfeld**, nicht optional — der Core füllt alte Einträge beim Laden mit `[]` und schickt das Feld immer. `entry.attachments ?? []` ist unnötig. `Attachment.sizeBytes` ist `number`.
- [ ] → Phase 4: AK 2, 3, 5, 6 aus Phase 1 (Anhänge landen im Zwischenordner, wandern beim Senden nach `<Workspace>\.anhaenge`, Ablehnung bei offener Rückfrage, Zwischenordner nach Neustart leer) sind nur am Code geprüft. Beim ersten Lauf mit der neuen Eingabeleiste einmal gezielt mitprüfen.
- [ ] → Phase 5: Phase-3-AK 2–8 (Prozess mit Adresse, Anhalten, Exit-Code eines Vordergrund-Befehls, Subagent mit Modell/Schritten/Ergebnis, `interrupted` nach Abbruch und Neustart, Scratchpad-Liste/-Lesen inkl. Ablehnung von `../x`, Ruhe-Timer) sind nur am Code geprüft. Beim ersten Lauf mit dem Panel gezielt mitprüfen; ungeprüft ist vor allem, ob `task_started` vor oder nach dem `tool_result` kommt (Übersetzer fängt beides ab) und ob `system/*`-Zeilen Felder mit abweichendem Typ tragen.
- [ ] → Phase 5: `BackgroundItem.toolUseId` ist bei Prozess und Subagent der `tool_use_id` des Bash- bzw. `Agent`-Aufrufs — derselbe wie `toolUseId` der Werkzeug-Zeile im Chat (`ChatEntry` `kind: 'tool'`). Darüber findet die Verlaufszeile ihren Eintrag. Ein Vordergrund-Befehl hat `id == toolUseId`.
- [ ] → Phase 5: Ein Vordergrund-Befehl, den die Kommandozeile selbst in den Hintergrund schiebt, erscheint zweimal: als `command` (`completed`, Ausgabe = „Command running in background …“) und als `process`. Im Panel hinnehmen oder den `command` mit gleichem `toolUseId` wie ein `process` ausblenden — Entscheidung beim Bau.
- [x] → Phase 2: `SessionState::push_user(outbox, text, attachments)` ist der eine Ort, an dem `skill` dazukommt. `SessionRegistry::create` nimmt `NewSession { task, attachment_ids, repository_ids, model, effort, mode }`; die Skill-Liste für „Neue Session“ läuft ohnehin über `skill_list_for_repositories`.
