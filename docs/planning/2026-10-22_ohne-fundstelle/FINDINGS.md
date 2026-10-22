# FINDINGS — Ohne Fundstelle

Format: `- [ ] → Phase N: <Erkenntnis>` — offen, bis die betroffene Phase sie aufgenommen hat.

- [ ] → Phase 3: `Settings.markUnsourced` fehlt in Phase 2 noch in den Bindings; `TextBlock` reicht `unsourced` deshalb ungefiltert durch. Beim Einführen des Schalters in `TextBlock` `useSettingsStore((state) => state.settings?.markUnsourced ?? true)` lesen und bei `false` `[]` an `Markdown` geben (AK 3 der Phase 2).
