# Agenten Verwalter 2000 — Vollständiges Produkt- und Technikkonzept

> **Agenten Verwalter 2000** ist eine lokale Desktop-Kommandozentrale für Coding-Agenten.  
> Eine Session repräsentiert eine Aufgabe und kann mehrere Git-Repositories mit isolierten Worktrees enthalten.  
> Der **Chat ist die primäre Arbeitsfläche**. Änderungen, Dateien und Diffs bilden die sekundäre Review-Ebene.

---

# 1. Executive Summary

Agenten Verwalter 2000 soll kein weiterer Code-Editor und kein „VS Code mit KI“ werden.

Die Anwendung löst ein anderes Problem:

Ein Entwickler startet mehrere Coding-Agenten parallel. Jeder Agent arbeitet an einer konkreten Aufgabe. Eine Aufgabe kann dabei mehrere Repositories betreffen, etwa:

- Backend
- Frontend
- Shared Types
- Infrastructure
- SDK

Heute bedeutet das häufig:

- mehrere Terminals
- mehrere Claude-Code-Sessions
- mehrere Git-Worktrees
- mehrere Editor-Fenster
- manuelles Zusammensuchen von Änderungen
- unklare Übersicht darüber, welcher Agent gerade was tut

Agenten Verwalter 2000 bündelt diesen Workflow.

Die Kernidee lautet:

```text
                    Agenten Verwalter 2000 Session
                         │
              „OAuth Login implementieren“
                         │
          ┌──────────────┼──────────────┐
          │              │              │
       backend        frontend      shared-types
          │              │              │
      worktree        worktree       worktree
          └──────────────┼──────────────┘
                         │
                       Agent
                         │
              Chat / Interaktion
                         │
                   Changes / Diff
```

Die wichtigste UX-Regel ist:

> **Chat first. Changes second.**

Der Benutzer verbringt die meiste Zeit im Gespräch mit dem Agenten. Code und Diff werden hauptsächlich zur Kontrolle und Review geöffnet.

---

# 2. Produktvision

Agenten Verwalter 2000 soll sich anfühlen wie:

> „Ich habe mehrere autonome Entwickler neben mir laufen und brauche eine einzige ruhige Oberfläche, um mit ihnen zu arbeiten und ihre Arbeit zu überprüfen.“

Nicht wie:

> „Ich habe noch einen Editor mit 37 Panels.“

Das bedeutet:

- geringe visuelle Dichte
- wenige Hauptbereiche
- klare Zustände
- progressive Offenlegung von Details
- kein permanenter Tool-Output
- keine unnötigen Dashboards
- keine IDE-Funktionalität, die nicht unmittelbar dem Agent-Workflow dient

---

# 3. Kernproblem

## Ausgangssituation

Ein Entwickler möchte gleichzeitig:

```text
Feature A → Claude
Feature B → Claude
Bug C     → lokales Modell
Refactor D → Claude
```

Feature A betrifft:

```text
backend/
frontend/
shared/
```

Feature B betrifft:

```text
backend/
frontend/
```

Ohne Orchestrierungsoberfläche entstehen schnell:

```text
Terminal 1
Terminal 2
Terminal 3
Terminal 4

VS Code window 1
VS Code window 2
VS Code window 3

Git worktree A
Git worktree B
Git worktree C
Git worktree D
```

Der eigentliche Engpass ist nicht die Rechenleistung des Agents.

Der Engpass ist:

> **Der Mensch kann die laufenden Agenten nicht mehr effizient überblicken und steuern.**

Agenten Verwalter 2000 löst genau diese Ebene.

---

# 4. Zielgruppe

Primär:

- Entwickler, die Claude Code oder ähnliche Coding-Agenten intensiv verwenden
- Entwickler mit mehreren parallelen Agent-Sessions
- Entwickler mit Multi-Repository-Systemen
- Entwickler, die Git-Worktrees bereits verwenden oder verwenden wollen
- Entwickler, die lokale Coding-Modelle ausprobieren
- Entwickler auf Laptops mit begrenzten Ressourcen

Sekundär:

- Entwicklerteams mit lokalen Agent-Workflows
- Power-User von OpenCode / Claude Code
- Entwickler, die Agent-Pipelines ausprobieren möchten

---

# 5. Nicht-Ziele

Agenten Verwalter 2000 ist zunächst **nicht**:

- eine vollständige IDE
- ein VS-Code-Ersatz
- ein Git-Client für alle denkbaren Git-Workflows
- ein Jira-/Linear-Ersatz
- ein CI/CD-Dashboard
- ein Cloud-Agent-Service
- ein kompletter LSP-Host
- ein Debugger
- ein Dev-Container-Manager
- ein generischer Chat-Client für alle LLMs
- eine Agent-Orchestrierungsplattform mit komplexer Workflow-DSL

Die erste Version soll ein einziges Problem außergewöhnlich gut lösen:

> **Coding-Agent-Sessions verwalten, mit ihnen arbeiten und ihre Änderungen nachvollziehen.**

---

# 6. Zentrale Produktprinzipien

## 6.1 Chat First

Der Chat ist der primäre Arbeitsbereich.

## 6.2 Changes Second

Code und Diff sind die Kontroll- und Review-Ebene.

## 6.3 One Session = One Task

