import type { ReactElement } from 'react';
import { Markdown } from '@/components/Markdown';
import { useSettingsStore } from '@/stores/settings';

const NO_NEEDLES: readonly string[] = [];

interface TextBlockProps {
  text: string;
  unsourced: readonly string[];
}

export function TextBlock({ text, unsourced }: TextBlockProps): ReactElement {
  const marksUnsourced: boolean = useSettingsStore(
    (state) => state.settings?.markUnsourced ?? true,
  );
  return <Markdown text={text} unsourced={marksUnsourced ? unsourced : NO_NEEDLES} />;
}
