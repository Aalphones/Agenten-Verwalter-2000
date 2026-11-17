# FINDINGS

Erkenntnisse aus der Umsetzung, die eine spätere Phase betreffen. Format: `- [ ] → Phase N: <Erkenntnis>`; erledigt abhaken.

- [ ] → Phase 5: `backgroundByToolUseId` (`indexByToolUseId` in `src/features/background/backgroundItems.ts`) enthält nur Einträge der Art `process` und `subagent`. Die Dauer eines Befehls (AK 5) braucht eine eigene Zuordnung über die Einträge der Art `command`; nimmt man sie in dieselbe Map auf, löst `buildBlocks` jeden Befehl als Hintergrund-Zeile aus der Gruppe.
- [ ] → Phase 7: `ToolGroup.tsx` und `toolSummary.ts` sind nach Phase 2 und 5 schon geändert (`toolLabel`, `description`, `durationMs`, `tool-group__duration`); vor dem Umbau den Stand lesen, nicht den aus dem Plan annehmen.

