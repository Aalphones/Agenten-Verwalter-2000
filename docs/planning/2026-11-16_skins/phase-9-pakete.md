# Phase 9 — Drei Figurenpakete bauen: Pokémon, Disney, Marvel

Rating: standard. Kein Programmcode. Die Session baut mit den Werkzeugen aus Phase 7 drei Figurenpakete aus **offiziellen Spiel-Sprites** und legt sie als ZIP ab. Nichts davon kommt ins Repository (öffentlich; Rechte bei Nintendo/Game Freak, Disney, Marvel).

## Voraussetzung

Die Werkzeuge `mcp__verwalter__skin_*` müssen da sein. Fehlen sie: Rückfrage „Bitte unter Einstellungen → Skins → Agent den Schalter „Agent darf Skins bearbeiten“ einschalten; danach starte ich neu.“ – nicht drumherum bauen.

## Kontext (lesen)

- [README.md](README.md) → Kontrakt; Werkzeug-Beschreibungen über `skin_list`
- Entwurf `#editor` ([artifacts/entwurf-skins.html](artifacts/entwurf-skins.html)): Pokémon-Texte als Vorlage für Ton und Länge
- Arbeitsdateien (Downloads, Zuschnitt) nur im Scratchpad der Session

## Regeln für Bilder

- Nur offizielle Sprites aus veröffentlichten Spielen; keine Fan-Art, keine KI-Bilder. Je Fach eine Quelle notieren (Spiel, Fundstelle).
- Animiertes GIF bevorzugt; liegt nur ein Bildbogen vor: 2–6 Bilder einer Ruhe- oder Lauf-Animation ausschneiden, Hintergrund transparent, als GIF mit 120–160 ms je Bild zusammensetzen (Python mit Pillow im Scratchpad, `uv run --with pillow`).
- Höhe 30–80 px, höchstens 2 MiB; einheitlicher Stil innerhalb eines Pakets (ein Spiel bzw. eine Spielreihe je Paket bevorzugen).
- Findet sich für eine Figur kein offizielles Sprite: nächste Figur aus der Ersatzliste desselben Fachs. Ist die Liste erschöpft: Fach ohne Bild, nur Texte, und im Report-Back nennen.

## Pakete

### Pokémon — Quelle: animierte Sprites Schwarz/Weiß, `https://img.pokemondb.net/sprites/black-white/anim/normal/<name>.gif` (geprüft 16.11.2026); Pokéball `https://img.pokemondb.net/sprites/items/poke-ball.png`

| Fach | Figur (Datei) | Bewegung | Texte (Beispiele, je 2–4 schreiben) |
|---|---|---|---|
| search | Bisasam (`bulbasaur`) | vine | „Bisasam setzt Rankenhieb ein und zieht {ziel} aus der Kiste …“ |
| read | Simsala (`alakazam`) | float | „Simsala liest {ziel} per Psychokinese …“ |
| write | Ditto (`ditto`) | squish | „Ditto verwandelt {ziel} …“ |
| shell | Pikachu (`pikachu`) | zap | „Pikachu setzt Donnerblitz auf „{ziel}“ ein …“ |
| web | Tauboss (`pidgeot`) | fly | „Tauboss fliegt los und sucht {ziel} …“ |
| agent | Glumanda (`charmander`) | summon | „Glumanda, du bist dran! {ziel} …“ |
| other | Porygon (`porygon`) | bob | „Ein wildes Werkzeug erscheint: {ziel} …“ |
| wait | Relaxo (`snorlax`) | sleep | „Ein Relaxo blockiert den Weg – seit {zeit} …“ |
| think | Enton (`psyduck`) | ponder | vier gestaffelte Texte wie im Entwurf |
| commit | Pokéball (Item) | wobble | „Gefangen! Commit {commit} ist im Ball.“ |
| station | Bisasam → Bisaknosp (`bulbasaur`, `ivysaur`) | evolve | „Bisasam entwickelt sich zu Bisaknosp – Station fertig.“ |

### Disney — Quellen in dieser Reihenfolge: Bildbögen offizieller Spiele bei The Spriters Resource (`spriters-resource.com`), u. a. *Kingdom Hearts: Chain of Memories* (GBA), *Disney's Aladdin* (SNES/Genesis), *The Lion King* (SNES/Genesis), *Disney's Lilo & Stitch* (GBA), *Disney Fairies: Tinker Bell* (DS)

| Fach | Figur | Ersatz | Bewegung | Text-Idee |
|---|---|---|---|---|
| search | Stitch | Mickey | vine → in `bob` ändern, falls die Figur keine „Hand“ hat | „Stitch durchwühlt {ziel} – Ohana heißt: nichts geht verloren …“ |
| read | Belle | Aladdin | float | „Belle verschlingt {ziel} …“ |
| write | Tinker Bell | Fee/Merlin | sparkle | „Tinker Bell streut Feenstaub über {ziel} …“ |
| shell | Dschinni (Genie) | Donald | zap | „Der Dschinni erfüllt den Befehl „{ziel}“ …“ |
| web | Arielle | Peter Pan | wave | „Arielle taucht ins Netz nach {ziel} …“ |
| agent | Mickey | Sora | summon | „Mickey ruft Verstärkung: {ziel} …“ |
| other | Donald | Goofy | bob | „Donald schnattert mit {ziel} …“ |
| wait | Goofy | Puuh | sleep | „Goofy macht ein Nickerchen – seit {zeit} …“ |
| think | Winnie Puuh | Merlin | ponder | „Denk, denk, denk …“ (3 gestaffelte Texte) |
| commit | Mickey | Simba | popin | „Und wenn sie nicht gestorben sind, dann ist es committet.“ |
| station | junger Simba → Simba | Tinker Bell | evolve (mit zwei Bildern), sonst popin | „Hakuna Matata – Station fertig.“ |

