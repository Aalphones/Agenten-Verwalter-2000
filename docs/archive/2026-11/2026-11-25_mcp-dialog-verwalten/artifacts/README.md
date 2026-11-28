# Artifacts

| Datei | Screen | Phase | Ansehen |
|---|---|---|---|
| `mcp-dialog-entwurf.html` | Dialog „MCP-Server“: Liste, Details, Rückgängig, Formular, Werkzeug-Ansicht | 4, 5 | Im Browser öffnen; Entwurfsleiste oben schaltet Zustand (Agent läuft/ruht/neu/lädt/keine Server), Breite (Fenster/860/390) und Hell/Dunkel. URL-Parameter: `?theme=dark&w=390&state=idle&open=<id>&view=form` |

- **Werte:** Farben, Schriften, Abstände aus `src/styles/theme.css`; der dunkle Akzent (Lime) ist der Skin aus dem Screenshot des Benutzers, im Code gilt `--color-accent`.
- **Platzhalter:** Servernamen und Werkzeug-Anzahlen aus einem Screenshot vom 2026-11-25; Repository-Zuordnung (gymid, ants-manager), Pfade, Header, Werkzeugnamen außer `dispatch`/`verwalter` und Anweisungstexte sind erfunden.
- **Neu erzeugen:** Handarbeit, eine Datei ohne Abhängigkeiten; Kopie liegt im Artefakte-Ordner des Vorhabens.
