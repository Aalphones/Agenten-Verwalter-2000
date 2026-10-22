import { invoke } from '@tauri-apps/api/core';
import type { SkillInfo } from '@/lib/bindings/SkillInfo';
import type { SkillUse } from '@/lib/bindings/SkillUse';

/** Skills und Befehle einer Session: erst die des Benutzers, dann je Repository der Session.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `sessionNotFound`, `io` */
export function listSessionSkills(sessionId: string): Promise<SkillInfo[]> {
  return invoke<SkillInfo[]>('skill_list_for_session', { sessionId });
}

/** Wie `listSessionSkills`, aber für „Neue Session“: die Repository-Einträge stammen aus den Haupt-Checkouts.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `internal` (unbekanntes Repository), `io` */
export function listRepositorySkills(repositoryIds: string[]): Promise<SkillInfo[]> {
  return invoke<SkillInfo[]>('skill_list_for_repositories', { repositoryIds });
}

/** Aufrufe je Skill in den letzten 30 Tagen; Skills ohne Aufruf fehlen in der Liste.
 *  @throws {import('@/lib/bindings/CommandError').CommandError} `database` */
export function listSkillUses(): Promise<SkillUse[]> {
  return invoke<SkillUse[]>('skill_uses');
}
