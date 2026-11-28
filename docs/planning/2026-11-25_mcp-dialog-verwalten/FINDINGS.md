# Findings

Format: `- [ ] → Phase N: <Erkenntnis>` — offen für eine spätere Phase; `[x]`, sobald dort erledigt.

- [ ] → Phase 5: `mcp_probe`/`mcp_inspect` melden auch „nicht mehr vorhanden“ und „Wert für X fehlt“ als `error` im Ergebnis (nicht als `CommandError`); der Lauf dauert bis zu 20 s, die Fehlersätze können mehrzeilig sein (stderr-Ende eines stdio-Servers).
