# Findings — Meilenstein 6 UI auf Zielbild, plus Altlasten

Erkenntnisse aus der Umsetzung, getaggt nach Ziel-Phase:

```text
- [ ] → Phase N: <Erkenntnis>
```

- [ ] → Phase 2: Die Migration heißt im Plan „Migration 4“ / `004_settings.sql` — Nummer 4 ist seit dem Plan „Worktrees entscheidet der Agent“ vergeben (`004_main_checkout.sql`), und der Plan „Vorhaben und Sessions“ (2026-09-30) bringt eine weitere. Die Einstellungs-Migration bekommt die nächste freie Nummer zum Zeitpunkt der Umsetzung; Checkliste, AK und Code-Map-Zeile entsprechend lesen.
- [ ] → Phase 4: Wird der Plan „Vorhaben und Sessions“ (2026-09-30) vorher umgesetzt, ist die Sidebar keine flache Session-Liste mehr, sondern ein Baum: Gruppen → Vorhaben (`src/app/SidebarProject.tsx`) → aufgeklappte Sessions (`SidebarItem`). Die flache Zeilenliste für die Virtualisierung muss dann Überschrift, Vorhaben-Zeile, Session-Zeile und Leer-Satz kennen; Umbenennen und F2 gelten für Vorhaben und Sessions (`renaming` in `src/stores/sessions.ts`).
