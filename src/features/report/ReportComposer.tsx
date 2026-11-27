import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { CommentBox } from '@/features/review/CommentBox';
import type { Anchor } from '@/features/report/reportCommentsContext';
import { COMMENT_COMPOSER_HINT, COMMENT_SUBMIT_LABEL } from '@/features/report/reportTexts';
import './ReportComposer.css';

/** Abstand zum Fensterrand und zur Stelle, an der das Feld hängt, in px. */
const EDGE_GAP = 8;
const ANCHOR_GAP = 6;

interface Position {
  top: number;
  left: number;
}

interface ReportComposerProps {
  /** Die Stelle (Knopf), an der das Feld hängt. */
  anchor: Anchor;
  where: string;
  initialText: string;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

function placeBelow(anchor: Anchor, box: HTMLElement): Position {
  const anchorRect: DOMRect = anchor.getBoundingClientRect();
  const boxRect: DOMRect = box.getBoundingClientRect();
  const maxLeft: number = window.innerWidth - boxRect.width - EDGE_GAP;
  const left: number = Math.max(EDGE_GAP, Math.min(anchorRect.left, maxLeft));
  const below: number = anchorRect.bottom + ANCHOR_GAP;
  if (below + boxRect.height <= window.innerHeight - EDGE_GAP) {
    return { top: below, left };
  }
  return { top: Math.max(EDGE_GAP, anchorRect.top - boxRect.height - ANCHOR_GAP), left };
}

/** Das Kommentarfeld des Berichts: hängt als Popover an der Stelle und folgt ihr beim Scrollen. */
export function ReportComposer({
  anchor,
  where,
  initialText,
  onSubmit,
  onCancel,
}: ReportComposerProps): ReactElement {
  const [text, setText] = useState<string>(initialText);
  const [position, setPosition] = useState<Position | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    function place(): void {
      const box: HTMLDivElement | null = boxRef.current;
      if (box === null) {
        return;
      }
      if (!anchor.isConnected) {
        onCancel();
        return;
      }
      setPosition(placeBelow(anchor, box));
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return (): void => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchor, onCancel]);

  const style: CSSProperties =
    position === null
      ? { visibility: 'hidden' }
      : { top: `${String(position.top)}px`, left: `${String(position.left)}px` };

  return (
    <div ref={boxRef} className="report-composer" style={style}>
      <CommentBox
        fileLabel={where}
        lineLabel=""
        hint={COMMENT_COMPOSER_HINT}
        submitLabel={COMMENT_SUBMIT_LABEL}
        text={text}
        isEditing={initialText !== ''}
        shouldReveal={false}
        onRevealed={(): void => undefined}
        onChange={setText}
        onSubmit={(): void => {
          onSubmit(text.trim());
        }}
        onCancel={onCancel}
      />
    </div>
  );
}
