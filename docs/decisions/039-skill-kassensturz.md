# 039 — Skill-Kassensturz

**Status:** angenommen · **Datum:** 2026-10-22

## Kontext

Die Gruppe „Skills“ im `/`-Menü wächst mit jedem Ordner, den jemand anlegt, und steht in der Reihenfolge, in der die Ordner gelesen werden. Was oft gebraucht wird, liegt irgendwo; was seit Monaten niemand aufruft, belegt Platz. Der Verwalter weiß, welcher Skill aufgerufen wurde: `send` setzt `skill` am Benutzer-Eintrag des Verlaufs.

## Optionen

- **(a) Eigener Zähler je Aufruf in einer neuen Tabelle.** Verworfen: Migration und eine zweite Wahrheit neben dem Verlauf.
- **(b) Zählen aus `chat_entries`.** Gewählt.
- **(c) Statistik-Seite.** Verworfen: Leitsatz „nichts dauerhaft auf den Schirm, was nicht beim Arbeiten hilft“.

## Entscheidung

- **Ein Aufruf** = ein Benutzer-Eintrag mit gesetztem `skill`, dessen `sentAt` in den letzten 30 Tagen liegt. Archivierte Sessions zählen mit, gelöschte nicht.
- **Schlüssel** = Herkunft + Name (`user:<name>`, `repository:<Repo-Name>:<name>`); gleichnamige Skills aus verschiedenen Ordnern zählen getrennt. Jede andere Herkunft bildet `<Herkunft>:<name>`.
- **Abfrage per `json_extract`** auf `chat_entries.payload`, ohne Migration; ein SQL-Aufruf je Menü-Öffnen.
- **Sortiert** wird nur innerhalb der Gruppe „Skills“; Skills ohne Aufruf in 30 Tagen liegen eingeklappt am Ende.

## Konsequenzen

- Die Zahl kostet bei jedem Öffnen des Menüs einen Durchlauf über alle Benutzer-Einträge.
- Gelöschte Sessions fallen aus der Zählung; die Zahlen sinken dann rückwirkend.
