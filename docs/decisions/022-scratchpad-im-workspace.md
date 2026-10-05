# 022 — Scratchpad im Workspace: die App gibt den Ordner vor

**Status:** angenommen · **Datum:** 2026-10-05 · löst den Scratchpad-Punkt aus [ADR 007](007-anhaenge-skills-hintergrund.md) ab

## Kontext

ADR 007 hat Claudes eigenen Scratchpad-Ordner aus `system/init.scratchpad_path` übernommen. Claude Code 2.1.287 meldet das Feld im Betrieb mit `-p` und `stream-json` nicht mehr und legt den Ordner dort auch nicht an: Unter `%TEMP%\claude\` hatte keine der sieben Sessions, die die App gestartet hat, einen `scratchpad`-Ordner, interaktiv gestartete Sessions desselben Tages schon. Der Scratchpad-Reiter blieb leer. Ohne Vorgabe legten die Agenten ihre Arbeitsdateien an selbst erfundenen Orten ab (`%TEMP%\<ticket>\`, `_scratch\` im Repository), die die App nicht kennt. Aus den Werkzeugaufrufen lassen sich diese Orte nicht verlässlich ablesen: Schreibt ein Shell-Befehl oder ein von ihm gestartetes Skript, steht der Zielpfad nicht im Aufruf.

## Optionen

- (a) eigener Ordner im Workspace des Vorhabens, dem Agenten per `--append-system-prompt` genannt;
- (b) eigener Ordner unter den App-Daten, zusätzlich per `--add-dir` freigegeben;
- (c) Zielpfade aus den Werkzeugaufrufen und Befehlstexten erraten.

## Entscheidung

- **(a) `<Workspace>\.scratchpad\<session-id>`.** Der Core legt den Ordner bei jedem Start des Agenten an, falls er fehlt, speichert ihn an der Session und gibt ihn dem Agenten mit `--append-system-prompt` als einzige Ablage für Arbeitsdateien außerhalb der Repositories vor. Der Workspace ist ohnehin Arbeitsverzeichnis des Agenten und liegt im Scope des Asset-Protokolls (`$HOME/.verwalter/**`); es braucht keine neue Freigabe.
- **Je Session ein Unterordner**, weil alle Sessions eines Vorhabens denselben Workspace teilen.
- **Ein gemeldetes `scratchpad_path` wird ignoriert.** Sonst zeigte der Reiter einen anderen Ordner als den, in den der Agent schreibt. Alte Sessions bekommen beim nächsten Start den neuen Ordner; was im alten lag, zeigt der Reiter nicht mehr.

## Konsequenzen

- Der Agent hält sich an die Vorgabe, weil sie im Systemprompt steht. Erzwungen ist sie nicht: Ein Shell-Befehl kann weiter nach `%TEMP%` schreiben.
- Der Workspace jedes gestarteten Vorhabens bekommt einen Ordner `.scratchpad`; er wächst, bis das Vorhaben gelöscht wird.
- Projektanweisungen, die einen anderen Ablageort nennen (`_scratch\`), stehen gegen die Vorgabe; der Systemprompt-Zusatz verbietet Scratch-Ordner in Repositories ausdrücklich.
