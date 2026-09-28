import { Children, isValidElement, useEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import './CodeBlock.css';

type CopyState = 'idle' | 'copied' | 'failed';

const COPY_FEEDBACK_MS = 1500;
const FALLBACK_LANGUAGE = 'Text';
const LANGUAGE_CLASS_PATTERN = /(?:^|\s)language-(\S+)/;

const COPY_LABELS: Readonly<Record<CopyState, string>> = {
  idle: 'Kopieren',
  copied: 'Kopiert',
  failed: 'Fehlgeschlagen',
};

interface CodeBlockProps {
  children?: ReactNode;
}

interface CodeElementProps {
  className?: string | undefined;
}

// Das innere `code`-Element trägt die Sprache als Klasse `language-<kürzel>`.
function findLanguage(children: ReactNode): string {
  const codeElement: ReactNode = Children.toArray(children)[0];
  if (!isValidElement<CodeElementProps>(codeElement)) {
    return FALLBACK_LANGUAGE;
  }
  const match: RegExpMatchArray | null = (codeElement.props.className ?? '').match(
    LANGUAGE_CLASS_PATTERN,
  );
  return match?.[1] ?? FALLBACK_LANGUAGE;
}

export function CodeBlock({ children }: CodeBlockProps): ReactElement {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const preRef = useRef<HTMLPreElement>(null);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return (): void => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function copyCode(): Promise<void> {
    let outcome: CopyState = 'copied';
    try {
      await navigator.clipboard.writeText(preRef.current?.textContent ?? '');
    } catch {
      outcome = 'failed';
    }
    setCopyState(outcome);
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout((): void => {
      setCopyState('idle');
      resetTimerRef.current = null;
    }, COPY_FEEDBACK_MS);
  }

  return (
    <div className="code-block">
      <div className="code-block__header">
        <span className="code-block__language">{findLanguage(children)}</span>
        <button
          type="button"
          className={`code-block__copy code-block__copy--${copyState}`}
          aria-label={copyState === 'idle' ? 'Code kopieren' : COPY_LABELS[copyState]}
          onClick={(): void => {
            void copyCode();
          }}
        >
          {renderCopyIcon(copyState)}
          {COPY_LABELS[copyState]}
        </button>
      </div>
      <pre ref={preRef} className="code-block__body">
        {children}
      </pre>
    </div>
  );
}

function renderCopyIcon(copyState: CopyState): ReactElement {
  if (copyState === 'copied') {
    return (
      <svg
        className="code-block__icon"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        aria-hidden="true"
      >
        <path
          d="M2.4 6.3 4.9 8.7 9.6 3.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg className="code-block__icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect
        x="4"
        y="4"
        width="6.5"
        height="6.5"
        rx="1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M8 2.5V2.2A1 1 0 0 0 7 1.2H2.7a1 1 0 0 0-1 1V7a1 1 0 0 0 1 1h.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
