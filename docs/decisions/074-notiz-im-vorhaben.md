# 074 — Notiz im Vorhaben

**Status:** angenommen · **Datum:** 2026-11-26

## Kontext

Der Agent liefert Befehle, in die Token oder Passwörter von Hand gehören. Dafür braucht jedes Vorhaben eine Notiz neben dem Terminal, die kein Agent mitliest.

## Optionen

- **(a) Scratchpad im Workspace plus Sperren** — verworfen: jede Suche und jede Liste im Arbeitsordner träfe die Datei, die Sperren müssten überall nachgezogen werden.
- **(b) Datei im Datenordner des Verwalters** — gewählt: `%USERPROFILE%\.verwalter\notizen\<Vorhaben-ID>.txt`, außerhalb jedes freigegebenen Ordners; der Pfad geht an keinen Agenten.

## Entscheidung

Eine Notiz je Vorhaben, UTF-8, höchstens 1 MiB, geschrieben über eine Zwischendatei und Umbenennen. Reiter „Notiz“ links im Terminal-Dock; ausgeblendet nur im Speicher, die Datei bleibt. Selbstspeichern 500 ms nach dem letzten Tastendruck und beim Verlassen. Archivieren lässt die Notiz liegen.

## Konsequenzen

Die Notiz liegt im Klartext auf der Platte: wer den Datenordner liest, sieht die Token. Keine Erkennung fremder Änderungen, der letzte Stand gewinnt. Keine Migration.
