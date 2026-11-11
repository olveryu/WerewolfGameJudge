import './CenterDialog.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import type { ReactNode } from 'react';

import { IconButton } from '@/components/IconButton';
import IconClose from '~icons/ion/close';

interface CenterDialogProps {
  open: boolean;
  /** Called when the user dismisses with Escape or the backdrop. */
  onClose: () => void;
  title: string;
  subtitle?: string;
  testId?: string;
  titleTestId?: string;
  closeButtonLabel?: string;
  className?: string;
  children: ReactNode;
}

/** Centered modal dialog (Ark UI): focus trap, Escape / backdrop dismissal, enter / exit motion. */
export function CenterDialog({
  open,
  onClose,
  title,
  subtitle,
  testId,
  titleTestId,
  closeButtonLabel,
  className,
  children,
}: CenterDialogProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop className="center-dialog-backdrop" />
        <Dialog.Positioner className="center-dialog-positioner">
          <Dialog.Content
            className={['center-dialog', className].filter(Boolean).join(' ')}
            data-has-close-button={closeButtonLabel !== undefined}
            data-testid={testId}
          >
            {closeButtonLabel !== undefined && (
              <IconButton
                className="center-dialog-close"
                label={closeButtonLabel}
                icon={<IconClose aria-hidden />}
                onClick={onClose}
              />
            )}
            <Dialog.Title className="center-dialog-title" data-testid={titleTestId}>
              {title}
            </Dialog.Title>
            {subtitle && (
              <Dialog.Description className="center-dialog-subtitle">{subtitle}</Dialog.Description>
            )}
            {children}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
