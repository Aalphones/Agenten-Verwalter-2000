# 073 — Review-Bericht je Umsetzung

**Status:** angenommen · **Datum:** 2026-11-26

## Kontext

Wer eine Umsetzung ([ADR 048](048-umsetzung.md)) abnimmt, liest bisher ein HTML-Artefakt, das jede Station nach eigenem Muster baut, und die rohen Diffs. Das Artefakt kostet Tokens, veraltet mit der nächsten Fix-Runde, und Kommentare daran erreichen niemanden. Stattdessen soll je Umsetzung ein Bericht mit den Stationen wachsen. Entwurf und Kontrakt: Plan `2026-11-26_review-bericht`.

## Optionen

- **Oberfläche:** (a) die Betrachter-Seite des Entwurfs im iframe — verworfen: Kommentare, Abnahme und Sprünge in „Dateien“ brauchen die Stores der App. (b) React-Feature, in das der Entwurf portiert wird — gewählt.
- **Ablage:** (a) Markdown-Dateien je Phase — verworfen: Critical Rule 3 verlangt SQLite, und Nummern, Befunde und ihre Behebung wären nur aus dem Text zu lesen. (b) Eine Zeile je Eintrag mit Markdown-Text — gewählt.
- **Ordnung durch Haiku am Phasenende:** (a) Antwort als fertiges Markdown — verworfen: ob alle Einträge vorkommen und keiner erfunden ist, ließe sich nur raten. (b) Antwort als JSON nach Schema — gewählt.

## Entscheidung

- Stationen hängen über den Werkzeugsatz `report_` im MCP-Zugang ([ADR 046](046-mcp-zugang.md)) Einträge an: `report_note`, `report_figure`, `report_screen`. Der Präfix ist Pflicht je Satz, deshalb nicht `note`/`figure`. Das Feature heißt `report`, weil `review` die Review-Kommentare belegt.
- Einträge liegen in `report_entries`, Ordnung und Prüfwerte in `report_phases` (Migration 023). Die Nummer `n<k>` zählt je Phase und entsteht in der Transaktion des Einfügens. Bilder werden nach `<Datenordner>\reports\<Umsetzung>\<Phase>\` kopiert.
- Rohfassung und geordnete Fassung entstehen als Markdown; Haiku sieht nur Markdown, antwortet als JSON, und der Verwalter schreibt daraus die geordnete Fassung. Die ID-Prüfung ist so mechanisch.
- Geordnet wird, sobald die Agenten-Stationen einer Phase fertig sind. Stationen `by: "you"` zählen nicht: sonst bliebe die letzte Phase ungeordnet, bis der Benutzer abgenommen hat — er liest den Bericht aber vorher.
- Code steht in keinem Eintrag: ein Eintrag merkt Ort und Wortlaut der Zeilen, den Code liest der Verwalter aus Git.
- Die Anweisung dazu bekommen nur Claude-Stationen mit Zugang, im gemeinsamen `--append-system-prompt` ([ADR 061](061-schlanke-werkzeuge-in-stationen.md)).
- Kommentare an die Rückfrage: Stellen im Bericht (Codezeilen, Stopps, Schaubilder, Bildschirme, Bildbereiche) werden als Review-Kommentare (`CommentTarget::Report`) gesammelt und mit „Kommentare senden“ an die Rückfrage der Umsetzung geschickt, die neueste nicht archivierte Session mit `inquiryOf` = Umsetzung; gibt es keine, legt das Senden eine an. Damit landen sie bei der Session, die Stationen ergänzen darf, nicht in einer Station. „Abnehmen“ ist gesperrt, solange Kommentare gesammelt sind, weil nach der Abnahme keine Stationen mehr ergänzt werden können; der Zustand der Abnahme kommt aus dem Live-Stand der Umsetzung, weil der Bericht nur bei `report://changed` neu geladen wird.
- Die Sichtabnahme hat ein eigenes Werkzeug, ein Aufruf je Bildschirm, damit Ansichten, Entwurf, Abweichung und Klickpfad zusammenbleiben; Haiku ordnet sie nicht.

## Konsequenzen

- Stationen schreiben keinen HTML-Bericht mehr; die Skills werden entsprechend umgestellt.
- Codex, LM Studio und der autarke Agent haben die Anweisung nicht; ihr Bericht zeigt nur Code und Prüfwerte.
- Bildmaße liest der Core selbst aus dem Dateikopf (PNG, JPEG, GIF, WebP), ohne Bild-Bibliothek.
- Ohne `at` rät der Verwalter nur, wenn die Stelle des letzten Edits genau einmal vorkommt; sonst muss der Agent `at` nennen.
