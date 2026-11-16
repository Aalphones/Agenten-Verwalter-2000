/** Aktion der Seite „Skins“ → Name des Agenten-Werkzeugs, das dasselbe tut (Phase 7 baut die Werkzeuge). */
export const SKIN_TOOL_NAMES = {
  activate: 'skin_activate',
  create: 'skin_create',
  import: 'skin_import',
  rename: 'skin_rename',
  slotSet: 'skin_slot_set',
  slotRemove: 'skin_slot_remove',
  imageSet: 'skin_image_set',
  styleSet: 'skin_style_set',
  delete: 'skin_delete',
  export: 'skin_export',
} as const;

export type SkinToolAction = keyof typeof SKIN_TOOL_NAMES;
