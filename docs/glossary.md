# Glossar

Ein Begriff = eine Bedeutung. Code, Doku und Oberfläche verwenden diese Begriffe konsistent. Englische Bezeichner im Code, deutsche Erklärung hier. Neue Fachbegriffe werden ergänzt, sobald sie abgeklärt sind.

| Begriff | Bedeutung |
|---|---|
| **Session** | Eine Aufgabe (z.B. „OAuth Login implementieren“) mit ihrem Agenten, ihrem Chat, ihren Events und ihren Repositories. Die zentrale Einheit der App. |
| **Repository** | Ein lokales Git-Repository, das in der App bekannt ist (Name, Pfad, Remote). Existiert unabhängig von Sessions. |
| **RepositoryWorkspace** | Die Verbindung eines Repositorys mit einer Session: eigener Worktree, eigener Branch, eigene Basis. |
| **Worktree** | Ein zusätzliches Arbeitsverzeichnis eines Git-Repositorys mit eigenem ausgecheckten Branch (`git worktree`). Pro Session und Repository genau einer. |
| **Workspace** | Der gemeinsame Ordner einer Session, in dem die Worktrees aller ihrer Repositories nebeneinander liegen. Arbeitsverzeichnis und Sicherheitsgrenze des Agenten. |
| **Workspace Contract** | Die feste Ordnerstruktur, die der Agent sieht: ein Unterordner pro Repository, sonst nichts. |
| **Base ref** | Der Git-Stand, gegen den Änderungen gemessen werden (z.B. `origin/main`). Pro RepositoryWorkspace. |
| **Committed / Uncommitted** | Änderungen seit der Basis, die bereits als Commit im Session-Branch liegen bzw. nur im Arbeitsverzeichnis. |
| **Agent** | Der externe Coding-Agent-Prozess (z.B. Claude), der in einer Session arbeitet. Die App orchestriert ihn, ist aber nicht selbst der Agent. |
| **Provider** (`AgentProvider`) | Adapter, der einen bestimmten Agenten-Typ startet, steuert und seine Ausgaben in einheitliche Agent-Events übersetzt (Claude, später OpenCode, LM Studio). |
| **Agent-Event** | Ein strukturiertes Ereignis aus dem Agentenlauf oder der App (z.B. `tool.started`, `session.waiting`). Wird im Event Store gespeichert und von der UI in lesbare Zustände übersetzt. |
| **Event Store** | Die SQLite-Tabelle `events`: fortlaufendes Protokoll aller relevanten Zustandsänderungen einer Session. |
| **Session-Status** | Zustand einer Session in der festen State Machine: `CREATED`, `STARTING`, `RUNNING`, `WAITING`, `PAUSED`, `INTERRUPTED`, `COMPLETED`, `CANCELLED`, `ERROR`. |
| **Waiting** | Der Agent hat eine Rückfrage gestellt und wartet auf eine Antwort im Chat. Eigener Status, prominent in der Session-Liste. |
| **Tool-Aktivität** | Die Einzelschritte des Agenten (Datei lesen, Befehl ausführen …). Im Chat standardmäßig eingeklappt zusammengefasst. |
| **Chat-Ansicht** | Hauptansicht einer Session: Gespräch mit dem Agenten, Status, Rückfragen. |
| **Changes-Ansicht** | Prüfansicht einer Session: geänderte Repositories, Dateien und Diffs gegen die Basis. |
| **Anhang** | Bild oder Datei, die mit einer Nachricht an den Agenten geht (per Knopf, Hineinziehen oder Einfügen). |
| **Skill** | Eine benannte, wiederverwendbare Arbeitsanweisung für den Agenten, aufgerufen mit `/name`. Herkunft: Benutzerordner oder `.claude/skills` eines Repositorys der Session. |
| **Modus** | Wie selbstständig der Agent arbeitet: Manuell, Automatisch bearbeiten, Planen, Auto. Pro Session, jederzeit wechselbar. |
| **Denkaufwand** | Wie gründlich das Modell nachdenkt, fünf Stufen von Niedrig bis Max. Pro Session, jederzeit wechselbar. |
| **Artefakt** | Etwas, das der Agent in einer Session zum Ansehen erstellt und veröffentlicht (Design, Diagramm, Seite). Im Reiter „Artefakte“ der Session. |
| **Subagent** | Ein vom Agenten selbst gestarteter Hilfs-Agent für eine Teilaufgabe. Läuft innerhalb der Session, wird dort angezeigt. |
| **Hintergrundprozess** | Ein vom Agenten gestarteter Prozess, der weiterläuft, während der Agent arbeitet (z.B. ein Dev-Server). |
| **Scratchpad** | Der temporäre Ablageordner einer Session für Zwischenergebnisse des Agenten, die nicht ins Repository gehören. |
| **Core** | Der Rust-Teil der App (`src-tauri/`): Prozesse, Git, Datenbank, Dateisystem. Die React-Oberfläche spricht nur über Tauri Commands und Events mit ihm. |
