import type { ReactElement } from 'react';
import { SKIN_TOOL_NAMES } from '@/features/skins/toolNames';
import type { SkinToolAction } from '@/features/skins/toolNames';
import { useSkinsStore } from '@/stores/skins';
import './ToolName.css';

interface ToolNameProps {
  action: SkinToolAction;
}

/** Klein und gestrichelt der Name des Werkzeugs, das dieselbe Aktion für den Agenten ausführt; nur mit „Werkzeug-Namen zeigen“. */
export function ToolName({ action }: ToolNameProps): ReactElement | null {
  const isShown: boolean = useSkinsStore((state) => state.showToolNames);
  if (!isShown) {
    return null;
  }
  return <span className="tool-name">{SKIN_TOOL_NAMES[action]}</span>;
}
