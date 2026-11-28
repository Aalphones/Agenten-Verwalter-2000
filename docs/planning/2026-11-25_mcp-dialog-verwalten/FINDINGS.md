# Findings

Format: `- [ ] → Phase N: <Erkenntnis>` — offen für eine spätere Phase; `[x]`, sobald dort erledigt.

- [ ] → Phase 5: `mcp_probe`/`mcp_inspect` melden auch „nicht mehr vorhanden“ und „Wert für X fehlt“ als `error` im Ergebnis (nicht als `CommandError`); der Lauf dauert bis zu 20 s, die Fehlersätze können mehrzeilig sein (stderr-Ende eines stdio-Servers).
- [ ] → Phase 5: gesperrt warten „Server hinzufügen“ (Werkzeugzeile und Leerzustand, `renderAddButton`), „Hier hinzufügen“ (`renderLocalEmpty`, Ziel „nur ich“) und „Bearbeiten“ (`McpServerRow`); im Leerzustand fehlt der Hinweis „Oder JSON einfügen“ aus dem Entwurf. Knöpfe: Klassen `.mcp-dialog__button*`.
- [ ] → Phase 5: die Werkzeugnamen-Chips in `McpServerDetails` durch „Werkzeuge & Anweisungen ansehen“ ersetzen; fest eingebundene Zeilen haben keine `sourceId` (kein `mcp_inspect`), dort bleiben nur die Namen aus `live.tools`.
- [ ] → Phase 5: wird beim Bearbeiten ein Server umbenannt, den alten Namen wie beim Entfernen merken (`removedNames` in `useUndoableRemoval.ts`), sonst steht er bis zum Neustart des Agenten unter „Fest eingebunden“.
