# Offene Recherchefragen

Fragen, die noch nicht geklärt sind und Recherche oder einen Durchstich brauchen. Architekturentscheidungen stehen in [../PROJECT.md](../PROJECT.md) unter „Offene Fragen“; hier landen die Detailfragen dazu.

- **Claude-Kommandozeile im JSON-Stream-Modus:** welche Event-Typen kommen, wie werden Rückfragen und Rechte-Abfragen signalisiert, wie lässt sich ein laufender Agent unterbrechen und eine Session fortsetzen? (2026-09-28)
- **Claude Agent SDK:** deckt es Unterbrechen/Fortsetzen und Rückfragen besser ab als die Kommandozeile, und was kostet ein Node-Hilfsprozess pro Agent an Speicher? (2026-09-28)
- **Tauri 2 unter Windows:** wie verhalten sich Kindprozesse, wenn das Fenster abstürzt — laufen sie weiter oder werden sie mitbeendet? (2026-09-28)
- **Skills in einer Session mit mehreren Repositories:** Claude sucht Projekt-Skills im `.claude/skills` des Startordners. Der Agent startet im Session-Workspace oberhalb der Repositories — findet er die Skills aus `<repo>/.claude/skills` dort von selbst, oder muss die App sie ihm zuführen (und wie, ohne die Repositories zu verändern)? Wie listet die App die verfügbaren Skills samt Beschreibung für das `/`-Menü? (2026-09-28)
- **Anhänge:** welche Dateiarten nimmt der gewählte Anbindungsweg als Teil einer Nachricht an (Bilder sicher? PDFs? beliebige Textdateien?), und gibt es Größengrenzen? (2026-09-28)
- **Artefakte:** kann der Agent aus der App heraus Artefakte veröffentlichen, woran erkennt die App ein neu erstelltes Artefakt im Event-Strom, und lässt sich die Vorschau ohne erneute Anmeldung in die App einbetten — sonst nur „Im Browser öffnen“? (2026-09-28)
- **Modell, Denkaufwand und Modus mitten in der Session:** lassen sie sich zwischen zwei Nachrichten wechseln, ohne den Agenten neu zu starten und den Verlauf zu verlieren? (2026-09-28)
- **Hintergrund:** wie meldet der Agent gestartete Hintergrundprozesse (Dev-Server) und Subagenten im Event-Strom, lässt sich ihre Ausgabe mitlesen und ein Prozess von der App aus beenden? Wo liegt der Scratchpad-Ordner einer Session — legt die App ihn an und teilt ihn dem Agenten mit, und liegt er innerhalb oder außerhalb des Session-Workspace (Sicherheitsgrenze)? (2026-09-28)
