# Findings — Bibliothek

Format: `- [ ] → Phase N: <Erkenntnis>` (offen) bzw. `- [x] → Phase N: <Erkenntnis> — <Erledigung>`.

- [ ] → Phase 3: In einer Bibliothek bekommen Einträge unter `_vault/inbox/` nicht den Status `inbox` — `extract::finish` prüft den Pfad auf `inbox/` am Anfang, dort steht aber `_vault/inbox/`. Zeigt der Suchdialog den Inbox-Status an, muss die Prüfung das Wissens-Präfix kennen (oder Phase 3 lässt es bewusst weg).
- [ ] → Phase 2: Wechselt ein bereits eingelesener Ordner sein Layout (ein reiner Vault bekommt `skills\` oder `CLAUDE.md`), werden unveränderte Dateien nicht neu eingeordnet — Art und Titel nach Ort setzt der Abgleich nur beim Einlesen. Der Wechsel der Einstellung auf den Master-Ordner baut den Index ohnehin neu (anderer Ordner), daher nur ein Randfall.
- [ ] → Follow-up (Abschluss): `library::apply_place` erkennt einen Skill-Ordner am Namen ohne Endung — eine lose Datei ohne Endung direkt in `skills\` (z. B. `skills/LICENSE`) bekommt Art `skill` und Einstieg `skills/LICENSE/SKILL.md`. Heute im Master keine solche Datei. Sauber wäre, die Skill-Regel nur für Ordner-Artefakte anzuwenden (`folder_meta_of`), nicht in `store_loaded`.
