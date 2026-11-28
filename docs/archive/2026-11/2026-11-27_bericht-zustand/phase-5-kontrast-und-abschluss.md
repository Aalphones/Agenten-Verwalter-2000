# Phase 5 — Kontrast im Theme, Plan fertig

Status: complete · Rating: mechanisch · Modell: sonnet

## Kontext

Lesen vor dem ersten Edit:

- `README.md` dieses Plans (finale AK 8), Report-Back der Phasen 1–4.
- `src/styles/theme.css` — Primitive `--color-amber-700`, `--color-orange-700`; im hellen Block `:root` die Tokens `--color-status-waiting`, `--color-accent`, `--color-fg-on-accent`.
- `docs/conventions/releases.md` (Version in drei Dateien, `chore(release)`, Tag, Push), Kritische Regel 6 in `AGENTS.md`.
- Fehlerklassen (Vault): `werkzeuge/git.md` → „Etikettenliste alphabetisch gelesen und für eine Versionsfolge gehalten“ (höchste Version mit `git tag --list 'v*' --sort=-v:refname` lesen — die parallele Umsetzung „MCP-Dialog verwalten“ kann inzwischen eine Version vergeben haben); „`git add <Ordner>` nimmt fremde ungetrackte Dateien mit“.

## AK der Phase

1. Im hellen Theme: `--color-amber-700` ist `#8a5700` (Schrift auf Weiß 6,10:1, auf `#f8f8f8` 5,74:1); `--color-accent` zeigt auf `--color-orange-700` (`#a8461f`, weiße Schrift 5,90:1). Das dunkle Theme bleibt unverändert.
2. Kontrast per Skript belegt: `python "%USERPROFILE%\.claude\sync\_vault\design\werkzeuge\kontrast.py" "#8a5700" "#ffffff" "#8a5700" "#f8f8f8" "#ffffff" "#a8461f"` endet mit Rückgabewert 0; Ausgabe im Report-Back.
3. Plan archiviert unter `docs/archive/2026-11/2026-11-27_bericht-zustand/`, README-Bottom-Sektionen gefüllt, `STATE.md` nachgezogen, Version angehoben, Tag gesetzt und gepusht.
4. `powershell -File scripts/check.ps1` endet mit `exit 0`.

## Checkliste

- [ ] `theme.css`: `--color-amber-700: #8a5700;` und im hellen `:root` `--color-accent: var(--color-orange-700);` (`--color-accent-subtle` und `--color-toggle-on` bleiben).
- [ ] Per Grep alle Stellen mit `--color-accent` als Fläche prüfen, ob sie mit dem dunkleren Ton noch von `--color-accent-text` unterscheidbar sein müssen (Auswahl-Markierung, Fortschritt); Fundstellen mit Auffälligkeit in den Report-Back.
- [ ] Kontrast nach AK 2.
- [ ] Plan fertig nach `docs/conventions/releases.md`: README-Sektionen Summary, Files touched, Commits, Deviations, Follow-ups füllen; Ordner nach `docs/archive/2026-11/` verschieben (`git mv`); `STATE.md` (Eintrag „Zuletzt archiviert“, ADR 075, keine Migration); Version in den drei Dateien, `chore(release)`-Commit, Tag `vX.Y.Z`, Push.
- [ ] Commits mit einzeln genannten Dateien; vorher `git status` und `git diff --cached --stat` lesen.

## Report-Back

`scripts/check.ps1`: exit 0. Kontrast (Rückgabewert 0):

```text
#8a5700 auf #ffffff: 6.10:1
#8a5700 auf #f8f8f8: 5.74:1
#ffffff auf #a8461f: 5.90:1
```

- Akzent-Fundstellen: keine Regel unterscheidet Zustände allein zwischen `--color-accent` und `--color-accent-text` (hell jetzt derselbe Ton). Schalter (`--color-toggle-on`) bleiben beim helleren Ton.
- Zusätzlich zur Checkliste: Skin-Standardfarben (`styleDefaults.ts`, `skins/model.rs`) auf `#a8461f`, veralteter Kommentar in `ReportButton.css` entfernt.
- Nicht am Bildschirm angesehen.
