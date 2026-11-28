import { toolsLabel } from '@/features/mcp/mcpTexts';

export const FORM_TITLE_ADD = 'Server hinzufügen';
export const FORM_TITLE_EDIT = 'Server bearbeiten';
export const BACK_LABEL = 'Zurück zur Liste';

export const SCOPE_LEGEND = 'Wo soll der Server gelten?';
export const SCOPE_USER = { title: 'Mein Benutzer', note: 'In allen Vorhaben' };
export const SCOPE_REPOSITORY = { title: 'Projekt', note: 'Geteilt mit allen im Repo' };
export const SCOPE_LOCAL = { title: 'Nur ich, im Vorhaben', note: 'Nicht geteilt' };
export const SCOPE_FILE = '~/.claude.json';
export const SCOPE_WORKSPACE_NOTE =
  'Liegt im Vorhaben-Ordner und bleibt dort, solange nichts anderes gewählt ist.';
export const REPOSITORY_SELECT_LABEL = 'Repository';

export const MODE_FIELDS = 'Felder';
export const MODE_JSON = 'JSON einfügen';

export const NAME_NOTE = 'Unter diesem Namen sieht der Agent die Werkzeuge.';
export const NAME_MISSING = 'Name fehlt.';
export const NAME_TAKEN = 'Name gibt es schon – der Agent würde nur einen sehen.';
export const NAME_INVALID = 'Nur Buchstaben, Ziffern, Punkt, _ und -, höchstens 64 Zeichen.';
export const ADDRESS_LABEL = 'Adresse';
export const ADDRESS_NOTE = 'Anmeldung per OAuth erkennt der Agent selbst.';
export const ADDRESS_MISSING = 'Adresse fehlt.';
export const COMMAND_LABEL = 'Befehl mit Argumenten';
export const COMMAND_NOTE = 'Läuft im Arbeitsordner der Session.';
export const COMMAND_MISSING = 'Befehl fehlt.';

export const HIDDEN_VALUE_PLACEHOLDER = 'unverändert';
export const VALUE_PLACEHOLDER = 'Wert oder ${VARIABLE}';
export const ADD_ROW_LABEL = '+ Zeile';

export const JSON_LABEL = 'Konfiguration';
export const JSON_PLACEHOLDER =
  '{ "mcpServers": { "jira": { "type": "http", "url": "https://…" } } }';
export const JSON_ONE_WHEN_EDITING = 'Beim Bearbeiten geht genau ein Server.';

export const TEST_LABEL = 'Verbindung testen';
export const TEST_RUNNING = 'Verbinde …';
export const CANCEL_LABEL = 'Abbrechen';
export const SUBMIT_ADD = 'Server hinzufügen';
export const SUBMIT_EDIT = 'Änderungen speichern';

export const INSPECT_LABEL = 'Werkzeuge & Anweisungen ansehen';
export const INSPECT_OFFLINE_NOTE = 'geht auch bei ruhendem Agenten';
export const INSPECT_RUNNING = 'Frage den Server …';
export const INSPECT_RETRY = 'Erneut versuchen';
export const INSTRUCTIONS_TITLE = 'Server-Anweisungen';
export const NO_INSTRUCTIONS = 'Keine Anweisungen gemeldet.';
export const NO_DESCRIPTION = 'Keine Beschreibung gemeldet.';

export function testSuccessText(toolCount: number): string {
  return `Verbunden · ${toolsLabel(toolCount)}`;
}

export function pairValueMissing(key: string): string {
  return `Wert für ${key} neu eintragen – der gespeicherte gilt nur für den alten Schlüssel und die alte Art.`;
}

export function savedSoFarText(names: readonly string[]): string {
  return ` Schon gespeichert: ${names.join(', ')}.`;
}

export function moveLeftoverText(name: string, reason: string): string {
  return `„${name}“ ist gespeichert, der alte Eintrag ließ sich nicht entfernen: ${reason}`;
}
