# Findings — Kontext und Kontingent

Erkenntnisse aus der Umsetzung, getaggt nach Ziel-Phase:

```text
- [ ] → Phase N: <Erkenntnis>
```

- [x] → Phase 3: `usage_refresh` kehrt sofort zurück und liefert nichts; die Oberfläche hört auf `usage://changed` (ohne Nutzlast) und holt dann `usage_load`. Es gibt fünf Usage-Typen in `src/lib/bindings/`, nicht sechs.
- [x] → Phase 3: `usage_refresh(false)` tut innerhalb von 30 s nach dem letzten Start nichts, auch kein Ereignis — der Knopf „Aktualisieren“ muss `force: true` senden, sonst bleibt ein Klick kurz nach dem Öffnen ohne jede Rückmeldung.
