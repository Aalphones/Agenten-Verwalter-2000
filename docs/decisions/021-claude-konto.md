# 021 — Claude-Konto: anzeigen und über die Kommandozeile wechseln

**Status:** angenommen · **Datum:** 2026-10-05

## Kontext

Die App startet Agenten über die Claude-Kommandozeile; welches Konto sie benutzt, bestimmt allein deren Anmeldung. Wer das Konto wechseln wollte (zum Beispiel weil das Kontingent des einen Kontos aufgebraucht ist), musste dafür ein Terminal öffnen und sah in der App nicht einmal, mit welchem Konto sie gerade arbeitet.

## Optionen

- **Wie die App das Konto bekommt:** (a) ein eigenes OAuth-Verfahren in der App; (b) die Kommandozeile fragen: `claude auth status --json` liest, `claude auth login` wechselt.
- **Wie die Anmeldung läuft:** (i) verstecktes Fenster, die App zeigt Adresse und Code selbst; (ii) ein sichtbares Konsolenfenster der Kommandozeile.
- **Abmelden-Knopf** zusätzlich oder nicht.

## Entscheidung

- **(b).** Das Konto gehört der Kommandozeile. Ein eigenes OAuth-Verfahren (a) würde deren Anmeldeablauf nachbauen, müsste ihn bei jeder Änderung mitziehen und könnte der Kommandozeile trotzdem nicht ihre Zugangsdaten unterschieben. Die App liest nur, was `auth status --json` meldet (`loggedIn`, `email`, `orgName`, `subscriptionType`, `authMethod`); fehlende Felder sind kein Fehler.
- **(ii) unter Windows:** `claude auth login` läuft in einem eigenen sichtbaren Konsolenfenster (`CREATE_NEW_CONSOLE`), damit Adresse und eine etwaige Code-Eingabe sichtbar sind; Schließen des Fensters bricht die Anmeldung ab. Gegen (i): die App müsste die Ausgabe der Kommandozeile auswerten, und deren Format ist nicht zugesichert. Unter macOS und Linux ohne Fenster — der Browser öffnet sich von selbst.
- **Nie zwei Anmeldungen gleichzeitig:** `AccountService` hält `is_logging_in`, ein zweiter Klick tut nichts.
- **Nach der Anmeldung** liest die App das Konto neu (auch nach einem Abbruch, weil die Kommandozeile das alte Konto womöglich schon vorher abmeldet) und fragt das Kontingent mit `force` neu ab.
- **Kein Abmelden-Knopf:** nicht beauftragt; `claude auth login` ersetzt die Anmeldung.
- **Lesen höchstens 15 s:** danach wird der Prozess beendet und die Zeile zeigt einen Fehlersatz.

## Konsequenzen

- Der Wechsel gilt für jeden Agenten, der **danach** startet. Ob ein bereits laufender Agent das neue Konto sofort übernimmt, ist ungeprüft; die Smoke-Checkliste des Plans prüft es über die Kontingent-Anzeige.
- Die App speichert keine Zugangsdaten; sie sieht nur E-Mail, Organisation und Abo.
- Die Anmeldung hängt an der installierten Kommandozeile (`claude auth` ab 2.1.284 geprüft); eine Version ohne diese Unterbefehle zeigt in der Zeile einen Fehlersatz.
