# Findings

Format: `- [ ] → Phase N: <Erkenntnis>`

- [x] → Phase 3: `openItem` in `src/stores/background.ts` hat keinen Aufrufer mehr. Der Chat nutzt aus `features/background/`: `backgroundLabels`, `OutputPane` (+ CSS), `outputNotice`, `useStickToBottom`, `useItemOutput`, `useNow`, `useCopyFeedback`; diese beim Löschen behalten. `stepLines` samt Textschritt-Filter fällt mit `SubagentsTab`.