Eine Session repräsentiert eine konkrete Aufgabe oder ein Feature.

## 6.4 One Session = N Repositories

Eine Aufgabe kann beliebig viele Repositories enthalten.

## 6.5 Agents are Workers

Agenten Verwalter 2000 ist nicht selbst der Agent. Agenten Verwalter 2000 orchestriert Agenten.

## 6.6 Git is Deterministic

Git- und Worktree-Operationen werden nicht von der KI-Logik abhängig gemacht.

## 6.7 Progressive Disclosure

Technische Details werden nur gezeigt, wenn sie benötigt werden.

## 6.8 Local First

Die Grundfunktionalität läuft lokal.

## 6.9 Low RAM by Design

Die Anwendung selbst soll möglichst wenig Ressourcen verbrauchen.

---

# 7. Die wichtigste UX-Entscheidung

Die Oberfläche hat zwei primäre Modi:

```text
┌─────────────────────────┐
│   CHAT   │   CHANGES    │
└─────────────────────────┘
```

## Chat

Hier passiert die eigentliche Arbeit:

- Aufgabe erklären
- Rückfragen beantworten
- Agenten beobachten
- Entscheidungen treffen
- Agenten steuern
- Ergebnisse diskutieren

## Changes

Hier wird kontrolliert:

- welche Repositories geändert wurden
- welche Dateien geändert wurden
- welcher Diff entstanden ist
- welche Änderungen committed sind
- welche Änderungen noch uncommitted sind

Die UI versucht nicht, beide Informationsarten permanent gleichzeitig zu zeigen.

---

# 8. Hauptfenster

Empfohlene Struktur:

```text
┌─────────────────────────────────────────────────────────────┐
│ Agenten Verwalter 2000                              Session / Model / Status │
├───────────────┬─────────────────────────────────────────────┤
│               │                                             │
│ Sessions      │                  Content                    │
│               │                                             │
│ ● OAuth Login │                 Chat / Changes              │
│               │                                             │
│ ● Payment     │                                             │
│               │                                             │
│ ○ Migration   │                                             │
│               │                                             │
│ ✓ Cleanup     │                                             │
│               │                                             │
│               │                                             │
│               │                                             │
├───────────────┴─────────────────────────────────────────────┤
│ optional compact session status                            │
└─────────────────────────────────────────────────────────────┘
```

Die linke Navigation bleibt schmal.

Die zentrale Fläche gehört vollständig dem aktuellen Arbeitsmodus.

---

# 9. Linke Navigation

Die Sidebar enthält Sessions.

Beispiel:

```text
Agenten Verwalter 2000

+ Neue Session

AKTIV

● OAuth Login
  3 Repositories · Claude

● Payment Refactor
  2 Repositories · Claude

● API Migration
  4 Repositories · Local

WARTEND

○ Design System
  1 Repository · Claude

ABGESCHLOSSEN

✓ User Management
✓ Bugfix Session
```

Die Sidebar soll keine große Repository-Verwaltung enthalten.

Repositories sind Kontext einer Session.

---

# 10. Session Header

Der Header enthält nur den notwendigsten Zustand:

```text
OAuth Login        ● Running

Implementiere OAuth Login für Plattform

Claude Sonnet
147k / 200k

[ Pause ] [ Abbrechen ]
```

Optional:

- Modell
- Context-Nutzung
- Laufzeit
- kompakte Kosteninformation
- Status

Keine großen KPI-Karten.

---

# 11. Chat-Ansicht

Die Chat-Ansicht nutzt möglichst viel horizontale und vertikale Fläche.

Beispiel:

```text
OAuth Login

Du

Implementiere den OAuth Login für unsere Plattform.

Backend und Frontend müssen beide angepasst werden.
Verwende den bestehenden Session-Mechanismus.

──────────────────────────────────────────────────

Claude

Ich analysiere zunächst die bestehende
Authentifizierung in allen Repositories.

[✓] Backend Auth-Modul analysiert
[✓] Frontend Login analysiert
[✓] Shared Types analysiert
[●] Implementierungsplan
[ ] OAuth Flow implementieren
[ ] Tests ausführen

Ich verwende den bestehenden Session-Service
und ergänze nur den OAuth-spezifischen Flow.

──────────────────────────────────────────────────

┌───────────────────────────────────────────────┐
│ Nachricht an Agent …                          │
│                                               │
│                                               │
│                                    [ Senden ] │
└───────────────────────────────────────────────┘
```

Die Eingabe soll groß genug sein, dass auch längere Anforderungen natürlich formuliert werden können.

---

# 12. Tool- und Agent-Aktivität

Technische Details werden kompakt visualisiert.

Beispiel:

```text
⌄ Analysiere 12 Dateien
✓ Auth Middleware gelesen
✓ OAuth Provider gefunden
● Implementiere Callback
```

Darunter kann bei Bedarf aufgeklappt werden:

```text
Read:
backend/src/auth/index.ts
backend/src/auth/session.ts
backend/src/auth/provider.ts
...
```

Dadurch bleibt der Chat lesbar.

---

# 13. Agent-Zustände

Agenten Verwalter 2000 braucht eine klare State Machine.

```text
CREATED
   ↓
STARTING
   ↓
RUNNING
   ├───────────────┐
   ↓               ↓
WAITING          ERROR
   ↓
RUNNING
   ↓
COMPLETED
```

