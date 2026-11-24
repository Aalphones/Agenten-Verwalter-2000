# Entwurf: Bibliothek

Der verbindliche Entwurf ist der am 2026-11-23 abgenommene Klickdummy des Developer-Vault-Plans: [vault-suchdialog.html](../../../archive/2026-11/2026-11-22_developer-vault/artifacts/vault-suchdialog.html), Beschreibung in dessen [README](../../../archive/2026-11/2026-11-22_developer-vault/artifacts/README.md). Er wird hier nicht kopiert.

## Ansehen

Datei im Browser öffnen, in der Entwurfsleiste oben „Ausbau: Bibliothek“ wählen. Einstellungen: Ansicht Einstellungen, Kategorie „Skills & Umgebung“. Suchdialog: Knopf in der Seitenleiste oder Ctrl K im Dummy.

## Welche Teile gelten für welche Phase

| Bildschirm | Phase | Teil des Entwurfs |
|---|---|---|
| Einstellungen › Skills & Umgebung › Bibliothek | 2 | Abschnitt „Bibliothek“: Ordner, Abgleich der Skills, Verknüpfungen, Suche, Suchindex, letzte Zeile |
| Suchdialog | 3 | Gruppen Anweisungen, Skills, Wissen mit Untergruppen; Titel „Bibliothek“ |
| Seitenleiste | 3 | Knopf „Bibliothek“ in der Symbolleiste |

## Abweichungen vom Entwurf (entschieden 2026-11-24)

- **Letzte Zeile der Einstellungen:** statt „Nicht durchsucht · aus .vaultignore: memory/ · hooks/ · Logs“ heißt sie „Durchsucht“ und nennt die Erlaubnisliste (`CLAUDE.md · AGENTS.md · skills/ · commands/ · output-styles/ · memory/ · _vault/`). Grund: Entscheidung des Benutzers für eine feste Erlaubnisliste mit Wissen in `_vault/` statt einer Ausschlussdatei.
- **Memories sichtbar:** Anweisungen bekommt eine dritte Untergruppe „Gedächtnis“ (die Dateien direkt in `memory/`), Entscheidung des Benutzers 2026-11-24.
- **Wissen-Untergruppen:** der erste Ordner **unter `_vault/`**, nicht der erste Ordner im Pfad.
- **Verknüpfungen** bleibt auch ohne gewählten Ordner sichtbar (im Entwurf nur mit Ordner): der Punkt an der Kategorie für kaputte Verknüpfungen zeigt sonst auf eine unsichtbare Zeile.

## Platzhalter im Entwurf

Wissens-Einträge im Dummy sind erfunden; Skill-, Befehls- und Stilnamen sind echt, Beschreibungen gekürzt. Farben und Maße stammen aus `src/styles/theme.css` (Stand 2026-11-23).
