import './CenterDialog.css';

import { Portal } from '@ark-ui/react/portal';
import type { ReactNode } from 'react';

import { AppDialog } from '@/components/AppDialog';
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
  requireConfirmation?: boolean;
}

/** Centered modal dialog (Ark UI), with optional explicit-confirmation dismissal. */
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
  requireConfirmation = false,
}: CenterDialogProps) {
  return (
    <AppDialog.Root
      open={open}
      closeOnEscape={!requireConfirmation}
      closeOnInteractOutside={!requireConfirmation}
      onOpenChange={(details) => {
        if (!details.open && !requireConfirmation) onClose();
      }}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <AppDialog.Backdrop className="center-dialog-backdrop" />
        <AppDialog.Positioner className="center-dialog-positioner">
          <AppDialog.Content
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
            <AppDialog.Title className="center-dialog-title" data-testid={titleTestId}>
              {title}
            </AppDialog.Title>
            {subtitle && (
              <AppDialog.Description className="center-dialog-subtitle">
                {subtitle}
              </AppDialog.Description>
            )}
            {children}
          </AppDialog.Content>
        </AppDialog.Positioner>
      </Portal>
    </AppDialog.Root>
  );
}
