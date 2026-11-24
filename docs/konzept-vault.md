# Konzept: Developer Vault und Zusammenarbeit der Sessions

**Stand:** 2026-11-22 · **Verbindlich für:** die Planung der Folgepläne nach dem Plan [Developer Vault – Bibliothekskern](archive/2026-11/2026-11-22_developer-vault/README.md) · **Quelle:** Gesamtkonzept des Benutzers, hier verdichtet. Ausgelassen sind Teile über die persönliche Arbeitsumgebung, die Profile der Skills und einzelne externe Dienste — sie gehören nicht ins Repository und ändern an den Plänen nichts.

Teil A beschreibt das Ziel, Teil B, was davon im Verwalter schon steht und wie die Arbeit in Pläne geschnitten ist. Entscheidungen eines einzelnen Plans stehen in dessen ADR; wo eine ADR von diesem Dokument abweicht, gilt die ADR.

---

# Teil A — Konzept

## 1. Ziel

Der Verwalter wird vom Session-Verwalter zu einem schlanken, lokalen Arbeitsplatz für Entwicklungsabläufe mit mehreren Agenten-Sessions. Zwei Bereiche, klar getrennt:

1. **Verwalter:** Sessions, Umsetzungen, Stationen, Werkzeuge, Kommunikation zwischen Sessions, Kontextübergabe, lokale Ausführung, Rechte.
2. **Developer Vault:** eine über Jahre wachsende persönliche Entwicklerbibliothek — Wissen, Ideen, Konzepte, Snippets, Beispielimplementierungen, Vorlagen, Designs, Bilder, Skripte, Agenten-Leitfäden.

Der Vault gehört dem Benutzer und bleibt auch ohne Verwalter eine verständliche Dateiablage; Agenten sind starke Nutzer, aber nicht sein Zweck. Beide Bereiche sparen Arbeit: der Vault verhindert, dass gute Lösungen immer wieder neu gesucht werden; der Verwalter verhindert unnötige Werkzeug-Runden, doppelte Recherche, verlorene Erkenntnisse und überladene Kontexte.

## 2. Leitplanken

- **Keep it simple:** Bestehendes zuerst untersuchen und wiederverwenden; die kleinste Lösung, die den Zweck erfüllt; keine Abstraktionen auf Vorrat; keine zusätzlichen Server oder Dienste ohne klaren Bedarf; keine Testsuiten, keine Benchmark-Kampagnen — gezielte Prüfungen von Hand genügen; Messwerte nur, wo sie ohnehin anfallen und eine Entscheidung stützen; bei Unsicherheit die einfache, rückbaubare Lösung.
- **Local First:** Was deterministisch und lokal geht (Dateien lesen und vergleichen, Hashes, Indizes, Volltextsuche, Embeddings, Git-Status, Prüfkommandos bündeln, Ergebnisse aufbereiten), läuft lokal. Das Modell ist für Denken, Planen und Umsetzen da.
- **Dateien sind die Wahrheit:** Quelldateien bleiben maßgeblich. SQLite, Kataloge, FTS5-Daten und Embeddings sind Laufzeit- und Suchdaten und müssen aus den Dateien rekonstruierbar sein.
- **Optional:** Der Verwalter bleibt ohne Vault, ohne synchronisiertes Laufwerk, ohne Embedding-Modell und ohne externe Wissensdienste für alles bisherige voll nutzbar.
- **Keine Parallelwelten:** Externe MCP-Server bleiben Eigentümer ihrer Werkzeuge; vorhandene Verwalter-Funktionen werden erweitert, nicht nachgebaut; Projektwissen bleibt im Repository; der Vault ist kein zweites Projekt-Wiki; Session- und Laufzeitdaten bleiben in der Datenbank des Verwalters, nicht im Vault.
- **Entscheidungsregel:** Legt dieses Dokument eine Einzelheit nicht fest, gilt die einfachste Lösung, die den Zweck zuverlässig erfüllt und in die vorhandene Architektur passt.

## 3. Zuständigkeiten