Weitere Zustände:

```text
PAUSED
INTERRUPTED
CANCELLED
```

Die UI verwendet diese Zustände konsistent.

---

# 14. Agent wartet auf Benutzer

Wenn ein Agent eine Frage stellt, wird das als eigener Zustand behandelt.

```text
● OAuth Login
  wartet auf deine Antwort
```

Im Chat:

```text
Claude

Ich habe zwei bestehende Mechanismen gefunden.

Welche Variante soll verwendet werden?

[ Bestehenden AuthService verwenden ]

[ Separaten OAuth Session Service verwenden ]
```

Antworten müssen direkt aus dem Chat heraus möglich sein.

---

# 15. Changes-Ansicht

Die Changes-Ansicht ist die technische Kontrollinstanz.

Beispiel:

```text
OAuth Login

3 Repositories
24 Dateien
+1.214
-328

[ Alle Repositories ] [ Suche ]

backend
+823 -214

frontend
+341 -102

shared-types
+48 -12
```

Darunter:

```text
backend

M src/auth/oauth.ts          +42 -8
M src/auth/session.ts        +18 -3
A src/routes/oauth.ts        +91 -0

frontend

M src/components/Login.tsx   +28 -6
A src/auth/OAuthCallback.tsx +76 -0
```

---

# 16. Repository Filter

Eine Session mit drei Repositories darf niemals unübersichtlich werden.

Deshalb:

```text
Repositories

[ Alle ] [ backend ] [ frontend ] [ shared ]
```

Optional:

```text
[ Geändert ] [ Uncommitted ] [ Committed ]
```

---

# 17. Diff Viewer

Der Diff Viewer wird erst beim Öffnen einer Datei dominant.

```text
src/auth/oauth.ts

      main                     feature/oauth
─────────────────────────────────────────────

-     const code = req.query.code;

+     const code = req.query.code;
+     const state = req.query.state;

+     const valid =
+       await validateState(state);
```

Der Diff bekommt dann praktisch die gesamte Content-Fläche.

Kein permanenter Code-Editor.

---

# 18. Dateiübersicht

Dateien sind eine sekundäre Navigation.

Beispiel:

```text
backend

src/
  auth/
    oauth.ts           +42 -8
    session.ts         +18 -3
  routes/
    oauth.ts           +91 -0

frontend

src/
  auth/
    OAuthCallback.tsx  +76 -0
```

Die Dateiübersicht ist leichtgewichtig und virtuell renderbar.

---

# 19. Basis des Diffs

Die Standardbasis ist konfigurierbar:

```text
origin/main
origin/master
custom branch
```

Die Änderungen werden semantisch in zwei Gruppen betrachtet:

```text
BASE
 │
 ├── committed changes
 │
 └── working tree changes
```

Die UI kann beides zusammenfassen:

```text
Total

Committed
+1.080 -294

Uncommitted
+134 -34

Total
+1.214 -328
```

---

# 20. Multi-Repository Session

Eine Session ist die eigentliche Domäne.

Datenmodell:

```text
Session
│
├── Agent
├── Messages
├── Events
├── Settings
│
└── RepositoryWorkspace[]
    ├── Repository
    ├── Worktree
    ├── Branch
    └── DiffState
```

Beispiel:

```text
OAuth Login
│
├── Agent: Claude
│
├── backend
│   ├── repo: backend
│   ├── branch: feature/oauth-backend
│   └── worktree: ~/.forge/workspaces/oauth/backend
│
├── frontend
│   ├── repo: frontend
│   ├── branch: feature/oauth-frontend
│   └── worktree: ~/.forge/workspaces/oauth/frontend
│
└── shared
    ├── repo: shared-types
    ├── branch: feature/oauth-types
    └── worktree: ~/.forge/workspaces/oauth/shared
```

---

# 21. Worktree-Erstellung

Beim Start einer Session:

```text
Neue Session

Name
OAuth Login

Repositories

☑ backend
☑ frontend
☑ shared-types

Basis
origin/main

Branch Prefix
feature/oauth

[ Session erstellen ]
```

Agenten Verwalter 2000 erstellt automatisch:

```text
~/.forge/workspaces/oauth-login/
├── backend/
├── frontend/
└── shared-types/
```

---

# 22. Workspace Contract

Der Agent erhält einen klar definierten Workspace.

Beispielsweise:

```text
/workspace/
├── backend/
├── frontend/
└── shared-types/
```

Der Agent kann damit die Beziehungen zwischen den Repositories erkennen.

Wichtig:

Die Repositories bleiben technisch unabhängig.

Es gibt:

- getrennte Git-Historien
- getrennte Branches
- getrennte Worktrees

Agenten Verwalter 2000 stellt nur einen gemeinsamen Arbeitskontext bereit.

---

# 23. Git-Service

Git wird als eigene Komponente implementiert.

```ts
interface GitService {
  createWorktree(...): Promise<Worktree>;
  removeWorktree(...): Promise<void>;

  createBranch(...): Promise<void>;
  deleteBranch(...): Promise<void>;

  status(...): Promise<GitStatus>;
  diff(...): Promise<Diff>;

  log(...): Promise<Commit[]>;
  commit(...): Promise<Commit>;
}
```

