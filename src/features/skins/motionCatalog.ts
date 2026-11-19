import type { Motion } from '@/lib/bindings/Motion';
import type { BuiltinSlotId } from '@/features/skins/slotCatalog';

/** Deutsche Namen der Bewegungen für die Auswahl im Editor. */
export const MOTION_LABELS: Readonly<Record<Motion, string>> = {
  none: 'Keine',
  bob: 'Wippen',
  vine: 'Ranke holt aus Kiste',
  float: 'Seite schwebt',
  squish: 'Kneten, Code wechselt',
  zap: 'Blitz ins Terminal',
  fly: 'Fliegen',
  summon: 'Ball wirft, Figur erscheint',
  sleep: 'Schlafen',
  ponder: 'Grübeln mit Gedankenblase',
  wobble: 'Ball wackelt dreimal',
  evolve: 'Entwicklung (zweites Bild)',
  popin: 'Aufploppen',
  webShot: 'Netz schießen',
  shield: 'Schild-Wurf',
  beam: 'Strahl',
  sparkle: 'Zauberstaub',
  frost: 'Eiskristalle',
  wave: 'Welle',
  trek: 'Läuft die Strecke ab',
  charge: 'Lädt auf',
  reveal: 'Wird sichtbar',
};

/** Die Bewegung, die zum Fach passt; der Editor schlägt sie vor, wenn ein Bild gesetzt wird. */
export const FITTING_MOTION: Readonly<Record<BuiltinSlotId, Motion>> = {
  search: 'vine',
  read: 'float',
  write: 'squish',
  shell: 'zap',
  longrun: 'trek',
  web: 'fly',
  agent: 'summon',
  other: 'bob',
  wait: 'sleep',
  think: 'ponder',
  commit: 'wobble',
  station: 'evolve',
};

/** Bewegungen, die dem Fortschritt eines laufenden Befehls folgen; der Editor zeigt dafür einen Schieber. */
export const PROGRESS_MOTIONS: ReadonlySet<Motion> = new Set<Motion>(['trek', 'charge', 'reveal']);
