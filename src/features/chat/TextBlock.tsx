import type { ReactElement } from 'react';
import { Markdown } from '@/components/Markdown';

interface TextBlockProps {
  text: string;
}

export function TextBlock({ text }: TextBlockProps): ReactElement {
  return <Markdown text={text} />;
}
