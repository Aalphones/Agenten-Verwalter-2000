# Artefakte zum Plan „Warnhinweise“

| Datei | Inhalt | Phasen |
|---|---|---|
| [warnhinweise-entwurf.html](warnhinweise-entwurf.html) | Entwurf aller neun Hinweise in der nachgebauten App, umschaltbar je Fall (oben „Fall“), mit nummerierten Markierungen und einer Legende darunter. Vom User am 2026-10-21 freigegeben. | 3, 4, 5, 6 |
| [beispielzeilen.jsonl](beispielzeilen.jsonl) | Echte Ausgabezeilen der Claude-Kommandozeile 2.1.293 vom 2026-10-21: zwei Antworten mit Cache-Angaben, `rate_limit_event`, `result` mit `total_cost_usd` und `permission_denials`, `/compact` mit `status`, `compact_boundary` und der synthetischen Zusammenfassung (Text gekürzt). Ohne `system/init`. Phase 1 hängt die Messung der abgelehnten Aufrufe an. | 1 |

**Ansehen:** die HTML-Datei im Browser öffnen (offline, ohne Abhängigkeiten); der Schalter „Farbschema“ zeigt hell und dunkel.

**Design-System:** Farben sind die semantischen Tokens aus `src/styles/theme.css` (Stand 2026-10-21) als feste Werte, Schrift Segoe UI Variable / Cascadia wie die App. Neu ist nur der Farbton „Cache kalt“ (hell `#3d6fa8`, dunkel `#8ab8ea`) — Phase 3 legt ihn als `--color-cache-cold` an.

**Platzhalter im Entwurf:** alle Zahlen (Minuten, Token, Prozent, Beträge, Uhrzeiten), der Wortlaut „Hinweis von Claude Code“ (kommt von der Kommandozeile), die Sidebar-Einträge. Der Knopf „Details“ in der Kontingent-Leiste entfällt in der Umsetzung (README, Entscheidung „Leiste ohne Knopf Details“).

**Neu erzeugen:** nicht nötig — die HTML-Datei ist die Quelle. Die Beispielzeilen entstehen aus einem Lauf `claude.exe -p --input-format stream-json --output-format stream-json --verbose --model claude-sonnet-5-5 --strict-mcp-config` mit den Nachrichten „Antworte nur mit OK.“, „Antworte nur mit ZWEI.“ und „/compact“ (jede erst nach dem `result` der vorigen schicken); danach `system/init`-Zeilen und `session_id` entfernen und den Text der Zusammenfassung kürzen — er enthält Angaben aus den Benutzer-Anweisungen.
