import '@/components/CenterDialog.css';
import './RoomDialog.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import type { ReactNode } from 'react';

import { IconButton } from '@/components/IconButton';
import { useViewportWidth } from '@/features/room/hooks/useViewportWidth';
import { TESTIDS } from '@/testids';
import IconClose from '~icons/ion/close';

import { resolveRoomDialogWidth } from './roomDialogSize';

/**
 * Fixed room-dialog heading and footer around scrollable game-owned details.
 * Does not own visibility, permissions or confirmation state: mounted means open.
 */
export function RoomDialog({
  title,
  subtitle,
  titleTestId,
  testId,
  isContentFlush = false,
  dismissOnEscape = false,
  onClose,
  children,
  footer,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly titleTestId?: string;
  readonly testId?: string;
  /** Children print edge to edge (a full-bleed page) instead of inside the padded column. */
  readonly isContentFlush?: boolean;
  readonly dismissOnEscape?: boolean;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer: ReactNode;
}) {
  const width = resolveRoomDialogWidth(useViewportWidth());
  return (
    <Dialog.Root
      open
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
      closeOnEscape={dismissOnEscape}
      closeOnInteractOutside={false}
      // These dialogs can outlive the confirmation alert that opened them. Escape is explicit;
      // an outside interaction must not dismiss the nested room dialog.
      onRequestDismiss={(event) => {
        if (!dismissOnEscape) event.preventDefault();
      }}
    >
      <Portal>
        <Dialog.Backdrop className="center-dialog-backdrop" />
        <Dialog.Positioner className="room-dialog-positioner">
          <Dialog.Content className="room-dialog" style={{ width }} data-testid={testId}>
            <header className="room-dialog-header">
              <div className="room-dialog-heading">
                {subtitle !== undefined && (
                  <Dialog.Description className="room-dialog-subtitle">
                    {subtitle}
                  </Dialog.Description>
                )}
                <Dialog.Title className="room-dialog-title" data-testid={titleTestId}>
                  {title}
                </Dialog.Title>
              </div>
              <IconButton
                label="关闭详情"
                icon={<IconClose aria-hidden />}
                onClick={onClose}
                data-testid={TESTIDS.roomDialogCloseButton}
              />
            </header>
            <div className="room-dialog-body" data-flush={isContentFlush}>
              {children}
            </div>
            {footer !== null && <footer className="room-dialog-footer">{footer}</footer>}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