| Bereich | Beantwortet | Typische Inhalte |
|---|---|---|
| Verwalter | Wer arbeitet woran, mit welchem Kontext und welchen Werkzeugen, wie reden die Sessions miteinander? | Sessions, Umsetzungen, Stationen, Nachrichten, Briefings, Werkzeuge, Ergebnisse, Rechte |
| Developer Vault | Was habe ich schon gesammelt, gelernt oder gebaut, das ich wiederverwenden kann? | Wissen, Snippets, Ideen, Konzepte, Designs, Vorlagen, Skripte, Leitfäden |
| Projekt-Repository | Wie ist dieses Projekt gebaut, was gilt hier? | Code, Anforderungen, Architektur, ADRs, Pläne, Findings, Projektdoku |
| Datenbank des Verwalters | Laufzeit und Suchindex | Sessions, Verläufe, Nachrichten, Zustände, Indizes, Ergebnisse, Caches |

Die Zuständigkeiten werden nicht vermischt. Der Developer Vault ist ein eigener Vault mit eigenen Regeln, eigenem Index und eigenen Suchdaten; andere Wissenssammlungen des Benutzers bleiben getrennt.

## 4. Was in den Vault gehört

Wissen und Artefakte, die über einzelne Projekte hinaus nützlich sind, auch spezifisches Fachwissen, sofern verallgemeinerbar und nicht vertraulich: Programmier-, Sprach- und Frameworkwissen, Datenbanken, Architektur- und Designprinzipien, Werkzeuge, Fehlerklassen mit Lösungen, Snippets und Rezepte, Beispielimplementierungen, Vorlagen, neutrale Designs und Assets, Konzepte und Produktideen, projektübergreifende Agenten-Mechanismen.

**Bleibt im Projekt-Repository:** Projektarchitektur und ADRs, Anforderungen und Geschäftslogik, projektspezifische Datenmodelle und APIs, Pläne und Stand, projektspezifische Fehlerberichte und Ticketinformationen, interne Endpunkte, Zugangsdaten, Kundendaten, vertrauliche Firmeninformationen, projektspezifische Skills und Skripte.

**Vertraulichkeit ist nicht automatisch garantiert.** Eine Erkenntnis aus einem Firmenprojekt darf in den Vault, wenn sie abstrahiert und ohne vertraulichen Kontext anderswo nützlich ist (ja: der allgemeine Mechanismus eines Datenbankfehlers und seine Lösung; nein: der Fehlerbericht mit Kundendaten, Tabellennamen, Ticketnummern, Endpunkten). Herkunft allein ist weder Freigabe noch Ablehnung. Einordnung von Kandidaten:

- `general` — projektübergreifend, nicht vertraulich
- `project` — gehört ins Projekt-Repository
- `sensitive` — vertraulich, nicht in den Vault
- `unclear` — Herkunft oder Sensibilität offen; nicht übernehmen

## 5. Aufbau des Vaults

**Bibliothek statt starres Schema.** Ein Eintrag kann eine Datei, ein Snippet, eine Dateigruppe, ein Ordner mit Beispielimplementierung, ein kleines Projekt, ein Konzept mit Anhängen, ein Designpaket oder eine Sammlung von Varianten sein. Der Katalog beschreibt, verändert aber nicht die Form.

**Startstruktur als Vorschlag**, keine leeren Kategorien auf Vorrat: `inbox/` (ideas, concepts, snippets, designs, files), `library/` (development, ui-ux, templates, concepts, tools), `agent-guidance/` (topics, skills, mechanisms, capabilities, workflows), `prompts/`, `_tools/`. Die Ordner wachsen mit der Nutzung.

**Reibungsarm sammeln:** alles darf zuerst in `inbox/`; keine Klassifizierung beim Ablegen; einfache Dateien brauchen keine Metadaten; die Inbox ist durchsuchbar; Agenten dürfen Titel, Beschreibung, Tags und Zielort *vorschlagen*.

**Metadaten optional** (Suche verbessern, Aufnahme nicht behindern): stabile ID, Titel, Beschreibung, Art, Tags und Aliasse, Technologien und Plattformen, Herkunft, Geltungsbereich, Vertrauensgrad und Gültigkeit, Lizenz, Status, Vorschau und Einstieg, Beziehungen. Vorhandene Skill-Formate bleiben unverändert; Metadaten möglichst ergänzen, ohne die Originaldatei umzuschreiben.

