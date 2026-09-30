# Findings — Vorhaben und Sessions, mit TL;DR

Erkenntnisse aus der Umsetzung, getaggt nach Ziel-Phase:

```text
- [ ] → Phase N: <Erkenntnis>
```

- [ ] → Phase 6: `SessionTldrView` trägt keine aktuelle Zahl der Chat-Einträge. „N neue Einträge seitdem“ rechnet die Oberfläche selbst: `seq` des letzten geladenen Chat-Eintrags + 1 minus `view.seq`.
- [ ] → Phase 6: `tldr_set_carry` sendet kein Ereignis — die Einstiegsansicht hält den Haken selbst und lädt die Sicht nach dem Umschalten nicht neu.
- [ ] → Phase 6: Beginnt die erste Nachricht einer neuen Session mit `/` (z. B. `/implement`), hängt der Core den Stand des Vorhabens **hinter** die Nachricht statt davor — sonst erkennt die Kommandozeile den Befehl nicht. Der Chat zeigt die Nachricht so, wie sie ging; der Hinweistext der Einstiegsansicht sollte „vorangestellt“ nicht wörtlich versprechen.
- [ ] → Phase 6: Die Kostenangabe „unter 1 Cent“ aus der Planung hält nicht (gemessen 1,2 Cent bis 33 Cent, ADR 011 „TL;DR“). Falls die Oberfläche oder die Entwurfs-README Kosten nennt, an ADR 011 angleichen.
- [ ] → Vault: Claude Code — Haiku im Druckmodus (`-p --output-format json --json-schema`) denkt mit (rund 600 Denk-Tokens je Antwort) und schreibt eine große Eingabe über die Standardeingabe in den 1-Stunden-Cache (doppelter Eingabepreis): 107 k Tokens Eingabe kosteten 33 Cent statt ~11 · Ursache: Standardverhalten der Kommandozeile 2.1.284 · Fix: Eingabe klein halten; Kosten vor Festlegung messen, nicht aus Listenpreisen rechnen.
