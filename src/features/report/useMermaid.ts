import { useEffect, useState } from 'react';
import type mermaidModule from 'mermaid';
import { useColorSchemeVersion } from '@/lib/useColorSchemeVersion';

/** Nur der Typ: das Paket selbst wird erst von `loadMermaid` nachgeladen. */
type MermaidApi = typeof mermaidModule;

/** Zustand eines Schaubilds: wartet (nicht sichtbar oder lädt), gezeichnet oder nicht lesbar. */
export type MermaidDrawing =
  { kind: 'waiting' } | { kind: 'ready'; svg: string } | { kind: 'failed'; message: string };

const MESSAGE_LINES = 2;

let loading: Promise<MermaidApi> | null = null;
let drawn = 0;

/** Mermaid lädt erst beim ersten Schaubild, das sichtbar wird. */
function loadMermaid(): Promise<MermaidApi> {
  loading ??= import('mermaid')
    .then((module) => module.default)
    .catch((reason: unknown) => {
      // Ein gescheiterter Ladeversuch darf den nächsten nicht sperren.
      loading = null;
      throw reason;
    });
  return loading;
}

function readToken(style: CSSStyleDeclaration, name: string): string {
  return style.getPropertyValue(name).trim();
}

/** Die Farben des Diagramms aus den semantischen Tokens; gelesen bei jedem Zeichnen, damit Hell und Dunkel stimmen. */
function configure(mermaid: MermaidApi): void {
  const style: CSSStyleDeclaration = getComputedStyle(document.documentElement);
  const token = (name: string): string => readToken(style, name);
  const font: string = token('--font-sans');
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: font,
    flowchart: { curve: 'basis', htmlLabels: true },
    themeVariables: {
      fontFamily: font,
      fontSize: '13px',
      background: token('--color-bg-surface'),
      primaryColor: token('--color-bg-sidebar'),
      primaryTextColor: token('--color-fg-primary'),
      primaryBorderColor: token('--color-border'),
      secondaryColor: token('--color-bg-hover'),
      tertiaryColor: token('--color-bg-surface'),
      lineColor: token('--color-fg-muted'),
      textColor: token('--color-fg-primary'),
      mainBkg: token('--color-bg-sidebar'),
      nodeBorder: token('--color-border'),
      edgeLabelBackground: token('--color-bg-surface'),
      clusterBkg: token('--color-bg-surface'),
      actorBkg: token('--color-bg-sidebar'),
      actorBorder: token('--color-border'),
      actorTextColor: token('--color-fg-primary'),
      actorLineColor: token('--color-border'),
      signalColor: token('--color-fg-muted'),
      signalTextColor: token('--color-fg-primary'),
      labelBoxBkgColor: token('--color-bg-sidebar'),
      labelTextColor: token('--color-fg-primary'),
      noteBkgColor: token('--color-bg-hover'),
      noteTextColor: token('--color-fg-primary'),
      loopTextColor: token('--color-fg-primary'),
    },
  });
}

/** Mermaid lässt bei einem Fehler Hilfselemente im Dokument liegen. */
function removeStrays(id: string): void {
  document.getElementById(`d${id}`)?.remove();
  document.getElementById(id)?.remove();
}

function messageOf(reason: unknown): string {
  const text: string = reason instanceof Error ? reason.message : String(reason);
  return text.split('\n').slice(0, MESSAGE_LINES).join(' ');
}

/** Zeichnet `code`, sobald `isActive` wahr ist; zeichnet neu, wenn sich Text oder Farbschema ändern. Bis dahin bleibt
 *  die zuletzt gezeichnete Fassung stehen. */
export function useMermaid(code: string, isActive: boolean): MermaidDrawing {
  const [drawing, setDrawing] = useState<MermaidDrawing>({ kind: 'waiting' });
  const schemeVersion: number = useColorSchemeVersion();

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }
    const controller = new AbortController();
    drawn += 1;
    const id = `report-mermaid-${String(drawn)}`;
    loadMermaid()
      .then(async (mermaid: MermaidApi) => {
        configure(mermaid);
        const result = await mermaid.render(id, code);
        if (!controller.signal.aborted) {
          setDrawing({ kind: 'ready', svg: result.svg });
        }
      })
      .catch((reason: unknown) => {
        removeStrays(id);
        if (!controller.signal.aborted) {
          setDrawing({ kind: 'failed', message: messageOf(reason) });
        }
      });
    return (): void => {
      controller.abort();
    };
  }, [code, isActive, schemeVersion]);

  return drawing;
}
