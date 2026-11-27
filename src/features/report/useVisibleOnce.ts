import { useEffect, useState, type RefObject } from 'react';

/** Wie weit vor dem sichtbaren Bereich schon als „sichtbar“ gilt, damit das Zeichnen vor dem Scrollen fertig ist. */
const ROOT_MARGIN = '300px';

/** Wird `true`, sobald das Element erstmals (fast) im sichtbaren Bereich liegt, und bleibt dann `true`. */
export function useVisibleOnce(elementRef: RefObject<Element | null>): boolean {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    const element: Element | null = elementRef.current;
    if (isVisible || element === null) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        if (entries.some((entry: IntersectionObserverEntry) => entry.isIntersecting)) {
          setIsVisible(true);
        }
      },
      { rootMargin: ROOT_MARGIN },
    );
    observer.observe(element);
    return (): void => {
      observer.disconnect();
    };
  }, [elementRef, isVisible]);

  return isVisible;
}
