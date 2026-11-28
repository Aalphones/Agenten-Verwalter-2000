import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

const STICK_TO_BOTTOM_TOLERANCE = 24;

export interface StickToBottom {
  scrollRef: RefObject<HTMLDivElement | null>;
  handleScroll: () => void;
}

/** Hält einen Scrollrahmen am Ende, wenn `content` nachwächst, solange der Nutzer nicht hochgescrollt hat. */
export function useStickToBottom(content: unknown, followsEnd: boolean): StickToBottom {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef<boolean>(true);

  useLayoutEffect(() => {
    const element: HTMLDivElement | null = scrollRef.current;
    if (element !== null && followsEnd && stickToBottomRef.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [content, followsEnd]);

  function handleScroll(): void {
    const element: HTMLDivElement | null = scrollRef.current;
    if (element === null) {
      return;
    }
    stickToBottomRef.current =
      element.scrollTop + element.clientHeight >= element.scrollHeight - STICK_TO_BOTTOM_TOLERANCE;
  }

  return { scrollRef, handleScroll };
}
