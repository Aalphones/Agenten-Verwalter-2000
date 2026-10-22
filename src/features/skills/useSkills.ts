import { useEffect, useEffectEvent, useState } from 'react';
import type { SkillInfo } from '@/lib/bindings/SkillInfo';
import { commandErrorText } from '@/lib/errors';
import { listRepositorySkills, listSessionSkills, listSkillUses } from '@/lib/skills';
import { usesByKey } from '@/features/skills/skillUses';

export type SkillSource = { sessionId: string } | { repositoryIds: readonly string[] };

interface SkillsResult {
  skills: readonly SkillInfo[];
  /** Aufrufe der letzten 30 Tage je Zählschlüssel; `null`, solange die Zählung fehlt oder fehlschlug. */
  uses: ReadonlyMap<string, number> | null;
  error: string | null;
}

/** Lädt die Skills samt Aufruf-Zählung, sobald `isActive` auf `true` wechselt — jedes Öffnen des Menüs frisch. */
export function useSkills(source: SkillSource, isActive: boolean): SkillsResult {
  const [result, setResult] = useState<SkillsResult>({ skills: [], uses: null, error: null });
  const sourceKey: string =
    'sessionId' in source
      ? `session:${source.sessionId}`
      : `repositories:${source.repositoryIds.join(',')}`;

  const fetchSkills = useEffectEvent((): Promise<SkillInfo[]> => {
    if ('sessionId' in source) {
      return listSessionSkills(source.sessionId);
    }
    return listRepositorySkills([...source.repositoryIds]);
  });

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }
    // Eine späte Antwort für eine andere Quelle oder ein früheres Öffnen wird verworfen.
    let isCurrent = true;
    // Ohne Zählung bleibt das Menü benutzbar, nur eben unsortiert.
    const fetchUses: Promise<ReadonlyMap<string, number> | null> = listSkillUses()
      .then(usesByKey)
      .catch((): null => null);
    Promise.all([fetchSkills(), fetchUses])
      .then(([skills, uses]: [SkillInfo[], ReadonlyMap<string, number> | null]) => {
        if (isCurrent) {
          setResult({ skills, uses, error: null });
        }
      })
      .catch((reason: unknown) => {
        if (isCurrent) {
          setResult({ skills: [], uses: null, error: commandErrorText(reason) });
        }
      });
    return (): void => {
      isCurrent = false;
    };
  }, [isActive, sourceKey]);

  return result;
}
