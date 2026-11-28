import './BottomSheet.css';

import { Portal } from '@ark-ui/react/portal';
import type { ReactNode } from 'react';

import { AppDialog } from '@/components/AppDialog';
import { IconButton } from '@/components/IconButton';
import IconClose from '~icons/ion/close';

/** The sheet's own visible heading row: the title, an optional line under it, and a close key. */
export interface BottomSheetHeader {
  readonly description: string | null;
  readonly closeLabel: string;
}

/**
 * Bottom sheet (Ark UI dialog): slides up from the bottom edge, dismissed by the backdrop,
 * Escape or the caller. Mounted means open; the caller owns visibility. With `header` the
 * sheet draws the title row itself; without it the title is only the accessible name.
 */
export function BottomSheet({
  title,
  onClose,
  testId,
  requireConfirmation = false,
  header,
  children,
}: {
  /** Accessible name; also the visible heading when `header` is set. */
  readonly title: string;
  readonly onClose: () => void;
  readonly testId?: string;
  readonly requireConfirmation?: boolean;
  readonly header?: BottomSheetHeader;
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
          <AppDialog.Content
            className="bottom-sheet"
            aria-label={header === undefined ? title : undefined}
            data-testid={testId}
          >
            <span className="bottom-sheet-handle" aria-hidden />
            {header !== undefined && (
              <header className="bottom-sheet-header">
                <div className="bottom-sheet-heading">
                  <AppDialog.Title className="bottom-sheet-title">{title}</AppDialog.Title>
                  {header.description !== null && (
                    <AppDialog.Description className="bottom-sheet-description">
                      {header.description}
                    </AppDialog.Description>
                  )}
                </div>
                <IconButton
                  label={header.closeLabel}
                  icon={<IconClose aria-hidden />}
                  onClick={onClose}
                />
              </header>
            )}
            {children}
          </AppDialog.Content>
        </AppDialog.Positioner>
      </Portal>
    </AppDialog.Root>
  );
}
