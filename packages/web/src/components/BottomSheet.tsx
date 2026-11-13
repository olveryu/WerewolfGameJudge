import './BottomSheet.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import { type ReactNode, useLayoutEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      element.closest('[hidden], [aria-hidden="true"], [inert]') === null &&
      window.getComputedStyle(element).visibility !== 'hidden',
  );
}

/**
 * Bottom sheet (Ark UI dialog): slides up from the bottom edge, dismissed by the backdrop,
 * Escape or the caller. Mounted means open; the caller owns visibility.
 */
export function BottomSheet({
  title,
  onClose,
  testId,
  children,
}: {
  /** Accessible name; the caller renders its own visible heading. */
  readonly title: string;
  readonly onClose: () => void;
  readonly testId?: string;
  readonly children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (content === null) return;

    const focusableElements = getFocusableElements(content);
    (focusableElements[0] ?? content).focus();

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const currentFocusableElements = getFocusableElements(content);
      const firstFocusable = currentFocusableElements[0] ?? content;
      const lastFocusable =
        currentFocusableElements[currentFocusableElements.length - 1] ?? content;
      const activeElement = document.activeElement;

      if (!content.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastFocusable : firstFocusable).focus();
      } else if (event.shiftKey && activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    document.addEventListener('keydown', handleTabKey, true);
    return () => {
      document.removeEventListener('keydown', handleTabKey, true);
    };
  }, []);

  return (
    <Dialog.Root
      open
      modal
      trapFocus
      finalFocusEl={() => returnFocusRef.current}
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop className="bottom-sheet-backdrop" />
        <Dialog.Positioner className="bottom-sheet-positioner">
          <Dialog.Content
            ref={contentRef}
            className="bottom-sheet"
            aria-label={title}
            data-testid={testId}
            tabIndex={-1}
          >
            <span className="bottom-sheet-handle" aria-hidden />
            {children}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
