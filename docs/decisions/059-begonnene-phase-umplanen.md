# 059 — Begonnene Phase umplanen

**Status:** angenommen · **Datum:** 2026-11-06 · Vorschlag, Übernehmen/Verwerfen und Anhalten ersetzt durch [ADR 064](064-plan-aenderung-ohne-freigabe.md)

## Kontext

`implementation_set_phases` ersetzte nur Phasen, in denen noch keine Station begonnen hatte. Sobald eine Station einer Phase eine Session hatte oder fertig gemeldet war, lehnte das Werkzeug jeden Vorschlag ab, der die Phase nannte. Damit waren auch die noch nicht gestarteten Stationen dieser Phase eingefroren. Anlass am 06.11.2026 in der Umsetzung GYMID-2601: Vor die Station „Merge“ einer laufenden Phase sollte eine Abnahme-Phase. Das ging nicht, die Merge-Station musste über die Phasenbeschreibung stillgelegt werden. Außerdem startete eine Station, die ein offener Vorschlag ersetzen würde, trotzdem; das „Übernehmen“ scheiterte danach.

## Optionen

- **(a) Phase sperren wie bisher** — verworfen: Offene Stationen einer laufenden Phase lassen sich weder streichen noch umstellen.
- **(b) Station sperren statt Phase** — gewählt.
- **(c) Knopf in der Oberfläche, mit dem der Benutzer eine Station oder Phase streicht** — verworfen: Umplanen bleibt Sache des Agenten per Vorschlag und der Übernahme auf der Karte „Plan ändern?“.

## Entscheidung

- **Gesperrt ist die Station.** Unantastbar ist jede Station mit Session oder Fertigmeldung (`changes::is_station_begun`). Eine begonnene Phase darf im Vorschlag stehen. Ihre `stations` ersetzen dann nur die noch nicht gestarteten Stationen, die gestarteten bleiben mit ihren IDs davor stehen. `stations: []` streicht alle noch nicht gestarteten Stationen. Bei einer nicht begonnenen Phase bleibt mindestens eine Station Pflicht (`model::validate(phases, begun_keys)`).
- **Nicht genannte begonnene Phasen bleiben unverändert**, damit ein Agent nichts aus Versehen verliert. Nicht begonnene Phasen ersetzt der Vorschlag wie bisher vollständig.
- **Reihenfolge:** Genannte begonnene Phasen stehen vor allen nicht begonnenen und untereinander in ihrer heutigen Reihenfolge, sonst „Phase X hat begonnen und steht vor allen kommenden Phasen.“. Eine fertige Phase darf nicht genannt werden („Phase X ist fertig.“). Titel und Beschreibung einer genannten begonnenen Phase übernimmt der Vorschlag, die Welle nicht.
- **Anhalten bei offenem Vorschlag:** Solange ein Vorschlag offen ist, startet keine Station, die er ersetzen würde (`changes::held_station_ids`): alle Stationen nicht begonnener Phasen und die noch nicht gestarteten Stationen genannter begonnener Phasen. Sie bleiben wartend, laufende Countdowns bricht das Vorschlagen ab, und auch ▶ startet sie nicht. Nach „Verwerfen“ werden wie nach „Übernehmen“ die bereiten Stationen geplant.
- **Schutz beim Übernehmen:** Der Vorschlag merkt sich die IDs der noch nicht gestarteten Stationen genannter begonnener Phasen (`PendingChange.seen_station_ids`). Weicht die Menge beim Übernehmen ab, etwa durch eine Fix-Runde, scheitert es mit „Phase X hat sich seit dem Vorschlag geändert; bitte neu vorschlagen.“. Der Vorschlag bleibt liegen und lässt sich verwerfen. Zusätzlich löscht `replace_upcoming_phases` nur Stationen ohne Session und Fertigmeldung; trifft es eine begonnene, bleibt die Datenbank unverändert.
- **Zusammenfassung:** `ChangeSummary.changed` nennt die begonnenen Phasen, deren noch nicht gestartete Stationen sich ändern; gleiche Stationen (Stufe, Modell, Aufwand, Bearbeiter, Skill, Auftrag in gleicher Reihenfolge) zählen nicht. Der Lagebericht schreibt „geändert X“. Die Stationszahl nach der Änderung zählt gestrichene offene Stationen begonnener Phasen mit.
- **Alte gespeicherte Daten:** `changed` und `seen_station_ids` tragen `#[serde(default)]`; gespeicherte Zusammenfassungen und offene Vorschläge ohne diese Felder lesen sich weiter. Keine Migration.

## Konsequenzen

- Ein offener Vorschlag, den niemand übernimmt, hält die Umsetzung an. Bisher lief die nächste Phase weiter, und „Übernehmen“ scheiterte danach.
- Ein Vorschlag, der einer begonnenen Phase Stationen anhängt, deren letzte Station gerade läuft, scheitert beim Übernehmen mit „Phase X ist fertig.“, wenn diese Station vorher fertig wird. Dann verwerfen und neu vorschlagen.
- Skills außerhalb des Repos, die die alte Sperre beschreiben, sind umzustellen.
- Prüfen ohne App: `implementation-probe … set-phases <Umsetzungs-ID> <JSON-Datei>` spielt einen Vorschlag gegen eine Datenbank-Kopie ein und druckt die angehaltenen Stationen und den Stand vorher und nachher.
