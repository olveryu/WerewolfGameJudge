import './BottomSheet.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import type { ReactNode } from 'react';

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
  return (
    <Dialog.Root
      open
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop className="bottom-sheet-backdrop" />
        <Dialog.Positioner className="bottom-sheet-positioner">
          <Dialog.Content className="bottom-sheet" aria-label={title} data-testid={testId}>
            <span className="bottom-sheet-handle" aria-hidden />
            {children}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
