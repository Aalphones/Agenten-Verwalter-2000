import type { ReactElement } from 'react';
import { Markdown } from '@/components/Markdown';

interface TextBlockProps {
  text: string;
  unsourced: readonly string[];
}

export function TextBlock({ text, unsourced }: TextBlockProps): ReactElement {
  return <Markdown text={text} unsourced={unsourced} />;
}