Der Agent kann Git-Befehle ausführen, aber Agenten Verwalter 2000 benötigt seine eigene deterministische Sicht auf den Git-Zustand.

---

# 24. Agent-Provider

Die Anwendung bleibt provider-agnostisch.

```ts
interface AgentProvider {
  start(session: Session): Promise<void>;

  sendMessage(
    sessionId: string,
    message: string
  ): Promise<void>;

  interrupt(
    sessionId: string
  ): Promise<void>;

  resume(
    sessionId: string
  ): Promise<void>;

  stop(
    sessionId: string
  ): Promise<void>;

  getStatus(
    sessionId: string
  ): Promise<AgentStatus>;

  subscribe(
    sessionId: string,
    listener: (event: AgentEvent) => void
  ): () => void;
}
```

Implementierungen:

```text
AgentProvider
├── ClaudeCodeProvider
├── OpenCodeProvider
└── LMStudioProvider
```

---

# 25. Claude Integration

Claude ist zunächst der wichtigste Provider.

Die Anwendung sollte nach Möglichkeit strukturierte Agent-Events verwenden.

Beispielsweise:

```text
session.started
assistant.message
tool.started
tool.completed
subagent.started
subagent.completed
session.waiting
session.completed
session.error
```

Die UI übersetzt diese Events in lesbare Zustände.

Die Chat-Historie wird nicht als gigantischer React-State gehalten.

---

# 26. Lokale Modelle

LM Studio kann als lokaler Provider eingebunden werden.

Beispiel:

```text
Provider
[ LM Studio ]

Model
[ Qwen Coder ]
```

Die gleiche Session-UI bleibt erhalten.

Der Provider kümmert sich um die Unterschiede des jeweiligen Agent-Runtimes.

Agenten Verwalter 2000 selbst soll möglichst wenig provider-spezifische Logik enthalten.

---

# 27. Multi-Agent

Eine Session kann später mehrere Agents enthalten:

```text
OAuth Login

Main Agent
Claude Sonnet
Implementierung

Review Agent
Local Model
Review

Test Agent
Local Model
Tests
```

Das ist zunächst ein Architekturziel und kein MVP-Feature.

---

# 28. Agent Pipeline

Später kann eine Session eine Pipeline abbilden:

```text
PLAN
 ↓
IMPLEMENT
 ↓
TEST
 ↓
REVIEW
 ↓
FIX
 ↓
FINAL REVIEW
```

Mögliche Umsetzung:

```text
Claude
→ implementiert

Local Model
→ reviewed

Claude
→ behebt Review Findings

Local Model
→ final review
```

Damit wird Agenten Verwalter 2000 langfristig zu einer lokalen Orchestrierungsplattform.

---

# 29. Event Store

Fast alle relevanten Zustandsänderungen werden als Events gespeichert.

```text
events
------
id
session_id
timestamp
type
payload
```

Beispiel:

```json
{
  "sessionId": "oauth-login",
  "type": "tool.completed",
  "tool": "Read",
  "path": "backend/src/auth.ts"
}
```

Andere Events:

```text
message.created
tool.started
tool.completed
file.changed
git.status.changed
agent.status.changed
subagent.started
subagent.completed
session.completed
session.error
```

---

# 30. SQLite

Agenten Verwalter 2000 benötigt keinen Server.

Architektur:

```text
Agenten Verwalter 2000
├── SQLite
├── Git
├── Filesystem
└── Agent processes
```

Bewusst nicht:

- PostgreSQL
- Redis
- Elasticsearch
- Docker
- separater Node-Server

Die Anwendung ist eine lokale Desktop-App.

---

# 31. Datenmodell

Minimaler relationaler Kern:

```text
sessions
---------
id
name
status
provider
model
created_at
updated_at

repositories
------------
id
name
path
remote

session_repositories
--------------------
session_id
repository_id
worktree_path
branch
base_ref
status

messages
--------
id
session_id
role
content
created_at

events
------
id
session_id
timestamp
type
payload

settings
--------
key
value
```

Später können ergänzt werden:

```text
agents
subagents
skills
permissions
commits
annotations
review_comments
```

---

# 32. Performance-Ziel

Agenten Verwalter 2000 wird bewusst für Maschinen gebaut, auf denen die Agenten selbst bereits viel RAM benötigen.

Beispielziel:

> Ein laufendes Agenten Verwalter 2000-Fenster soll nicht plötzlich mehrere zusätzliche Gigabyte verbrauchen, nur weil mehrere Sessions existieren.

Die Agenten dürfen die Ressourcen verbrauchen.

Agenten Verwalter 2000 soll sie verwalten, nicht mit ihnen konkurrieren.

---

# 33. Performance-Regeln

## Chat

- virtuelle Liste
- nur sichtbare Nachrichten rendern
- lange Tool-Outputs einklappbar
- History aus SQLite nachladen

## Diff

- Diff-Editor erst lazy laden
- nur aktive Datei rendern
- keine Monaco-Instanz pro Datei
- keine permanente Vollanalyse sämtlicher Repositories

## Git

- gezielte Statusabfragen
- Änderungen event-/zeitbasiert invalidieren
- keine aggressive Hintergrundindizierung

## Speicher

- Chat-Events persistent speichern
- große Logs nicht permanent im RAM
- keine Kopien ganzer Dateien im globalen State
- Daten nur laden, wenn sichtbar oder unmittelbar benötigt

