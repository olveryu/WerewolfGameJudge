import './BottomSheet.css';

import type { ReactNode } from 'react';

import { AppDialog } from '@/components/AppDialog';

/**
 * Bottom sheet (Ark UI dialog): slides up from the bottom edge, dismissed by the backdrop,
 * Escape or the caller. Mounted means open; the caller owns visibility.
 */
export function BottomSheet({
  title,
  onClose,
  testId,
  requireConfirmation = false,
  children,
}: {
  /** Accessible name; the caller renders its own visible heading. */
  readonly title: string;
  readonly onClose: () => void;
  readonly testId?: string;
  readonly requireConfirmation?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <AppDialog.Root
      open
      closeOnEscape={!requireConfirmation}
      closeOnInteractOutside={!requireConfirmation}
      onOpenChange={(details) => {
        if (!details.open && !requireConfirmation) onClose();
      }}
    >
      <AppDialog.Portal>
        <AppDialog.Backdrop tone="scrim" />
        <AppDialog.Positioner placement="bottom">
          <AppDialog.Content
            className="bottom-sheet"
            motion="slide-up"
            aria-label={title}
            data-testid={testId}
          >
            <span className="bottom-sheet-handle" aria-hidden />
            {children}
          </AppDialog.Content>
        </AppDialog.Positioner>
      </AppDialog.Portal>
    </AppDialog.Root>
  );
}