**Ideen** haben einen Lebenszyklus `inbox` → `exploring` → `ready` → `promoted`, dazu `parked` und `rejected`. Spätere Bearbeitung: wiederfinden, offene Fragen ergänzen, Alternativen ausarbeiten, Verwandtes finden, zum Konzept oder Plan machen. Nach der Übernahme in ein Projekt ist das Repository die Wahrheit; die Idee bleibt nachvollziehbar.

## 6. Designbibliothek

Fundus guter visueller Beispiele: Dashboards, Desktop-Oberflächen, Websites, Formulare, Navigation, Tabellen und Diagramme, Dialoge, Komponenten, Interaktionsmuster, Farbwelten und Typografie, Designsysteme, Screenshots, Icons, HTML/CSS/JS-Beispiele, Prototypen. Ein Designbeispiel ist ein zusammengehöriger Ordner (z. B. `manifest.yaml`, `README.md`, `preview.png`, `index.html`, `styles.css`, `script.js`, `assets/`); ein Screenshot mit kurzer Beschreibung reicht auch.

**Agent bei einer Designaufgabe:** Aufgabe und Plattform erkennen → passende Beispiele über Beschreibung, Tags, Technologien suchen → Vorschauen ansehen → bei Bedarf HTML, CSS, JS und Assets laden → Layout, Komponenten, Hierarchie und Regeln ableiten → kombinieren und projektspezifisch umsetzen. Nicht blind kopieren.

**Sicherheit:** Code im Vault ist Referenzmaterial, nie automatisch ausgeführt; Vorschauen kontrolliert und lokal, aktive Inhalte und externe Ressourcen begrenzt; Designartefakte getrennt von registrierter Skriptausführung; Herkunft und Rechte übernommener Bilder, Icons, Schriften dokumentieren. Keine aufwendige Vorschau-Sandbox ohne konkreten Bedarf.

**Visuelle Suche in Version 1:** keine Bild-Embeddings, keine multimodale Suche — Bilder über Metadaten finden, Vorschaubilder bereitstellen, ausgewählte Vorschauen dem Agenten zeigen, Quelldateien erst bei Bedarf laden.

## 7. Agenten-Leitfäden im Vault

Hilfen, die Bibliothek gut zu nutzen — nicht die Sammlung selbst.

- **Topics:** Regeln je Rolle und Aufgabe, z. B. vor dem Bauen im Vault suchen, vor UI-Arbeit Designreferenzen holen, Projektwissen nicht in den Vault, vorhandene Skripte vor neuen prüfen, Ergebnisse knapp mit Quellenangabe weitergeben.
- **Skills:** vorhandene Formate behalten, keine eigene Pflichtsyntax; je Rolle und Aufgabe laden, bei Bedarf nachladen; dürfen auf Wissen, Designs, Snippets, Mechanismen und Skripte verweisen; ziehen nie die ganze Bibliothek oder große Kataloge in den Kontext.
- **Mechanismen:** wiederverwendbare Verfahren (Kontext aufbereiten, Übergabe, Fehleranalyse, Wissenskandidaten erstellen, Lösungen wiederverwenden, Designreferenzen wählen, große Ergebnisse kompakt bereitstellen) — als Markdown-Anleitungen, keine zweite Workflow-Engine.
- **Skripte:** bevorzugt Python, PowerShell und Bash nur bei Bedarf; klarer Zweck, definierte Eingaben, strukturierte Ausgabe, Plattformvoraussetzungen angegeben, ohne unnötige Interaktion, nur mit nötigen Rechten.
- **Capabilities:** beschreiben eine Fähigkeit und verweisen auf ihre Teile (Skill, Skript, Voraussetzungen), statt Inhalte zu doppeln; eine Registry hält Beschreibung, Verfügbarkeit, Abhängigkeiten, Rechte, Version — wird nie Eigentümer externer MCP-Werkzeuge.
- **Workflows:** wiederkehrende Abläufe (Feature, Bugfix, Architekturänderung, Debugging, Release) über die vorhandenen Stationen und Umsetzungen des Verwalters — keine zweite Orchestrierung.

