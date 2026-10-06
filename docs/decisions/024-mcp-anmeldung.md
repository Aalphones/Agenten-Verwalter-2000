# 024 — MCP-Anmeldung im Dialog

**Status:** angenommen · **Datum:** 2026-10-06

## Kontext

Ein MCP-Server mit Status „Anmeldung nötig“ ließ sich im Dialog „MCP-Server“ nur neu verbinden; der Dialog verwies auf ein Claude-Code-Terminal. Die Kommandozeile bietet dafür die Steueranfrage `mcp_authenticate`: sie antwortet mit der Adresse der Anmeldeseite (`authUrl`), ob der Benutzer handeln muss (`requiresUserAction`) und ob sie selbst auf einen Rücksprung nach `localhost` wartet (`callbackExpected`). Gemessen für claude.ai-Connectoren (`callbackExpected: false`, danach verbindet die Kommandozeile **nicht** selbst neu); für eigene HTTP-Server nur aus dem Programmcode gelesen (`callbackExpected: true`, die Kommandozeile verbindet nach dem Rücksprung selbst). Die Adresse stammt aus der Ausgabe eines Prozesses.

## Optionen

- (a) Der Core öffnet die Anmeldeseite, sobald die Antwort kommt;
- (b) die Oberfläche öffnet sie, wenn sie im geladenen Stand eine neue offene Anmeldung sieht;
- (c) die Anfrage mit eigener `redirectUri` stellen und den Rücksprung selbst entgegennehmen.

## Entscheidung

- **(a).** Die Antwort kommt asynchron über die Zuordnung per Request-ID (ADR 013). Die Oberfläche müsste erkennen, dass eine Adresse neu ist, und sie genau einmal öffnen — das geht bei mehrfachem Laden und bei geschlossenem und wieder geöffnetem Dialog schief. Der Core legt die Adresse in die Outbox und öffnet sie nach dem Freigeben der Session-Sperre über das Opener-Plugin, wie die Dateiverweise (ADR 023). (c) ist unnötig: ohne `redirectUri` nimmt die Kommandozeile den lokalen Rücksprung selbst.
- **Nur `https://`.** Eine Adresse mit anderem Anfang wird nicht geöffnet; die Aktion endet als Fehler „Anmeldeadresse nicht geöffnet: kein https“. Ein Klick darf nur eine Webseite öffnen, kein `file:` und kein Programm.
- **Offene Anmeldung als Zustand im Speicher** (`SessionMcp.auth`): gesetzt mit der Antwort, gelöscht, sobald `mcp_status` den Server nicht mehr als `needs-auth` meldet, und wenn der Agent endet. Eine neue Anmeldung ersetzt die alte. Solange sie offen ist, fragt der Dialog alle 2 s nach — die Kommandozeile meldet den Abschluss nicht von selbst.
- **Bedienung:** Knopf „Anmelden“ in jeder Zeile mit Status „Anmeldung nötig“; über der Liste ein Hinweis mit „Seite erneut öffnen“ und, bei claude.ai-Connectoren, „Neu verbinden“.

## Konsequenzen

- Eigene Server, deren Anmeldeserver `http://` verwendet, lassen sich nicht anmelden — bewusst, bis jemand so einen hat.
- Bricht der Benutzer die Anmeldung ab, bleibt der Hinweis stehen, bis die Liste den Server anders meldet oder der Agent endet; „Anmelden“ in der Zeile startet eine neue.
- Abmelden (`mcp_clear_auth`) und das Einfügen einer Rücksprung-Adresse von Hand (`mcp_oauth_callback_url`) bietet der Verwalter nicht an; Anmelden geht nur mit laufendem Agenten.
- Ob `mcp_reconnect` nach einer Anmeldung auf claude.ai reicht oder die Kommandozeile die Connector-Liste erst bei einem Neustart neu holt, ist nicht gemessen.
