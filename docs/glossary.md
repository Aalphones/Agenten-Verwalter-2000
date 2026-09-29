# Glossar

Ein Begriff = eine Bedeutung. Code, Doku und Oberfläche verwenden diese Begriffe konsistent. Englische Bezeichner im Code, deutsche Erklärung hier. Neue Fachbegriffe werden ergänzt, sobald sie abgeklärt sind.

| Begriff | Bedeutung |
|---|---|
| **Session** | Eine Aufgabe (z.B. „OAuth Login implementieren“) mit ihrem Agenten, ihrem Chat, ihren Events und ihren Repositories. Die zentrale Einheit der App. |
| **Repository** | Ein lokales Git-Repository, das in der App bekannt ist (Name, Pfad, Remote). Existiert unabhängig von Sessions. Die App kennt es, sobald es einmal über „Repository hinzufügen“ gewählt wurde; gespeichert ist der Wurzelordner. |
| **RepositoryWorkspace** | Die Verbindung eines Repositorys mit einer Session: eigener Worktree, eigener Branch, eigene Basis. |
| **Worktree** | Ein zusätzliches Arbeitsverzeichnis eines Git-Repositorys mit eigenem ausgecheckten Branch (`git worktree`). Pro Session und Repository genau einer. |
| **Workspace** | Der gemeinsame Ordner einer Session, in dem die Worktrees aller ihrer Repositories nebeneinander liegen. Arbeitsverzeichnis und Sicherheitsgrenze des Agenten. |
| **Workspace Contract** | Die feste Ordnerstruktur, die der Agent sieht: ein Unterordner pro Repository, sonst nichts. |
| **Base ref** | Der Git-Stand, gegen den Änderungen gemessen werden (z.B. `origin/main`). Pro RepositoryWorkspace. |
| **Committed / Uncommitted** | Änderungen seit der Basis, die bereits als Commit im Session-Branch liegen bzw. nur im Arbeitsverzeichnis. |
| **Agent** | Der externe Coding-Agent-Prozess (z.B. Claude), der in einer Session arbeitet. Die App orchestriert ihn, ist aber nicht selbst der Agent. |
| **Provider** (`AgentProvider`) | Adapter, der einen bestimmten Agenten-Typ startet, steuert und seine Ausgaben in einheitliche Agent-Events übersetzt (Claude, später OpenCode, LM Studio). |
| **Agent-Event** | Ein strukturiertes Ereignis aus dem Agentenlauf oder der App (z.B. `tool.started`, `session.waiting`). Wird im Event Store gespeichert und von der UI in lesbare Zustände übersetzt. |
| **Event Store** | Ursprünglich als Tabelle `events` mit allen Zustandsänderungen einer Session gedacht. Umgesetzt ist er als Tabelle `chat_entries`: eine Zeile je Chat-Eintrag, wie ihn die Oberfläche anzeigt; rohe Agent-Ereignisse werden nicht gespeichert ([ADR 004](decisions/004-persistenz-und-wiederherstellung.md)). |
| **Session-Status** | Zustand einer Session, sieben Werte: `starting` (Prozess gestartet, noch kein `system/init`), `running` (Agent arbeitet an einer Antwort), `waiting` (offene Rückfrage oder Rechte-Abfrage), `paused` (nach Pause/Esc oder nach „Agent neu starten“), `completed` (Antwort fertig, Agent wartet auf die nächste Nachricht), `cancelled` (abgebrochen, nimmt keine Nachrichten mehr an), `error` (Prozess unerwartet beendet oder Antwort mit Fehler). Eine Unterbrechung ist immer `paused`. Nach einem App-Neustart ist eine vorher aktive Session (`starting`, `running`, `waiting`) `paused`; ihr Agent startet mit der nächsten Nachricht neu. |
| **Waiting** | Der Agent hat eine Rückfrage oder Rechte-Abfrage gestellt und wartet auf eine Antwort im Chat. Eigener Status, prominent in der Session-Liste. |
| **Archivieren** | Blendet eine Session aus der Liste aus (`archived_at` in der Datenbank gesetzt). Verlauf und Arbeitsordner bleiben erhalten; keine eigene Archiv-Ansicht. |
| **Rechte-Abfrage** | Der Agent fragt vor einem Werkzeug-Aufruf um Erlaubnis; erscheint im Chat wie eine Rückfrage mit Erlauben/Ablehnen. |
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
