# 070 — MCP-Server im Dialog verwalten: Konfiguration lesen und schreiben ohne Agent

**Status:** angenommen · **Datum:** 2026-11-25 · erweitert [ADR 013](013-mcp-server-im-dialog.md) (Liste nur über den laufenden Agenten)

## Kontext

Der Dialog „MCP-Server“ zeigt nur, was der laufende Agent meldet (ADR 013). Ohne Agent bleibt er leer, Server lassen sich weder hinzufügen noch entfernen, und die `.mcp.json` der Repositories erscheinen als „Kommandozeile“, weil der Verwalter sie per `--mcp-config` nachreicht (Herkunft `dynamic`). Gewünscht: Liste auch ohne Agent, Unterscheidung nach Ablageort (Benutzer, Projekt, nur ich), Hinzufügen, Bearbeiten, Entfernen, Werkzeugbeschreibungen und Server-Anweisungen ansehen. Gemessen am 2026-11-25: Claude Code 2.1.332 speichert den Aus-Schalter in `~/.claude.json` unter `projects[<Arbeitsordner>].disabledMcpServers` — auch für Server aus `--mcp-config`; der Arbeitsordner einer Session ist der Workspace des Vorhabens. Die Kommandozeile kennt eine undokumentierte Steueranfrage `mcp_set_servers` (Server zur Laufzeit tauschen, Antwort `{added, removed, errors}`), nicht gemessen.

## Optionen

- **Quelle der Liste ohne Agent:** (a) weiter leer — verworfen; (b) die Konfigurationsdateien selbst lesen, dieselben Orte wie `standalone/mcp/config.rs` — gewählt. Läuft der Agent, kommt der Zustand (verbunden, Werkzeuge) weiter von ihm und wird per Name dazugelegt.
- **Änderungen bei laufendem Agenten:** (a) live über `mcp_set_servers` — verworfen (undokumentiert, ungemessen; Entscheidung des Benutzers); (b) Neustart: die Session merkt sich beim Prozessstart einen Fingerabdruck der MCP-Konfiguration; weicht er ab und ruht der Agent, startet die nächste Nachricht ihn neu (wie ein neues Repository) — gewählt.
- **Verbindung testen, Werkzeuge ansehen:** über den eigenen MCP-Client des autarken Agenten (`standalone/mcp/client.rs`) direkt aus dem Core — gewählt; funktioniert ohne Agent. OAuth kann der Client nicht; dann ein klarer Satz statt eines Tests.
- **Aus-Schalter ohne Agent:** der Core schreibt `disabledMcpServers` im Eintrag des Workspace in `~/.claude.json`, genau wie die Kommandozeile.
- **Reichweite des Ausschaltens:** Claude merkt sich „aus“ nur je Arbeitsordner, ein neues Vorhaben startet den Server wieder. (a) immer nur dieses Vorhaben; (b) immer überall; (c) beim Ausschalten wählen — gewählt (Entscheidung des Benutzers 2026-11-25), als dreistufiger Schalter an · hier aus · überall aus statt einer Rückfrage. „Überall“ speichert der Verwalter als Einstellung `mcp_disabled_everywhere` und trägt sie vor jedem Agent-Start in `disabledMcpServers` des Workspace ein; Einschalten hebt es in allen Vorhaben des Verwalters auf.
- **Zugangsdaten:** Header- und Umgebungswerte gehen nie an die Oberfläche; nur reine `${VARIABLE}`-Verweise sind lesbar. Beim Bearbeiten heißt ein leer gelassener Wert „unverändert“.
- **Entfernen:** ohne Rückfrage, mit Rückgängig: die Oberfläche führt das Entfernen erst nach 6 s aus.

## Entscheidung

Neues Core-Modul `mcp/config_files.rs` liest und schreibt Benutzer (`~/.claude.json` `mcpServers`), „nur ich, in diesem Vorhaben“ (`~/.claude.json` `projects[<Workspace>].mcpServers`), je Repository dessen `.mcp.json` im Arbeitsordner des Agenten und, falls vorhanden, die `.mcp.json` des Workspace. Schreiben liest die Datei frisch, ändert nur den Zielknoten, behält Reihenfolge (`serde_json` mit `preserve_order`) und ersetzt die Datei über eine Zwischendatei. Der Dialog gruppiert nach Ablageort; Server, die der Agent meldet, aber in keiner Datei stehen (claude.ai, Verwalter, Organisation), stehen unter „Fest eingebunden“ und sind nur schaltbar.

## Konsequenzen

- Der Dialog zeigt Server auch in neuen und ruhenden Sessions; Status „Startet mit Agent“ statt Verbindungszustand.
- Repository-Server heißen nicht mehr „Kommandozeile“.
- Schreibt die Kommandozeile einer anderen Session `~/.claude.json` gleichzeitig, kann eine Änderung verloren gehen (offener Punkt, siehe Plan).
- Ein Arbeiten-Agent wird nie unterbrochen; die Änderung greift mit der nächsten Nachricht nach seinem Ende.
- Codex-Sessions sind nicht Teil dieser Entscheidung.
