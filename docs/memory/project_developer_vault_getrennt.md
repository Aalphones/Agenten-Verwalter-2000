---
name: project-developer-vault-getrennt
description: Der Developer Vault des Verwalters ist ein neuer, eigenständiger Vault; der bestehende persönliche Wissens-Vault bleibt komplett getrennt — kein Lesen, kein gemeinsamer Index, keine Code-Übernahme daraus.
metadata:
  type: project
---

Der Verwalter bekommt einen **neuen** Developer Vault (frei konfigurierbarer Ordner, eigener Index, eigene Regeln). Der bestehende persönliche Wissens-Vault des Benutzers bleibt **vollständig separat**: der Verwalter liest ihn nicht, indexiert ihn nicht, teilt keine Datenhaltung und keinen Suchindex mit ihm, und Pläne setzen keine Code-Übernahme aus dessen Skripten voraus.

**Why:** ausdrückliche Vorgabe des Benutzers am 2026-11-22 beim Planen des Gesamtkonzepts („Wir bauen einen neuen Vault für den Agenten Verwalter. Der bestehende knowledge bleibt separat!“); deckt sich mit Abschnitt 6.2 des Gesamtkonzepts. Der alte Vault enthält zudem Bereiche, die für Agenten gesperrt sind.

**How to apply:** Mechanismen (Hash-Abgleich, Chunking, Manifest, hybride Suche) werden aus der Beschreibung im Gesamtkonzept neu gebaut, nicht aus dem alten Vault abgeleitet. Kein Vorschlag, den Ordner des bestehenden Wissens-Vaults als Vault-Pfad zu verwenden oder mitzuindexieren. Sobald die ADR des Developer Vaults existiert, diese Notiz auf einen Verweis darauf kürzen.
