import { useState } from 'react';
import type { ReactElement } from 'react';
import { WorkingIndicator } from '@/features/chat/WorkingIndicator';
import { FigureStage, hasFigure } from '@/features/skins/FigureStage';
import { lookFor } from '@/features/skins/figureLook';
import { formatElapsed, statusText } from '@/features/skins/statusText';
import { useSecondTick } from '@/features/skins/useSecondTick';
import type { AwaitedScript } from '@/lib/bindings/AwaitedScript';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import type { SlotLook } from '@/lib/bindings/SlotLook';

const WAIT_SLOT = 'wait';
const SECOND_MS = 1000;

interface AwaitedScriptLineProps {
  script: AwaitedScript;
  pack: SkinPack;
}

/** Die Statuszeile für die Zeit, in der die Session auf ein Skript wartet: Fach „Warten“ mit laufender Dauer. */
export function AwaitedScriptLine({ script, pack }: AwaitedScriptLineProps): ReactElement {
  const now: number = useSecondTick(true);
  const [roll] = useState<number>(() => Math.random());
  const look: SlotLook | null = lookFor(pack, WAIT_SLOT);
  const seconds: number = Math.max(0, Math.floor((now - script.startedAt) / SECOND_MS));
  const text: string = statusText({
    slot: WAIT_SLOT,
    target: script.description ?? script.title,
    command: script.title,
    progress: '',
    rest: '',
    textIndex: null,
    roll,
    look,
    time: formatElapsed(seconds),
  });
  return (
    <WorkingIndicator
      text={text}
      calls={0}
      todo={null}
      thinkingSeconds={null}
      showsHint={false}
      figure={hasFigure(look) ? <FigureStage pack={pack} look={look} size="line" /> : undefined}
    />
  );
}
