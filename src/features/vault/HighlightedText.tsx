import type { ReactElement } from 'react';
import { highlightSegments } from '@/features/vault/snippetSegments';
import type { SnippetSegment } from '@/features/vault/snippetSegments';

interface HighlightedTextProps {
  text: string;
  /** Der Suchtext; leer markiert nichts. */
  query: string;
}

/** Text mit markierten Wortanfängen der Suchbegriffe. */
export function HighlightedText({ text, query }: HighlightedTextProps): ReactElement {
  return (
    <>
      {highlightSegments(text, query).map((segment: SnippetSegment, index: number) =>
        segment.isMatch ? (
          <mark key={index} className="vault-search__mark">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
