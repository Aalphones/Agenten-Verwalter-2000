import { useState } from 'react';
import type { ReactElement } from 'react';
import { WorkingIndicator } from '@/features/chat/WorkingIndicator';
import { useRunView } from '@/features/runs/useRunView';
import type { RunView } from '@/features/runs/runTexts';
import { FigureStage, hasFigure } from '@/features/skins/FigureStage';
import { lookFor } from '@/features/skins/figureLook';
import { formatElapsed, statusText } from '@/features/skins/statusText';
import type { AwaitedScript } from '@/lib/bindings/AwaitedScript';
import type { SkinPack } from '@/lib/bindings/SkinPack';
import type { SlotLook } from '@/lib/bindings/SlotLook';

const WAIT_SLOT = 'wait';

interface AwaitedScriptLineProps {
  script: AwaitedScript;
  /** Das aktive Figurenpaket; ohne Paket steht der sachliche Text des Fachs „Warten“. */
  pack: SkinPack | null;
}

/** Die Statuszeile für die Zeit, in der die Session auf ein Skript wartet: Fach „Warten“ mit Dauer, Balken und letzter Zeile. */
export function AwaitedScriptLine({ script, pack }: AwaitedScriptLineProps): ReactElement {
  const run: RunView | null = useRunView(script);
  const [roll] = useState<number>(() => Math.random());
  const look: SlotLook | null = lookFor(pack, WAIT_SLOT);
  const text: string = statusText({
    slot: WAIT_SLOT,
    target: script.description ?? script.title,
    command: script.title,
    progress: run?.progressLabel ?? '',
    rest: run?.restLabel ?? '',
    textIndex: null,
    roll,
    look,
    time: run === null ? '' : formatElapsed(run.elapsedSeconds),
  });
  return (
    <WorkingIndicator
      text={text}
      calls={0}
      todo={null}
      thinkingSeconds={null}
      run={run}
      showsHint={false}
      figure={
        pack !== null && hasFigure(look) ? (
          <FigureStage pack={pack} look={look} size="line" />
        ) : undefined
      }
    />
  );
}
