# Findings

Format: `- [ ] → Phase N: <Erkenntnis>`

- [ ] → Phase 3: Wartezustand liegt in `SessionRegistry.limit_resumes`; Zugriff über `lock_limit_resumes()` (`pub(super)` in `sessions/registry/implementation.rs`) — `stations_busy` dort oder in `registry.rs` mit `.any_waiting()` bauen. Sperre nie zusammen mit einer anderen halten.
- [ ] → Phase 4: `'waitsForLimit'` hat nur vorläufige Texte/Werte: `stationState.ts` (LABEL, ICON = `script`, TONE = `run`, URGENCY_RANK 4), `implementationTexts.ts` (`stateText`, `stationMeta`). Noch nicht aufgenommen in `LIVE_STATES`/`ACTIVE_STATES`/`BLOCKING_STATES` (`implementationOrder.ts`), `TICKING_STATES` (`SidebarStation.tsx`), Liste in `ImplementationView.tsx` und `phaseMeta` — ohne `LIVE_STATES` fehlt die wartende Station in der Sidebar. `resumesAt` (ms) für „weiter um HH:MM“.
