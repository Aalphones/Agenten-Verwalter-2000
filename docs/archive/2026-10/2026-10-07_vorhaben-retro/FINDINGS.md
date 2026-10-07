# FINDINGS

Format: `- [ ] → Phase N: <Erkenntnis>`

- [x] → Phase 3: `retro://progress` kommt mit `done = 0` erst, nachdem die Verlaufsdateien geschrieben sind; davor (Verläufe laden, `print_program` fragt ggf. LM Studio bis 3 s) gibt es kein Ereignis — der Knopf braucht für diese Zeit einen eigenen Zustand ohne Zahl. `total` zählt nur Sessions mit lesbarem Verlauf.
