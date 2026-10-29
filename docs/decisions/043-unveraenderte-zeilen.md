# 043 — Unveränderte Zeilen im Diff aufklappen

**Status:** angenommen · **Datum:** 2026-10-29

## Kontext

Der Diff einer Datei zeigt nur die Änderungen mit drei Zeilen Umgebung ([ADR 006](006-changes-und-diff.md): der Core liefert Diff-Zeilen, höchstens 20.000). Wer eine Änderung beurteilen will, braucht oft mehr Umgebung oder die ganze Datei, und der Diff kennt die Zeilen dazwischen nicht.

## Optionen

- **(a) Umgebung vergrößern und den Diff neu laden (`-U1000000`)** — verworfen: kein Aufklappen an der Stelle, Kürzung bei 20.000 Zeilen, jedes Mal ein Neuladen samt Flackern.
- **(b) Beide Fassungen vollständig laden und in der Oberfläche vergleichen** — verworfen wie in ADR 006: Gewicht und Verantwortung gehören nicht in die Oberfläche.
- **(c) Zeilen der neuen Fassung bereichsweise nachladen** — gewählt. Unveränderte Zeilen sind in alter und neuer Fassung gleich; die alte Nummer ergibt sich aus der neuen minus einem festen Abstand je Lücke.

## Konsequenzen

- Ein Befehl mehr: `changes_file_lines` liefert die Zeilen `von`–`bis` der neuen Fassung (Arbeitsverzeichnis, im Blickwinkel „Committet“ der letzte eigene Commit der Datei).
- `FileDiff` trägt `new_line_count`, damit die Oberfläche die Lücke nach der letzten Änderung kennt; bei Binärem, Gelöschtem, nicht Lesbarem und Dateien über 8 MB fehlt sie.
- ADR 006 bleibt gültig: der Diff selbst bleibt bei drei Zeilen Umgebung.
