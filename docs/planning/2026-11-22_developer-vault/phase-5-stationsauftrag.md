# Phase 5 — Vault-Treffer im Auftrag der Station

**Stufe:** standard · **Ziel:** Eine Station bekommt in ihrer ersten Nachricht bis zu drei Vault-Treffer zu ihrer Phase — ohne eigenen Suchaufruf, ohne Vault gar nichts.

## Kontext — lesen vor dem Start

- `README.md` dieses Plans und [ADR 068](../../decisions/068-developer-vault.md).
- `src-tauri/src/implementation/start.rs`: `first_message` (Aufbau der ersten Nachricht) und `start_claimed` (einzige Aufrufstelle, ermittelt dort schon die Git-Lage).
- Ergebnis von Phase 4: `vault::search::search`, `VaultQuery` mit `any_term`.
- ADR 048 (Umsetzung), ADR 061 (schlanke Werkzeuge in Stationen).
- Fehlerklassen geprüft: keine einschlägig für diese Phase.

## Abnahmekriterien der Phase

1. `pub fn brief_lines(app: &AppHandle, title: &str, description: &str) -> Result<Vec<String>, CommandError>` in `src-tauri/src/vault/mod.rs`: `Ok(vec![])`, wenn der Satz `vault_` nicht angeboten wird oder nichts gefunden ist; ein Fehler der Suche kommt als `Err` zurück, und `start_claimed` schreibt ihn wie bei der Git-Lage mit `registry.log_session_line` („Vault-Treffer nicht ermittelt: …“) und macht mit leerer Liste weiter. Sonst Suche mit Text = Titel + Leerzeichen + Beschreibung, `any_term = true`, nur Begriffe ab vier Zeichen, höchstens die ersten zwölf verschiedenen, `limit = 3`.
2. Mit Treffern: erste Zeile „Vault (passend zur Phase; laden mit vault_get):“, je Treffer `- <path> · <title> — <description>`, Beschreibung auf 120 Zeichen gekürzt mit `…`.
3. `first_message` bekommt den Parameter `vault_lines: &[String]`; die Zeilen stehen nach dem Block „Git-Lage:“ und vor der Leerzeile mit dem Schlusssatz. Leere Liste → nichts.
4. `start_claimed` ruft `brief_lines` mit Titel und Beschreibung der Phase, nachdem die Git-Lage ermittelt ist.
5. Ohne Vault ist die erste Nachricht byte-gleich mit dem Stand vor dieser Phase.
6. `pnpm check` grün.

## Checkliste

- [ ] `vault::brief_lines` nach AK 1–2.
- [ ] `implementation/start.rs`: Parameter und Einbau nach AK 3–4.
- [ ] `implementation-probe` (Befehlstabelle in `AGENTS.md`) baut die erste Nachricht nicht nach — kein Umbau nötig; prüfen, dass es weiter kompiliert.
- [ ] Doku: ADR 048 → Konsequenzen um einen Satz „Die erste Nachricht einer Station nennt bei aktivem Developer Vault bis zu drei Treffer (ADR 068).“; `docs/glossary.md` → Eintrag „Station“ unverändert, Eintrag „Developer Vault“ um diesen Satz ergänzen.

## Report-Back