---

# 34. React State

Die UI-State-Struktur soll schlank bleiben.

Beispiel:

```ts
interface UiState {
  activeSessionId: string | null;
  activeView: "chat" | "changes";
  selectedRepositoryId: string | null;
  selectedFileId: string | null;
}
```

Nicht:

```ts
entireWorkspaceSnapshot
entireEventHistory
entireDiffTree
entireAgentLog
```

im zentralen React-State.

Persistent data liegt in SQLite.

UI state bleibt UI state.

---

# 35. Prozessmanagement

Agent-Prozesse werden vom Rust-Core verwaltet.

```text
Rust Process Manager
│
├── Claude Agent
├── Claude Agent
├── Local Agent
└── OpenCode Agent
```

Die Prozesse sollen möglichst unabhängig von der sichtbaren UI leben.

---

# 36. Crash Recovery

Wenn Agenten Verwalter 2000 geschlossen oder neu gestartet wird:

```text
Agenten Verwalter 2000 startet

↓
SQLite laden

↓
aktive Sessions erkennen

↓
Prozesse prüfen

↓
Agent-Status synchronisieren

↓
UI wiederherstellen
```

Ein UI-Crash darf nicht automatisch bedeuten:

```text
Agent killed
Worktree lost
Session lost
```

---

# 37. Permissions

Jede Session bekommt explizite Pfadberechtigungen.

Beispiel:

```text
Allowed

✓ ~/.forge/workspaces/oauth-login/backend
✓ ~/.forge/workspaces/oauth-login/frontend
✓ ~/.forge/workspaces/oauth-login/shared-types

Denied

✗ ~/.ssh
✗ ~/.aws
✗ ~/.gnupg
✗ ~/Documents
```

Permissions sollen später granular werden:

```text
Filesystem
Shell
Network
Git
Secrets
```

---

# 38. Security-Prinzip

Agenten Verwalter 2000 verwaltet Agents, die potenziell beliebige Shell-Befehle ausführen können.

Daher gilt:

> Der Session-Workspace ist die Sicherheitsgrenze.

Ein Agent sollte nicht standardmäßig Zugriff auf das komplette Benutzerverzeichnis erhalten.

Zusätzlich soll die Anwendung sichtbar machen:

```text
Workspace Access
3 repositories
Shell: enabled
Network: restricted
External paths: none
```

---

# 39. Chat-Details

Die Chat-Timeline unterscheidet:

```text
User
Agent
Tool activity
System event
Question
Error
```

Beispiel:

```text
Claude

Ich habe die bestehende Session-Implementierung
gefunden und werde sie weiterverwenden.

⌄ 12 Dateien analysiert

✓ AuthService gefunden
✓ Session Middleware gefunden
```

Tool-Ausgaben sind standardmäßig reduziert.

---

# 40. „Ask about this change“

Ein späterer Kern-Workflow:

Der Benutzer markiert eine Diff-Zeile:

```ts
const token = await exchangeCode(code);
```

Dann:

```text
[ Agent fragen ]
```

Agenten Verwalter 2000 erstellt den Kontext:

```text
Repository
Datei
Zeile
Diff-Kontext
Session-Kontext
```

und öffnet eine Agent-Frage:

```text
Warum wird hier kein Retry implementiert?
```

Das verbindet Chat und Changes auf elegante Weise.

---

# 41. Review-Modus

Später kann die Changes-Ansicht zu einem echten Review-Modus erweitert werden.

```text
Review

24 Dateien
3 Repositories

[ nächste Änderung ]
```

Pro Diff:

```text
+ const valid = await validateState(state);
```

Optional:

```text
[ Agent fragen ]
[ Kommentar ]
```

Kommentare sind Session-bezogen und können zurück in den Agent-Kontext gelangen.

---

# 42. Commit-Workflow

Am Ende:

```text
Changes

backend      8 files
frontend    11 files
shared       5 files

[ Commit Changes ]
```

Optionen:

```text
Alle Repositories
Nur ausgewählte Repositorys
Nur committed changes
```

Ein Commit pro Repository bleibt technisch getrennt.

---

# 43. Pull Request / Merge

Nicht Bestandteil des MVP.

Später:

```text
Session abgeschlossen

3 Repositories geändert

[ PR vorbereiten ]
```

Agenten Verwalter 2000 kann dann:

- Commit-Zusammenfassung erzeugen
- Branch-Namen vorbereiten
- PR-Texte erzeugen
- Review-Hinweise zusammenfassen

Aber das bleibt eine Erweiterung.

---

# 44. Command Palette

Eine minimalistische Command Palette ist sinnvoll:

```text
⌘ K

Neue Session
Session öffnen
Agent pausieren
Agent fortsetzen
Agent abbrechen
Changes öffnen
Diff öffnen
Terminal öffnen
Agent fragen
```

Sie ersetzt zusätzliche sichtbare Buttons.

---

# 45. Settings

Settings werden bewusst klein gehalten.

## Agent Provider

```text
Claude
OpenCode
LM Studio
```

## Modelle

```text
Claude Sonnet
Claude Opus
Claude Haiku
Local model
```

## Git

```text
Default base branch
Default branch prefix
Worktree directory
```

## Appearance

```text
Dark
Light
System
```

## Permissions

