# 069 — Bibliothek: Master-Ordner und Developer Vault werden ein Ordner

**Status:** angenommen · **Datum:** 2026-11-24 · ändert [ADR 038](038-umgebung.md) (Master-Ordner) und [ADR 068](068-developer-vault.md) (Vault-Ordner, Grundgerüst)

## Kontext

Der Benutzer pflegt Skills, Befehle, Ausgabestile und `CLAUDE.md` in einem synchronisierten Master-Ordner, der zugleich Skripte zum Ausrollen auf einen Rechner (`setup.cmd`), Gedächtnis (`memory/`), Hooks, Logs und `settings.json` enthält. Der Developer Vault (ADR 068) war ein zweiter, frei gewählter Ordner. Gewünscht ist ein einziger Ordner, in dem Vault, Anweisungen und Skripte gesammelt sind, und den der Verwalter für Abgleich und Suche zugleich nutzt. Der persönliche Wissens-Vault des Benutzers bleibt davon getrennt.

## Optionen

- **Wo das Wissen liegt:** (a) Wissensordner direkt in der Wurzel (`inbox/`, `wissen/` … neben `skills/`), wie im Entwurf vom 2026-11-23 — verworfen: Konfiguration und Wissen mischen sich in einer Ebene, jeder neue private Ordner wäre sofort durchsuchbar; (b) ein Unterordner `_vault/` — gewählt (Entscheidung des Benutzers 2026-11-24); er existierte bereits.
- **Was gelesen wird:** (a) alles außer einer Ausschlussdatei `.vaultignore` — verworfen: fail-open, ein vergessener Eintrag gibt Hooks, Logs oder `settings.json` an Agenten; (b) feste Erlaubnisliste der ersten Ebene (`CLAUDE.md`, `AGENTS.md`, `skills/`, `commands/`, `output-styles/`, `memory/`, `_vault/`) — gewählt; `.gitignore`, `.vaultignore` und führende Punkte gelten darin weiter, eine `.vaultignore` schließt nur noch einzelne Dateien innerhalb der Liste aus.
- **Memories:** (a) draußen lassen — verworfen: Memories sind der Eingang für Regeln aus Erfahrung; wer sie aufräumt (`audit`), will sie neben Regeln und Wissen sehen, und Agenten lesen `memory/` über die Sync-Verknüpfung ohnehin; (b) nur im Suchdialog, nicht für Agenten — verworfen: zusätzlicher Filter in beiden Werkzeugen ohne echten Schutzgewinn; (c) die Dateien direkt in `memory/` als Untergruppe „Gedächtnis“ der Gruppe Anweisungen, weil sie wie Regeln binden — gewählt (Entscheidung des Benutzers 2026-11-24). Unterordner (`memory/_archiv/`) bleiben draußen; einzelne Memories schließt eine `.vaultignore` im Ordner aus.
- **Woran der Verwalter eine Bibliothek erkennt:** am Inhalt, mit derselben Prüfung wie der Master-Ordner (`skills`, `commands`, `output-styles` oder `CLAUDE.md`). Ein Ordner ohne diese ist ein reiner Vault und wird ganz gelesen wie bisher — kein Schalter, keine zweite Einstellung.
- **Einstellung:** (a) `vault_dir` behalten und `master_dir` streichen — verworfen: die Übernahme bräuchte eine Regel, die einen alten Wert dauerhaft mitliest; (b) neuer Schlüssel `library_dir`, beim Laden übernommen aus `master_dir`, sonst `vault_dir`; jedes Speichern leert beide alten Schlüssel — gewählt, keine Migration.
- **Skills im Index:** ein Skill-Ordner (`skills/<x>/` mit `SKILL.md`) ist ein Artefakt wie ein Ordner mit `manifest.yaml`; Titel = Ordnername, Beschreibung aus dem Frontmatter von `SKILL.md`, Art `skill`. Befehle (`command`, Titel `/<x>`), Ausgabestile (`style`) und Grundregeln (`rules`) bekommen ihre Art aus dem Ort.

## Entscheidung

Ein Ordner „Bibliothek“ (`library_dir`). Enthält er Master-Inhalt, gleicht der Verwalter ihn ab (ADR 038 unverändert) und durchsucht nur die Erlaubnisliste; Wissen liegt in `_vault/`. Treffer tragen Gruppe und Untergruppe (Anweisungen mit Grundregeln, Ausgabestilen und Gedächtnis; Skills; Wissen). Der Stationsauftrag nennt nur Wissen. Das Grundgerüst schreibt in einer Bibliothek nach `_vault/`, nur wenn der Ordner fehlt oder leer ist; sonst schreibt der Verwalter nichts in die Bibliothek. Werkzeug- und Modulnamen bleiben `vault`.

## Konsequenzen

- `setup.cmd` und die Ordnerstruktur des Master-Ordners bleiben unverändert; der Verwalter liest `memory/_archiv/`, `hooks/`, Logs, `settings.json`, `codex/`, `continue/` nie.
- Memories sind für Agenten über `vault_search`/`vault_get` erreichbar. Eine Memory mit vertraulichem Inhalt gehört in die `.vaultignore` des Ordners, bevor die Suche eingeschaltet ist.
- Andere Ordner in der Wurzel (z. B. `references/`, `_stylePakete/`) sind nicht durchsuchbar, bis sie in `_vault/` liegen.
- Der Index hat Schema-Version 2; jeder bestehende Index wird einmal neu aufgebaut.
- Wer Master-Ordner und Vault bisher an getrennten Orten hatte, sieht nach dem Update den Master-Ordner; das Wissen muss nach `<Bibliothek>\_vault\` umziehen.
- Lange Skill-Beschreibungen erzeugen Treffer; der Stationsauftrag schließt sie aus, im Dialog trennen die Gruppen.
