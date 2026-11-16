# Findings

Format: `- [ ] → Phase N: <Erkenntnis>` (offen) bzw. `- [x] → Phase N: <Erkenntnis> (erledigt in <Commit>)`.
- [ ] → Phase 4: `SettingsChange::SkinAnimations` trägt `bool` (Kontrakt); der Zustand „folgt Windows“ (`None`) ist darüber nicht wieder herstellbar. Braucht die Seite einen Knopf dafür, die Änderung auf `Option<bool>` ziehen.
- [ ] → Phase 3: `skins_tool_usage` und `SkinPackSummary` kennen keine Zuordnung Werkzeug → eingebautes Fach; die liefert `src/features/skins/slotCatalog`. Das Muster `tools` eines eigenen Fachs prüft der Core nur auf Länge, nicht auf Syntax.
