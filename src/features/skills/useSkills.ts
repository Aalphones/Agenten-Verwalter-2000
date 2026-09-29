import { useEffect, useEffectEvent, useState } from 'react';
import type { SkillInfo } from '@/lib/bindings/SkillInfo';
import { commandErrorText } from '@/lib/errors';
import { listRepositorySkills, listSessionSkills } from '@/lib/skills';

export type SkillSource = { sessionId: string } | { repositoryIds: readonly string[] };

interface SkillsResult {
  skills: readonly SkillInfo[];
  error: string | null;
}

/** Lädt die Skills, sobald `isActive` auf `true` wechselt — jedes Öffnen des Menüs frisch. */
export function useSkills(source: SkillSource, isActive: boolean): SkillsResult {
  const [result, setResult] = useState<SkillsResult>({ skills: [], error: null });
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
    fetchSkills()
      .then((skills: SkillInfo[]) => {
        if (isCurrent) {
          setResult({ skills, error: null });
        }
      })
      .catch((reason: unknown) => {
        if (isCurrent) {
          setResult({ skills: [], error: commandErrorText(reason) });
        }
      });
    return (): void => {
      isCurrent = false;
    };
  }, [isActive, sourceKey]);

  return result;
}