## 8. Suche, Katalog, Index

| Suchweg | Aufgabe |
|---|---|
| SQLite FTS5 | exakte Begriffe, Titel, Dateinamen, IDs, Tags, Aliasse, Code, Fehlermeldungen |
| Embeddings | sinngleiche Fragen, ähnliche Konzepte und Probleme |
| Metadatenfilter | Art, Technologie, Plattform, Tags, Status, Herkunft |
| Beziehungen | verwandte und zusammengehörige Einträge |
| Vorschau | ausgewählte Designs und Bilder beurteilen |

**Ablauf:** Bereich und Rechte bestimmen → Metadaten und FTS5 → semantische Suche ergänzen, wenn verfügbar → zusammenführen und Doppeltes entfernen → kurze Treffer mit Pfad, Art, Beschreibung → Original, Vorschau oder Abschnitt erst auf Anforderung. Die Suche muss ohne Embedding-Modell brauchbar bleiben.

**Zerlegung nach Inhaltstyp:** Markdown nach Überschriften; Konzepte nach Themen und offenen Fragen; Snippets je Datei oder Funktion; Skills nach Beschreibung und Anweisungsabschnitten; Topics nach Regeln; HTML/CSS/JS nach Metadaten, Komponenten, Textbereichen; Workflows nach Stationen; Designpakete nach Beschreibung, Komponenten, Technologien, README. Jeder Abschnitt verweist auf Datei und möglichst Stelle. Binärdateien über Metadaten und Namen.

**Inkrementell:** Änderungen erkennen, beim Start abgleichen, Hashes gegen unnötige Arbeit, nur Geändertes neu, Gelöschtes raus, eine kaputte Datei blockiert nie den Lauf. Kataloge und Indizes werden erzeugt, nie von Hand bearbeitet; große Kataloge in Teilkataloge.

**Manifest des Index:** Schema- und Indexversion, Modell-ID und Revision, Dimensionen, Tokenizer und Vorverarbeitung, Zerlegungs- und Ranking-Parameter. Embeddings verschiedener Modelle oder Vorverarbeitungen nie im selben Suchraum; ein Modellwechsel löst eine kontrollierte Neuberechnung aus.

## 9. Lokale Embeddings

Embeddings entstehen im Verwalter über ONNX Runtime, ohne eigenen Dienst. Erster Kandidat: Qwen3-Embedding; Modellvariante, Tokenizer, Dimensionen und Laufzeitanforderungen vor dem Bau prüfen. Der Anbieter bleibt austauschbar. Das Modell liegt im Datenordner des Verwalters, nie im Vault oder in Git; geladen erst bei Bedarf, der App-Start wartet nie darauf. Fehlt das Modell oder scheitert die Rechnung: FTS5 bleibt, der Verwalter bleibt voll nutzbar, ein einfacher Status zeigt es an.

## 10. Zusammenarbeit der Sessions

**Ziel:** Sessions arbeiten nicht isoliert. Gerade bei Umsetzungen mit frischen Sessions je Station müssen Erkenntnisse, Entscheidungen und offene Fragen zuverlässig weitergehen — innerhalb einer Umsetzung und zwischen anderen berechtigten Sessions.

**Persistente Nachrichten** in der Datenbank des Verwalters: Erkenntnisse, Lösungsansätze, Entscheidungen mit Begründung, offene Fragen, Warnungen, relevante Dateien, Übergaben, Aufgaben für eine Folgesession. Mindestens Absender, Empfänger bzw. Ziel, Zeit, Bezug (Umsetzung, Vorhaben) und Inhalt; optional Art und Priorität.

**Aktiv und per Abruf:** eine Session adressiert eine andere Session oder einen Umsetzungskontext; Empfänger rufen ihre Inbox ab. Kein Echtzeit-Chat — ein persistenter Kanal mit Abruf reicht.