Vaiana, Anna und Elsa haben nach heutigem Stand keine offiziellen Pixel-Sprites; nur aufnehmen, wenn ein offizielles Spiel-Sprite gefunden wird (dann z. B. Vaiana im Fach `web`, Elsa mit `frost` im Fach `think`).

### Marvel — Quellen: Bildbögen von *Marvel vs. Capcom 2* und *Marvel Super Heroes* (Capcom) bei The Spriters Resource

| Fach | Figur | Ersatz | Bewegung | Text-Idee |
|---|---|---|---|---|
| search | Wolverine | Venom | bob | „Wolverine wittert {ziel} …“ |
| read | Psylocke | Rogue | float | „Psylocke liest {ziel} per Telepathie …“ |
| write | Iron Man | War Machine | beam | „Iron Man schweißt an {ziel} …“ |
| shell | Storm | Thor (falls vorhanden) | zap | „Storm ruft den Blitz: {ziel} …“ |
| web | Spider-Man | Venom | webShot | „Spider-Man schwingt durchs Web: {ziel} …“ |
| agent | Captain America | Cyclops | shield | „Avengers, versammelt euch! {ziel} …“ |
| other | Rogue | Gambit | bob | „S.H.I.E.L.D. prüft {ziel} …“ |
| wait | Hulk | Juggernaut | sleep | „Hulk ruht. Hulk wartet seit {zeit} …“ |
| think | Doctor Doom | Magneto | ponder | „Doom wägt ab …“ (3 gestaffelte Texte) |
| commit | Captain America | Iron Man | popin | „Ich bin Iron Man. Commit {commit} steht.“ |
| station | Thanos | Hulk | popin | „Unvermeidlich – Station fertig.“ |

### Stilpakete zu den drei Fandoms

Je Fandom ein Stilpaket gleichen Namens mit dem Zusatz „Stil“ („Pokémon Stil“, „Disney Stil“, „Marvel Stil“), gebaut mit `skin_create { kind: "style" }`, `skin_style_set`, `skin_image_set`:

- **Farben** (dunkel und hell, je sieben Werte): aus den Leitfarben des Fandoms abgeleitet – Pokémon: Grün der Bisasam-Linie als Akzent; Disney: Königsblau mit Gold als Akzent; Marvel: Rot mit Gold als Akzent. Text und Text gedämpft müssen gegen Hintergrund Inhalt und Flächen mindestens 4,5:1 erreichen, Akzent gegen Hintergrund Inhalt mindestens 3:1 (Formel WCAG, wie die Warnmarken im Editor); erreichte Werte in `quellen.md`.
- **App-Symbol:** ein Sprite des Figurenpakets als PNG, quadratisch auf 64 × 64 px gesetzt (transparent aufgefüllt, ohne Glätten vergrößert): Pokémon Bisasam, Disney Mickey (Ersatz Stitch), Marvel Spider-Man (Ersatz Captain America).
- **Hintergrundbilder:** nur offizielles Material (z. B. Hintergrund-Bildbögen derselben Spiele bei The Spriters Resource), sonst leer lassen. Deckkraft Seitenleiste 20 %, Inhalt 10 %.

## AK

1. Drei Figurenpakete „Pokémon“, „Disney“, „Marvel“ existieren im Verwalter; jedes vorgegebene Fach hat Bewegung und 2–4 Texte, Bilder nach den Regeln oben. Dazu drei Stilpakete „Pokémon Stil“, „Disney Stil“, „Marvel Stil“ nach dem Abschnitt oben.
2. Je Paket ein ZIP unter `%USERPROFILE%\.verwalter\skin-pakete\` (`pokemon.zip`, `disney.zip`, `marvel.zip`, `pokemon-stil.zip`, `disney-stil.zip`, `marvel-stil.zip`), erzeugt mit `skin_export` im Arbeitsordner und dorthin kopiert; daneben `quellen.md` (je Paket und Fach bzw. Bild: Figur, Spiel, Fundstelle, Ersatz ja/nein; bei Stilpaketen die Kontrastwerte).
3. `git status` im Repository zeigt keine Bild- oder ZIP-Datei.
4. Report-Back nennt Fächer ohne Bild und genommene Ersatzfiguren.

## Checkliste

- [ ] Voraussetzung prüfen (`skin_list`).
- [ ] Pokémon bauen (`skin_create`, je Fach `skin_image_set` mit Adresse, `skin_slot_set`).
- [ ] Disney: Quellen suchen, zuschneiden, bauen.
- [ ] Marvel: Quellen suchen, zuschneiden, bauen.
- [ ] Drei Stilpakete bauen (Farben prüfen, Symbol zuschneiden, Hintergründe nur aus offiziellem Material).
- [ ] `skin_export` ×6, Kopie nach `%USERPROFILE%\.verwalter\skin-pakete\`, `quellen.md` schreiben.
- [ ] `git -C <Repository> status --short` prüfen.

## Report-Back
