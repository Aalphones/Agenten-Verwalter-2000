# Offene Recherchefragen

Fragen, die noch nicht geklärt sind und Recherche oder einen Durchstich brauchen. Architekturentscheidungen stehen in [../PROJECT.md](../PROJECT.md) unter „Offene Fragen“; hier landen die Detailfragen dazu.

- **Claude-Kommandozeile im JSON-Stream-Modus:** welche Event-Typen kommen, wie werden Rückfragen und Rechte-Abfragen signalisiert, wie lässt sich ein laufender Agent unterbrechen und eine Session fortsetzen? (2026-09-28)
- **Claude Agent SDK:** deckt es Unterbrechen/Fortsetzen und Rückfragen besser ab als die Kommandozeile, und was kostet ein Node-Hilfsprozess pro Agent an Speicher? (2026-09-28)
- **Tauri 2 unter Windows:** wie verhalten sich Kindprozesse, wenn das Fenster abstürzt — laufen sie weiter oder werden sie mitbeendet? (2026-09-28)