**Frühere Arbeit finden:** Was hat die vorige Station gemacht? Welche Entscheidungen, Probleme, ausprobierten Lösungen gab es? Was ist für die aktuelle Aufgabe relevant? Über vorhandene Verläufe, Findings, Reviews und Nachrichten, vorhandene Suchen wiederverwenden.

**Geltung:** Nachrichten und Verlauf bleiben in ihrem Projektkontext und in den Grenzen der Rechte; verschiedene Arbeitskontexte vermischen sich nie versehentlich; der Vault ersetzt keine Nachrichten; die Datenbank wird nicht über Laufwerke synchronisiert. Austausch zwischen zwei Rechnern ist nicht Teil des Grundumfangs und bräuchte einen eigenen, sicheren Weg.

## 11. Kontextübergabe

**Briefing beim Start einer Station**, kompakt und aufgabenbezogen: Ziel und Stand der Umsetzung, Aufgabe und Erfolgskriterien der Station, relevante Findings der Vorgänger, Entscheidungen, bekannte Probleme und offene Fragen, relevante Dateien, passende Skills und Topics aus dem Vault, verfügbare Werkzeuge und Rechte, Nachrichten an die Station.

**Nachladen statt vorladen:** frühere Findings, einzelne Nachrichten, Verlaufsausschnitte, Vault-Einträge, große lokale Ergebnisse — auf Anforderung. **Kontextbudget:** nur Relevantes, keine ganzen Kataloge oder Verläufe, Skills gezielt, Werkzeugsätze je Rolle klein, große Ausgaben als Verweis; das Briefing wird nie künstlich bis zu einem Budget aufgefüllt.

**Leichter Aufgabenvertrag** nur, wenn Plan und Station die Angaben nicht schon tragen: Ziel und erwartetes Ergebnis, Eingaben und Verweise, Rolle und Fähigkeiten, Grenzen und Rechte, Erfolgskriterien, Ausgabeform, Budget- oder Laufzeitgrenzen, nötige Abschlussprüfung.

## 12. Werkzeuge für Agenten

Wenige, verständliche, aufgabenorientierte Werkzeuge; ein Aufruf erledigt eine sinnvolle Arbeitseinheit. Vorhandene Werkzeuge haben Vorrang. Stand der vorgeschlagenen Gruppen:

| Aufgabe | Name | Stand |
|---|---|---|
| Umsetzung und Lagebericht abrufen | `implementation_get` | vorhanden (ADR 048) |
| Station abschließen | `implementation_complete_station` | vorhanden |
| Nachricht senden / Inbox lesen | `session_message`, `session_inbox` | Plan C |
| Frühere Sessions suchen / Verlauf laden | `session_search`, `session_context` | Plan C |
| Vault durchsuchen / Inhalt laden | `vault_search`, `vault_get` | Plan A |
| Fähigkeit ausführen, Ergebnisse laden und durchsuchen | `capability_run`, `result_get`, `result_excerpt`, `result_search` | zurückgestellt |

Externe MCP-Server behalten ihre Werkzeuge; der Verwalter verwaltet nur Verfügbarkeit, Zuordnung, Rechte und Lebenszyklus der Verbindung.

## 13. Lokale Ausführung und Ergebnisverweise (zurückgestellt)

Idee: mehrere deterministische Schritte (Bau starten, Status, Log öffnen, Fehler herausziehen, zusammenfassen) als ein lokaler Aufruf mit strukturiertem Ergebnis; große Ausgaben bleiben lokal, der Agent bekommt Kennung, Status, Kurzfassung, wichtige Kennzahlen und lädt Details nach. Keine universelle Shell-Plattform — nur registrierte, klar beschriebene Fähigkeiten. **Rechte hybrid:** Routine und sichere lokale Aufgaben autonom; Projektänderungen nach den bestehenden Rechte-Regeln; riskante, zerstörende oder nach außen wirkende Aktionen (Push, Release, Produktivänderungen, Löschen, nicht freigegebene Systembereiche) mit Freigabe. **Neue Skripte von Agenten:** Kandidat → Inhalt und Rechte prüfen → Probe von Hand → Freigabe nach Risiko → erst dann registrieren.

