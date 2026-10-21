import type { ReactElement } from 'react';
import { CompactDivider } from '@/features/notices/CompactDivider';
import { ModelSwitchIcon } from '@/features/notices/NoticeIcons';
import { NoticeLine } from '@/features/notices/NoticeLine';
import { MODEL_SWITCH_LEAD, modelSwitchedText } from '@/features/notices/noticeTexts';
import type { Notice } from '@/lib/bindings/Notice';

const ICON_SIZE = 14;

interface NoticeBlockProps {
  notice: Notice;
  isExpanded: boolean;
  onToggle: () => void;
  /** Die Claude-Kommandozeile mit dem Claude-Abo ist die Betriebsart; nur dort gibt es den Prompt-Cache. */
  isClaude: boolean;
}

export function NoticeBlock({
  notice,
  isExpanded,
  onToggle,
  isClaude,
}: NoticeBlockProps): ReactElement {
  switch (notice.kind) {
    case 'compacted':
      return (
        <CompactDivider
          notice={notice}
          isExpanded={isExpanded}
          onToggle={onToggle}
          isClaude={isClaude}
        />
      );
    case 'modelSwitched':
      return (
        <NoticeLine
          variant="model"
          icon={<ModelSwitchIcon size={ICON_SIZE} />}
          lead={MODEL_SWITCH_LEAD}
          text={modelSwitchedText(notice.from, notice.to, notice.recacheTokens)}
        />
      );
  }
}
