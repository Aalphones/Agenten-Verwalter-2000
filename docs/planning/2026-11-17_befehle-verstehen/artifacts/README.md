# Entwurf und Prüfdaten „Befehle verstehen“

| Datei | Zeigt | Phasen |
|---|---|---|
| `entwurf-befehle-verstehen.html` | Plan-Seite mit bedienbarem Entwurf: Statuszeile in acht Zuständen, Schalter „Figurenpaket“ mit den drei neuen Bewegungen, Knopf „Lauf abspielen“; darunter Befehlszeile im Chat, Seitenleiste, Hintergrund-Panel | 2, 5, 6 |
| `vordergrund.jsonl` | Protokollzeilen eines Vordergrund-Befehls über 24 s (Claude Code 2.1.322) | 1, 2 |
| `zeitlimit.jsonl` | Protokollzeilen eines Vordergrund-Befehls, der sein Zeitlimit von 6 s überschreitet und in den Hintergrund wandert | 1 |

**Ansehen:** HTML-Datei im Browser öffnen. Direkt in einem Zustand über den Anker, mehrere Angaben mit Komma: Zustand `kurz`, `fortschritt`, `geschaetzt`, `erster`, `laenger`, `stumm`, `skript`, `ohne`; dazu `fun` (Figurenpaket an) und die Bewegung `trek`, `charge` oder `reveal` — z. B. `#fun,charge,geschaetzt`. Oben rechts „Hell/Dunkel wechseln“.

**Werte:** Farben, Schriften und Abstände aus `src/styles/theme.css` (hell und dunkel). Balken 132 × 6 px, Figur auf dem Balken 26 px hoch, Bühne 57 × 35 px wie `SkinStage` mit `size="line"`.

**Platzhalter:** Namen, Zeiten, Zahlen und Ausgabezeilen sind Beispielwerte. Die Figur fehlt im Repository absichtlich (Rechte Dritter): die Konstante `SPRITE` im Skript der Seite ist leer. Zum Ansehen mit Figur dort die Adresse eines eigenen Bildes eintragen; die vollständige Fassung liegt im Artefakte-Ordner des Vorhabens.

**Prüfdaten:** Die beiden `.jsonl`-Dateien sind Mitschnitte von `claude -p … --output-format stream-json --verbose`, reduziert auf die Zeilen `system/init` (nur `model`, `scratchpad_path`), `assistant` (Werkzeugaufrufe und Text), `system/task_*`, `system/background_tasks_changed`, `user` (Werkzeug-Ergebnisse) und `result`; Benutzername und Session-Kennungen sind ersetzt. Neu aufzeichnen: denselben Aufruf mit einem Auftrag, der eine Schleife mit `sleep` im Vordergrund ausführt (für `zeitlimit.jsonl` mit `timeout` 6000).
