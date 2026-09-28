import type { ReactElement, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components, Options } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { common } from 'lowlight';
import powershell from 'highlight.js/lib/languages/powershell';
import { CodeBlock } from '@/components/CodeBlock';
import { ExternalLink } from '@/components/ExternalLink';
import './Markdown.css';

interface MarkdownProps {
  text: string;
}

interface ScrollableTableProps {
  children?: ReactNode;
}

const REMARK_PLUGINS: NonNullable<Options['remarkPlugins']> = [remarkGfm];

// `common` kennt kein PowerShell; `detect: false`, damit nur Blöcke mit Sprachangabe gefärbt werden.
const REHYPE_PLUGINS: NonNullable<Options['rehypePlugins']> = [
  [rehypeHighlight, { detect: false, languages: { ...common, powershell } }],
];

// Breite Tabellen scrollen in einer eigenen Hülle, statt den Chat aufzuweiten.
function ScrollableTable({ children }: ScrollableTableProps): ReactElement {
  return (
    <div className="markdown__table-scroll">
      <table>{children}</table>
    </div>
  );
}

const COMPONENTS: Components = {
  pre: CodeBlock,
  a: ExternalLink,
  table: ScrollableTable,
};

export function Markdown({ text }: MarkdownProps): ReactElement {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
