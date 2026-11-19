# FINDINGS

Erkenntnisse aus der Umsetzung, die eine spätere Phase betreffen. Format: `- [ ] → Phase N: <Erkenntnis>`; erledigt abhaken.

- [ ] → Phase 5: `backgroundByToolUseId` (`indexByToolUseId` in `src/features/background/backgroundItems.ts`) enthält nur Einträge der Art `process` und `subagent`. Die Dauer eines Befehls (AK 5) braucht eine eigene Zuordnung über die Einträge der Art `command`; nimmt man sie in dieselbe Map auf, löst `buildBlocks` jeden Befehl als Hintergrund-Zeile aus der Gruppe.
- [ ] → Phase 7: `ToolGroup.tsx` und `toolSummary.ts` sind nach Phase 2 und 5 schon geändert (`toolLabel`, `description`, `durationMs`, `tool-group__duration`); vor dem Umbau den Stand lesen, nicht den aus dem Plan annehmen.

- [ ] → Phase 2: `remember_bash` (`translate.rs`) merkt nur Aufrufe von `Bash`, nicht `PowerShell`. Ein PowerShell-Befehl im Vordergrund bekommt deshalb keinen Eintrag `Command` und kein `CommandStarted`; meldet die Kommandozeile für ihn ein `task_started` (`local_bash`), entsteht wie bisher ein Eintrag `Process` (dann der einzige). Wer `CommandStarted.description` einführt, entscheidet, ob PowerShell mitkommt — dann greift Phase 1 auch für PowerShell.
- [ ] → Phase 4: PowerShell-Vordergrund-Befehle haben kein `CommandStarted` (Phase 2 hat `remember_bash` bewusst nicht erweitert); der Fortschritt aus der Ausgabedatei greift dort nur, wenn die Kommandozeile ein `task_started` für sie meldet. Vor dem Bau am echten PowerShell-Lauf messen.
