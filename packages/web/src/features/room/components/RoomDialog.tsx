import './RoomDialog.css';

import type { ReactNode } from 'react';

import { AppDialog } from '@/components/AppDialog';
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
    <AppDialog.Root
      open
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
      closeOnEscape={dismissOnEscape}
      closeOnInteractOutside={false}
    >
      <AppDialog.Portal>
        <AppDialog.Backdrop tone="scrim" />
        <AppDialog.Positioner placement="center-sized">
          <AppDialog.Content
            className="room-dialog"
            motion="pop"
            style={{ width }}
            data-testid={testId}
          >
            <header className="room-dialog-header">
              <div className="room-dialog-heading">
                {subtitle !== undefined && (
                  <AppDialog.Description className="room-dialog-subtitle">
                    {subtitle}
                  </AppDialog.Description>
                )}
                <AppDialog.Title className="room-dialog-title" data-testid={titleTestId}>
                  {title}
                </AppDialog.Title>
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
          </AppDialog.Content>
        </AppDialog.Positioner>
      </AppDialog.Portal>
    </AppDialog.Root>
  );
}
