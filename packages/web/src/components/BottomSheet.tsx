import './BottomSheet.css';

import { Portal } from '@ark-ui/react/portal';
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
      <Portal>
        <AppDialog.Backdrop className="bottom-sheet-backdrop" />
        <AppDialog.Positioner className="bottom-sheet-positioner">
          <AppDialog.Content className="bottom-sheet" aria-label={title} data-testid={testId}>
            <span className="bottom-sheet-handle" aria-hidden />
            {children}
          </AppDialog.Content>
        </AppDialog.Positioner>
      </Portal>
    </AppDialog.Root>
  );
}