## 14. Reviews und Wissensübernahme

Session-Reviews, Mini-Retros und Audits erkennen wiederholte Fehler, zu große Werkzeug-Ausgaben, fehlende Werkzeuge, Skills oder Topics, wiederkehrende Handarbeit, allgemeingültige Erkenntnisse und gute Muster. Sie erzeugen **Kandidaten**, nie ungeprüfte Änderungen. Ziele eines Kandidaten: Vault, Projekt-Repository, Verwalter, Benutzer-Anweisungen.

**Übernahme:** Kandidat erstellen → Bestand und Doppeltes suchen → Geltung, Herkunft, Anwendbarkeit, Sensibilität einordnen → Vertrauliches und Projektbezogenes entfernen oder Ziel ändern → Nutzen und Risiko kurz beschreiben → vom Menschen prüfen und freigeben (sofern keine Regel eine sichere automatische Übernahme ausdrücklich erlaubt) → Ziel aktualisieren, Index nachziehen. Für den Vault ist die Prüfung vor der Übernahme Pflicht.

## 15. Nutzungsinformationen und Auslöser

Nur was ohnehin anfällt: Dauer von Sessions und Stationen, Tokens soweit die Laufzeit sie liefert, Modellanfragen, Werkzeugaufrufe, Größe großer Ausgaben, Fehler und Wiederholungen, lokale Laufzeiten. Keine Benchmark-Reihen. Erfolg ist ausgewogen: weniger Tokens, kürzere Durchlaufzeit, bessere Ergebnisse, weniger Nacharbeit — keine Kennzahl auf Kosten der anderen. Folgearbeiten (Briefing aktualisieren, Index nachziehen, Kandidat erzeugen) hängen an vorhandenen Ereignissen der App oder einer einfachen lokalen Warteschlange — keine Event-Plattform.

## 16. Plattformen, Synchronisierung, optionaler Betrieb

Windows, Linux, macOS: keine festen Laufwerksbuchstaben oder persönlichen Pfade, plattformunabhängige Pfadfunktionen, ONNX Runtime und Modelle je Zielplattform prüfen, Modell und Index im Datenordner der App, keine Windows-Abhängigkeiten in der Kernlogik.

Der Vault-Pfad ist frei einstellbar; jeder lokale Ordner geht. Ein synchronisiertes Laufwerk ist möglich, aber keine Schnittstelle der App; Git verwaltet die Quelldateien. Index, Datenbank und Embeddings werden nie synchronisiert — jedes Gerät baut seine eigenen. Andere Nutzer verwenden den Verwalter ohne Vault und ohne Laufwerk.

**Ohne Vault** funktionieren Sessions, Umsetzungen, MCP-Anbindungen und Einstellungen unverändert, ohne Embedding-Abhängigkeit. **Vault nicht erreichbar:** einfacher Status, kein Blockieren. **Embedding nicht verfügbar:** semantische Suche vorübergehend aus, FTS5 bleibt, Start wartet nie.

## 17. Funktionale Zielkriterien

**Verwalter:** Sessions und Umsetzungen laufen wie bisher · Sessions einer Umsetzung tauschen persistente Nachrichten aus · Sessions finden und laden frühere Arbeit · neue Stationen bekommen ein kompaktes, passendes Briefing · Werkzeugsätze sind nach Rolle und Aufgabe begrenzt · wenige aufgabenorientierte Werkzeuge genügen · externe MCP-Server bleiben unverändert angebunden.

**Vault:** Verwalter funktioniert ohne Vault · Pfad frei wählbar · Laufwerk keine Pflicht · Aufnahme ohne Metadaten-Aufwand · Dateitypen und zusammengehörige Einträge bleiben im Original · Ideen, Konzepte, Snippets, Wissen, Designs, Vorlagen auffindbar · FTS5 ohne Modell · semantische Suche lokal über ONNX Runtime, wenn das Modell da ist · Geändertes wird inkrementell eingelesen · Agenten finden und laden gezielt · Designs über Metadaten und Vorschau beurteilbar · Kandidaten werden vor der Übernahme geprüft.

