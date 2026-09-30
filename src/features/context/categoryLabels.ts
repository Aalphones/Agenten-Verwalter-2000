const CATEGORY_LABEL: Readonly<Record<string, string>> = {
  'System prompt': 'Systemprompt',
  'System tools': 'Systemwerkzeuge',
  'MCP tools': 'MCP-Werkzeuge',
  'MCP server instructions': 'MCP-Server-Anweisungen',
  'Memory files': 'Memory-Dateien',
  Skills: 'Skills',
  Messages: 'Nachrichten',
  'Free space': 'Freier Platz',
  'Autocompact buffer': 'Puffer fürs Zusammenfassen',
};

/** Deutscher Name einer Kategorie der Kommandozeile; Unbekanntes bleibt unverändert. */
export function categoryLabel(name: string): string {
  return CATEGORY_LABEL[name] ?? name;
}