```text
Default filesystem policy
Default shell policy
```

---

# 46. Technischer Stack

Empfohlener Stack:

| Bereich | Technologie |
|---|---|
| Desktop Shell | Tauri 2 |
| UI | React |
| Sprache UI | TypeScript |
| Native Core | Rust |
| Datenbank | SQLite |
| DB Layer | SQLx / rusqlite |
| Git | native Git CLI |
| Diff | Monaco Diff Editor |
| Styling | CSS / Tailwind |
| State | Zustand oder sehr kleiner eigener UI-State |
| Agent | Claude Agent SDK / aktuelles Agent Interface |
| Local Models | LM Studio |
| IPC | Tauri Commands + Events |

---

# 47. Warum Tauri

Tauri ist für das Projekt interessant, weil:

- die Desktop-Shell klein gehalten werden kann
- native Prozesse direkt orchestriert werden können
- Filesystem-Zugriff lokal erfolgt
- Git nicht über einen separaten Server laufen muss
- SQLite direkt lokal verwendet werden kann
- React trotzdem eine sehr hochwertige UI ermöglicht

Wichtig:

Tauri allein garantiert keine niedrige RAM-Nutzung.

Die eigentlichen Gewinne entstehen durch die App-Architektur:

```text
wenig Prozesse
wenig globaler State
wenig Hintergrundarbeit
lazy rendering
virtuelle Listen
persistente Events
```

---

# 48. Alternative Technologien

## Electron

Technisch möglich, aber für das Produktziel weniger attraktiv.

Das Problem ist nicht, dass Electron grundsätzlich schlecht wäre. Das Problem ist das gewünschte Profil:

> Eine Desktop-App für ein 16-GB-Laptop, auf dem die Agenten schon erheblich Ressourcen verbrauchen.

Tauri passt konzeptionell besser zum „leichte Shell, schwerer Worker“-Modell.

## Native Toolkit

Maximale Kontrolle, aber erheblich höherer UI-Entwicklungsaufwand.

## Wails

Interessante Alternative, insbesondere bei Go-Präferenz.

Trotzdem ist Tauri + React + Rust für dieses Projekt eine sehr passende Kombination.

---

# 49. Projektstruktur

Vorschlag:

```text
forge/
│
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── features/
│       │   │   ├── sessions/
│       │   │   ├── chat/
│       │   │   ├── changes/
│       │   │   ├── repositories/
│       │   │   └── settings/
│       │   ├── stores/
│       │   └── lib/
│       │
│       └── src-tauri/
│           ├── commands/
│           ├── agents/
│           ├── git/
│           ├── worktrees/
│           ├── processes/
│           ├── db/
│           └── filesystem/
│
├── packages/
│   ├── shared-types/
│   ├── agent-contract/
│   └── ui/
│
└── docs/
```

---

# 50. Domain Interfaces

Die wichtigsten Interfaces:

## Workspace

```ts
interface Workspace {
  id: string;
  name: string;
  repositories: RepositoryWorkspace[];
}
```

## RepositoryWorkspace

```ts
interface RepositoryWorkspace {
  id: string;
  repositoryId: string;
  worktreePath: string;
  branch: string;
  baseRef: string;
}
```

## Session

```ts
interface Session {
  id: string;
  name: string;

  provider: string;
  model: string;

  status: SessionStatus;

  workspaceId: string;
}
```

## AgentEvent

```ts
interface AgentEvent {
  id: string;
  sessionId: string;
  timestamp: number;
  type: AgentEventType;
  payload: unknown;
}
```

---

# 51. Session Lifecycle

Kompletter Workflow:

```text
User
 │
 │ New Session
 ▼
Session created
 │
 ▼
Repositories selected
 │
 ▼
Worktrees created
 │
 ▼
Agent environment prepared
 │
 ▼
Agent started
 │
 ▼
Agent events streamed
 │
 ├── Chat updates
 ├── Activity updates
 └── Git invalidation
 │
 ▼
Agent modifies files
 │
 ▼
Changes view updated
 │
 ▼
Agent runs tests
 │
 ├── success
 └── failure
        │
        ▼
     Agent fixes
 │
 ▼
Agent completed
 │
 ▼
User reviews Changes
 │
 ▼
Commit / follow-up instruction
```

---

# 52. Fehlerfälle

Agenten Verwalter 2000 muss Fehler transparent darstellen.

Beispiele:

## Agent crashed

```text
Agent beendet

Claude wurde unerwartet beendet.

[ Neu starten ]
[ Logs öffnen ]
```

## Git conflict

```text
Worktree konnte nicht erstellt werden.

Branch existiert bereits.

[ Anderen Branch verwenden ]
```

## Repository missing

```text
Repository nicht gefunden:

~/projects/backend

[ Pfad aktualisieren ]
```

## LM Studio unavailable

```text
Lokales Modell nicht erreichbar.

LM Studio läuft nicht oder der Endpoint ist nicht verfügbar.

[ Erneut versuchen ]
```

Fehler gehören in den normalen UX-Fluss.

---

# 53. Notification Philosophy

Agenten Verwalter 2000 soll nicht permanent Aufmerksamkeit fordern.

Nur Ereignisse mit Handlungsbedarf sollen prominent werden.

Beispiel:

```text
3 Sessions aktiv

1 wartet auf deine Antwort
1 läuft
1 abgeschlossen
```