**Plattform und Datenschutz:** drei Betriebssysteme berücksichtigt · Datenbank und Embeddings bleiben je Gerät · Projektwissen bleibt im Repository · Vertrauliches kommt nie ungeprüft in den Vault.

---

# Teil B — Bestand und Plan-Schnitt (Stand v0.67.0)

## 18. Was im Verwalter schon steht

| Baustein | Bestand | Urteil |
|---|---|---|
| Umsetzung, Stationen, Lagebericht | sechs Werkzeuge `implementation_*`, Lagebericht über `implementation_get` (ADR 048) | nutzen |
| Briefing einer Station | `first_message` in `src-tauri/src/implementation/start.rs`: Phase, Auftrag, je fertiger Vorgänger-Station eine Ergebniszeile (höchstens 200 Zeichen), Git-Lage | erweitern (Plan A: Vault-Treffer, Plan C: Nachrichten) |
| Nachrichten zwischen Sessions | keine; die Skills geben Erkenntnisse über `FINDINGS.md` im Plan-Ordner weiter | neu (Plan C) |
| Frühere Arbeit suchen | Archiv-Suche, linear über Namen und Chat-Texte, nur Oberfläche, nur archivierte Vorhaben (ADR 029, `archive/search.rs`) | Muster nutzen, Werkzeug neu (Plan C) |
| MCP-Zugang | eigener Server, Trait `ToolSet` mit Schalter `offered`; ein neuer Satz = ein `ToolSet` (ADR 046) | nutzen |
| Werkzeugsätze je Rolle | Stationen sperren sechs teure eingebaute Werkzeuge (ADR 061); MCP-Werkzeuge lädt Claude Code verzögert (nur der Name steht in der Liste) | reicht, neue Sätze per `offered` schalten |
| Profile | der Verwalter kennt bewusst keine Profile (ADR 038); welche Stationen eine Umsetzung hat, legen die Skills beim Anlegen fest; MCP-Server sind je Session schaltbar (MCP-Dialog) | nichts bauen |
| Externe MCP-Server | laufen über die Konfiguration von Claude Code, kein eigener Code im Verwalter | nichts zu tun |
| Lokale Ausführung, Ergebnisse | Läufe mit Laufzeit-Gedächtnis (ADR 066), Werkzeug-Details bis 128 KiB je Aufruf gespeichert (ADR 042), Hintergrund-Ausgaben als Dateien | zurückgestellt |
| Retro | Vorhaben-Retro mit Befunden je Session, Werkzeug-Retro (ADR 028, 062) | nutzen, Kandidatenweg neu (Plan D) |
| Ordner einstellen | „Umgebung“: Ordner wählen, prüfen, Status (ADR 038) | Muster für den Vault |
| FTS5 | im mitgebauten SQLite eingeschaltet (`SQLITE_ENABLE_FTS5` in `libsqlite3-sys`) | nutzen (Plan A) |
| ONNX Runtime, Tokenizer, Modell-Download | `ort` 2.0.0-rc.15 und `tokenizers` 0.23.2 über das Diktat (ADR 049), statisch gelinkt; Download mit gepinnter Revision, Größe und SHA-256 in `voice/model_file.rs`, Ablage `<Datenordner>\models\` | nutzen (Plan B) |
| Vorschau | Artefakt-Server mit Sandbox und Betrachtern (ADR 026, 047), nur für den Artefakte-Ordner des Vorhabens | Agent bekommt Bilder über `vault_get` |
| Dateisystem-Watcher | keine Bibliothek im Bau | Abgleich statt Watcher (ADR 068) |

## 19. Zurückgestellt

| Baustein | Grund |
|---|---|
| Profile und Rollen im Verwalter | ADR 038; die Skills tragen die Unterschiede |
| Eigene Anbindung externer MCP-Dienste | laufen schon nativ über Claude Code |
| Werkzeugsätze je Rolle | ADR 061 und verzögertes Laden der MCP-Werkzeuge reichen |
| Ausführungs-Engine, Capability-Registry, `capability_run`, `result_*` | kein belegter Bedarf; bei Bedarf eigener Plan |
| Vorschau von Vault-Designs im Reiter „Artefakte“ | verschiebt die Grenze des Artefakt-Servers über den Vorhaben-Ordner hinaus |
| Bild-Embeddings, Nachrichten zwischen Rechnern | schließt das Konzept selbst aus |

## 20. Pläne in Reihenfolge

1. **A — Developer Vault: Bibliothekskern** — angelegt: [planning/2026-11-22_developer-vault/](archive/2026-11/2026-11-22_developer-vault/README.md), [ADR 068](decisions/068-developer-vault.md).
2. **C — Zusammenarbeit der Stationen** (Abschnitte 10–11). Skizze: (C1) Tabelle für Nachrichten — Absender-Session, Ziel (Umsetzung · Phase · Session-Nummer), Art (Hinweis, Entscheidung, Frage, Warnung), Text, Zeit; Werkzeuge `session_message`, `session_inbox`; (C2) die erste Nachricht einer Station bringt die Nachrichten an sie mit, der Lagebericht zeigt sie — sichtbar ohne neue Oberfläche; (C3) `session_search` über Chat-Texte, Stationsergebnisse und Nachrichten des eigenen Vorhabens, linear nach dem Muster der Archiv-Suche, `session_context` für einen gedeckelten Verlaufsausschnitt. Grenze: nur das eigene Vorhaben — der MCP-Schlüssel bindet jeden Aufruf an Session und Vorhaben (ADR 046). Offen beim Detailplan: Verhältnis zu `FINDINGS.md` (ersetzen oder ergänzen) und die nötige Anpassung der Umsetzungs-Skills; nächste freie Migrationsnummer prüfen.
3. **B — Semantische Suche lokal** (Abschnitte 8–9). Skizze: (B1) Modell-Probe mit Probe-Programm — Qwen3-Embedding-0.6B gibt es als ONNX nur von Dritten (fp32 und int8 rund 1,1 GB, ein int8-Export rund 615 MB), Pooling über das letzte Token und Normierung außerhalb des Modells; Laden, Zeit je Abschnitt, Speicher messen, Ersatzkandidat, wenn untauglich, Ergebnis als ADR; (B2) Download per Klick in den Einstellungen nach dem Muster des Diktats; (B3) Abschnitte im Hintergrund einbetten, Vektoren in der Index-Datei aus Plan A, Modell/Revision/Dimension daneben, Modellwechsel → neu rechnen; (B4) Ähnlichkeit über alle Vektoren direkt gerechnet, mit FTS5 per Rangfusion zusammengeführt, ohne Modell nur FTS5. Abweichung vom Konzept: Download per Klick statt automatisch beim ersten Bedarf — 0,6 bis 1,1 GB ungefragt zu laden passt nicht zu „Start wartet nie“.
4. **D — Wissenskandidaten aus Retros** (Abschnitte 4, 14). Skizze: eine Session oder Retro schlägt einen Kandidaten vor → er liegt lokal im Verwalter, **nicht** im Vault (ein Vault auf einem synchronisierten Laufwerk hätte einen ungeprüften Kandidaten sonst schon verteilt) → Einordnung `general` · `project` · `sensitive` · `unclear` → Übernahme per Klick schreibt nach `inbox/`. Detailplan erst, wenn Plan A im Betrieb ist.

Jeder Folgeplan wird erst im Detail geplant, wenn er dran ist — sonst plant er gegen Code, den sein Vorgänger noch umbaut. Vorher den Bestand dieses Abschnitts am aktuellen Code nachprüfen.

## 21. Wacklige Stellen

- **Qwen3 als ONNX:** nur Exporte von Dritten; ob `ort` rc.15 sie lädt und wie schnell die CPU rechnet, ist offen → Probe in B1 vor allem anderen.
- **Vault auf einem Laufwerk mit Dateien nur online:** der erste Abgleich lädt jede gelesene Datei herunter → Attribute einer Vault-Datei prüfen, Laufwerk auf „spiegeln“ stellen.
- **FTS5 und deutsche Wörter:** `unicode61` trennt keine zusammengesetzten Wörter → bei Bedarf zweiter Index mit `trigram`.
