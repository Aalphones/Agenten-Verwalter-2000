import { useContext } from 'react';
import type { ReactElement, ReactNode } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import type { Components, Options } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { common } from 'lowlight';
import powershell from 'highlight.js/lib/languages/powershell';
import { CodeBlock } from '@/components/CodeBlock';
import { ExternalLink } from '@/components/ExternalLink';
import { FileLink } from '@/components/FileLink';
import { FileLinkSessionContext } from '@/components/FileLinkSessionContext';
import { filePathOf } from '@/lib/fileLinks';
import './Markdown.css';

interface MarkdownProps {
  text: string;
}

interface ScrollableTableProps {
  children?: ReactNode;
}

interface InlineCodeProps {
  className?: string | undefined;
  children?: ReactNode;
}

interface MarkdownLinkProps {
  href?: string | undefined;
  children?: ReactNode;
}

// Absoluter Windows-Pfad; der Backslash kommt aus mdast-util-to-hast als `%5C` an.
const WINDOWS_PATH_URL = /^[a-z]:(?:[\\/]|%5c)/i;
const FILE_URL = /^file:\/\/\//i;

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

// Läuft auch für das `code` in Codeblöcken: deren Text endet immer auf `\n` (oder ist nach der
// Färbung kein einzelner String mehr) und wird so nie zum Dateiverweis.
function InlineCode({ className, children }: InlineCodeProps): ReactElement {
  const sessionId: string | null = useContext(FileLinkSessionContext);
  const code: ReactElement = <code className={className}>{children}</code>;
  if (sessionId === null || typeof children !== 'string' || children.endsWith('\n')) {
    return code;
  }
  const path: string | null = filePathOf(children);
  if (path === null) {
    return code;
  }
  return (
    <FileLink sessionId={sessionId} path={path}>
      {code}
    </FileLink>
  );
}

function MarkdownLink({ href, children }: MarkdownLinkProps): ReactElement {
  const sessionId: string | null = useContext(FileLinkSessionContext);
  const path: string | null =
    sessionId === null || href === undefined ? null : filePathOf(decodeHref(href));
  if (sessionId === null || path === null) {
    return <ExternalLink href={href}>{children}</ExternalLink>;
  }
  return (
    <FileLink sessionId={sessionId} path={path}>
      {children}
    </FileLink>
  );
}

function decodeHref(href: string): string {
  try {
    return decodeURI(href);
  } catch {
    return href;
  }
}

// Ohne Ausnahme verwirft react-markdown `C:\…` (gilt ihm als unbekanntes Protokoll) und `file:///…`.
// Geöffnet wird beides nur über `FileLink`, also nach der Prüfung im Core.
function transformUrl(url: string): string {
  if (WINDOWS_PATH_URL.test(url) || FILE_URL.test(url)) {
    return url;
  }
  return defaultUrlTransform(url);
}

const COMPONENTS: Components = {
  pre: CodeBlock,
  code: InlineCode,
  a: MarkdownLink,
  table: ScrollableTable,
};

export function Markdown({ text }: MarkdownProps): ReactElement {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={COMPONENTS}
        urlTransform={transformUrl}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
