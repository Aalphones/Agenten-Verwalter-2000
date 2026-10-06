# 026 — Artefakte: HTML-Seiten des Agenten im Verwalter zeigen

**Status:** angenommen · **Datum:** 2026-10-06

## Kontext

Berichte, Präsentationen, Diagramme und Design-Entwürfe sind als HTML-Seite am besten lesbar. Der Agent soll sie ablegen, der Verwalter sie als echte, bedienbare Seite zeigen und nach jedem Speichern neu laden. Die Seite ist fremdes HTML mit Skripten im Fenster des Verwalters: sie darf weder dessen Befehle aufrufen noch Dateien außerhalb ihres Ordners lesen.

## Optionen

- Ablage: (a) Ordner `.artefakte` im Workspace + Anweisung an den Agenten, (b) eigenes MCP-Werkzeug „Ansicht zeigen“, (c) jede vom Agenten geschriebene `.html`-Datei.
- Darstellung: (a) `srcdoc` im Rahmen — erbt die CSP der App und findet keine relativ eingebundenen Bilder; (b) Asset-Protokoll von Tauri — Scope ist `$HOME/.verwalter/**`, Workspaces liegen woanders, und es setzt keine eigene CSP; (c) eigenes Protokoll mit eigener CSP.

## Entscheidung

- **Ablageordner `.artefakte` je Vorhaben** (alle Sessions teilen den Workspace). Ein Artefakt ist jede `.html`/`.htm`-Datei direkt darin; Unterordner tragen Bilder, Skripte und Stylesheets.
- **Eigenes Protokoll `artefakt`** (`http://artefakt.localhost/<session-id>/<pfad>`): liefert nur Dateien, deren kanonischer Pfad unter dem kanonischen Ordner liegt (sonst 403), mit eigener CSP je Antwort.
- **Rahmen mit `sandbox="allow-scripts allow-forms allow-modals"`, ohne `allow-same-origin`**: die Seite läuft mit undurchsichtiger Herkunft, kommt nicht an `parent` und bekommt die Init-Skripte für `invoke` nicht (die laufen nur im Hauptframe).
- **Internet über https erlaubt** (Bibliotheken von CDNs): der Agent, der das HTML schreibt, hat ohnehin eine Shell. `ipc:` und `http://ipc.localhost` stehen nicht in der CSP.
- **Abfrage alle 2 s statt Dateiwächter**: keine neue Abhängigkeit, erfasst auch per Shell geschriebene Seiten.

## Konsequenzen

- Die App-CSP bekommt `frame-src http://artefakt.localhost`; Links nach außen öffnen sich im Rahmen nicht.
- Formulare schicken nichts ab (`form-action 'none'`), Popups gehen nicht.
- Eine Seite mit `http://`-Quellen (ohne s) lädt diese nicht.
- Die Abschottung belegt die Sicherheitsprobe im Plan (`artifacts/sicherheitsprobe.html`), kein automatisierter Test.