Wichtig:

Ein Agent, der fünf Minuten lang arbeitet, braucht nicht fünf Statuswechsel als Toast.

---

# 54. Performance bei vielen Sessions

Ziel:

```text
1 Session
5 Sessions
10 Sessions
20 Sessions
```

Die UI darf nicht proportional im Speicher wachsen.

Entscheidend ist:

```text
UI Memory ≠ Number of all events
```

stattdessen:

```text
UI Memory ≈ visible content + active interaction state
```

Agent-Prozesse bleiben natürlich eigene Ressourcenverbraucher.

---

# 55. Lange Chat-Historien

Nicht 100.000 Nachrichten gleichzeitig rendern.

Stattdessen:

```text
SQLite
  ↓
Pagination / cursor
  ↓
Virtualized list
  ↓
Visible messages
```

Ein Benutzer, der zu einer Nachricht von vor zwei Stunden scrollt, lädt diesen Bereich erst dann.

---

# 56. Diff Performance

Diffs können extrem groß werden.

Daher:

- Dateiübersicht zuerst
- Diff erst bei Auswahl
- große Dateien lazy laden
- Textberechnung nicht im UI Thread
- große Diffs gegebenenfalls chunked rendern

Der Diff-Viewer ist ein Werkzeug, nicht der permanente Zustand der App.

---

# 57. UX für neue Session

Der wichtigste Erstellungsworkflow soll drei Schritte haben.

### Schritt 1

```text
Neue Session

Was soll erledigt werden?

[ OAuth Login implementieren ... ]
```

### Schritt 2

```text
Repositories

☑ backend
☑ frontend
☑ shared-types
```

### Schritt 3

```text
Agent

Claude Sonnet
```

Dann:

```text
[ Session starten ]
```

Keine zehn Konfigurationsdialoge.

Fortgeschrittene Einstellungen kommen später.

---

# 58. Session Templates

Später können häufige Konfigurationen gespeichert werden:

```text
Feature
Bugfix
Refactor
Code Review
Migration
```

Zum Beispiel:

```text
Feature Template

Provider: Claude
Model: Sonnet
Base: origin/main
Skills:
  testing
  frontend
```

---

# 59. Skill System

Skills sollen auf Session-Ebene ausgewählt werden können.

Beispiel:

```text
Skills

☑ frontend
☑ backend
☑ testing
☐ database
☐ deployment
```

Die Session-Konfiguration wird mit dem Agent-Provider synchronisiert.

---

# 60. Context Management

Context darf als Status sichtbar sein, aber nicht die UI dominieren.

Beispiel:

```text
Claude Sonnet

147k / 200k
████████████░░
```

Optional:

```text
Input
113k

Output
34k

Remaining
53k
```

Eine Session sollte außerdem wissen können, ob sie einen neuen Agent-Kontext benötigt.

---

# 61. Session Resume

Eine unterbrochene Session soll fortsetzbar sein.

```text
OAuth Login
○ Interrupted

[ Fortsetzen ]
```

Dabei wird der persistierte Session-Zustand geladen und der Provider erstellt/öffnet den entsprechenden Agent-Kontext.

---

# 62. Session Archive

Abgeschlossene Sessions bleiben sichtbar:

```text
✓ OAuth Login
  Completed 2h ago
```

Sie können später wieder geöffnet werden.

Archive dienen vor allem:

- Nachvollziehbarkeit
- Diff-Historie
- Agent-Konversation
- Lern-/Analyse-Zwecke

---

# 63. Search

Globale Suche:

```text
⌘ K

OAuth
```

soll später finden:

```text
Session
OAuth Login

Message
"OAuth callback"

File
src/auth/oauth.ts

Event
OAuth tests failed
```

SQLite Full Text Search kann dies lokal abbilden.

---

# 64. Telemetrie

Standardmäßig keine externe Telemetrie notwendig.

Wenn später Telemetrie angeboten wird, sollte sie:

- opt-in sein
- transparent sein
- lokal deaktivierbar sein
- keine Quelltexte oder Agent-Chats erfassen

Local-first bleibt das Grundprinzip.

---

# 65. MVP Scope

Version 1:

### Navigation
- Sessions
- Neue Session
- Session archivieren

### Chat
- User message
- Agent messages
- Tool activity
- Agent status
- Interrupt
- Resume

### Workspace
- mehrere Repositories
- Worktrees
- branches

### Changes
- repository filter
- changed files
- unified diff
- committed/uncommitted

### Agent
- Claude Provider

### Persistence
- SQLite
- Session restore

### Desktop
- Tauri
- macOS
- Linux als zweites Ziel

---

# 66. Was nach dem MVP kommt

## Phase 2

- OpenCode
- LM Studio
- Model switching
- Skills
- Permissions UI
- Agent timeline
- Review comments
- Search
- Command Palette

## Phase 3

- Multi-Agent
- Review Agent
- Test Agent
- Ask about Diff
- Commit automation

## Phase 4

- PR workflow
- Agent pipelines
- session templates
- analytics
- advanced Git workflows

---

# 67. Roadmap nach Entwicklungsrisiko

Die technisch riskantesten Teile zuerst validieren:

## 1. Agent Integration

Kann Agenten Verwalter 2000 zuverlässig:

- starten
- Events empfangen
- interrupt
- resume
- Status erkennen

## 2. Worktree Orchestration

Kann Agenten Verwalter 2000 stabil mehrere Repositories als eine Session verwalten?

## 3. Persistence

Kann eine Session bei App-Restart korrekt wiederhergestellt werden?

## 4. Diff

Kann Agenten Verwalter 2000 mehrere Repository-Diffs effizient aggregieren?

## 5. UI

Erst danach die Oberfläche feinpolieren.

Dadurch wird verhindert, dass sechs Wochen UI gebaut werden und anschließend festgestellt wird, dass der Agent-Lifecycle technisch nicht funktioniert.

---

# 68. Erfolgskriterien

Agenten Verwalter 2000 ist erfolgreich, wenn ein Entwickler sagen kann:

> „Ich starte fünf Features, sehe sofort, welcher Agent arbeitet, beantworte Rückfragen direkt im Chat und kann anschließend mit zwei Klicks sehen, was über alle betroffenen Repositories geändert wurde.“

Messbare Kriterien:

- neue Session in wenigen Sekunden
- mehrere Worktrees ohne manuelle Git-Schritte
- Agent-Status klar erkennbar
- Chat bleibt auch bei langen Sessions flüssig
- Changes-Ansicht zeigt Multi-Repo-Diff
- App-Restart verliert keine Session-Daten
- UI bleibt auch mit vielen Sessions reaktionsfähig
- geringer zusätzlicher RAM-Verbrauch

---

# 69. UI-Leitlinie

Die wichtigste visuelle Regel:

> **Wenn ein Element nicht aktiv beim Agent-Workflow hilft, gehört es nicht dauerhaft auf den Bildschirm.**

Daher:

### Immer sichtbar

- Sessions
- Session Name
- Agent Status
- Chat/Changes
- Model
- zentrale Aktion

### Kontextabhängig

- Repositories
- Files
- Diff
- Tool Logs
- Timeline
- Context Details

### Versteckt / sekundär

- technische Prozessdaten
- vollständige Shell Logs
- Debug-Informationen
- Performance Details

---

# 70. Zielbild der finalen Oberfläche

```text
┌───────────────────────────────────────────────────────────────┐
│ Agenten Verwalter 2000                         OAuth Login   ● Running          │
├───────────────┬───────────────────────────────────────────────┤
│               │                                               │
│ Sessions      │              [ Chat ] [ Changes ]             │
│               │                                               │
│ ● OAuth Login │                                               │
│               │   Du                                           │
│ ● Payment     │   Implementiere OAuth für Backend und         │
│               │   Frontend.                                   │
│ ○ Migration   │                                               │
│               │   Claude                                      │
│ ✓ Cleanup     │   Ich analysiere zuerst die bestehenden       │
│               │   Auth-Flows.                                 │
│               │                                               │
│               │   ✓ Backend                                   │
│               │   ✓ Frontend                                  │
│               │   ● Implementierung                           │
│               │                                               │
│               │                                               │
│               │                                               │
│               │                                               │
│               │                                               │
│               │   ┌────────────────────────────────────────┐  │
│               │   │ Nachricht an Agent …                  │  │
│               │   └────────────────────────────────────────┘  │
│               │                                               │
└───────────────┴───────────────────────────────────────────────┘
```

Und bei `Changes`:

```text
┌───────────────────────────────────────────────────────────────┐
│ Agenten Verwalter 2000                         OAuth Login   ● Completed         │
├───────────────┬───────────────────────────────────────────────┤
│               │              [ Chat ] [ Changes ]              │
│ Sessions      │                                               │
│               │ backend      14 Dateien      +823 -214        │
│ ● OAuth Login │                                               │
│               │ src/                                          │
│ ● Payment     │   auth/                                       │
│               │     oauth.ts          +42 -8                  │
│ ○ Migration   │     session.ts        +18 -3                 │
│               │                                               │
│ ✓ Cleanup     │ ┌───────────────────────────────────────────┐ │
│               │ │           Diff                            │ │
│               │ │                                           │ │
│               │ │ - old code                                │ │
│               │ │ + new code                                │ │
│               │ │ + new code                                │ │
│               │ │                                           │ │
│               │ └───────────────────────────────────────────┘ │
└───────────────┴───────────────────────────────────────────────┘
```

---

# 71. Ein-Satz-Definition

> **Agenten Verwalter 2000 ist eine minimalistische lokale Desktop-Kommandozentrale für Coding-Agenten, bei der eine Session eine Aufgabe über beliebig viele Git-Repositories hinweg repräsentiert, der Chat die primäre Interaktion bildet und Changes/Diffs als sekundäre Review-Ebene dienen.**

---

# 72. Schlussfolgerung

Agenten Verwalter 2000 sollte nicht versuchen, möglichst viele Entwicklerwerkzeuge in einer Oberfläche zu vereinen.

Seine Stärke liegt gerade darin, Dinge wegzulassen.

Die App braucht keinen permanenten Editor, kein riesiges Dashboard und keine IDE-artige Informationsdichte.

Sie braucht:

```text
Sessions
   ↓
Chat
   ↓
Agent
   ↓
Worktrees
   ↓
Changes
   ↓
Review
```

Genau dieser Workflow ist das Produkt.

Alles andere ist optional.
