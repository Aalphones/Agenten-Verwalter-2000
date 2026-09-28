import type { ReactElement } from 'react';
import './TextBlock.css';

interface TextBlockProps {
  text: string;
}

export function TextBlock({ text }: TextBlockProps): ReactElement {
  return <p className="text-block">{text}</p>;
}
