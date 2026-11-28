import './CenterDialog.css';

import { Portal } from '@ark-ui/react/portal';
import type { ReactNode } from 'react';

import { AppDialog } from '@/components/AppDialog';
import { IconButton } from '@/components/IconButton';
import IconClose from '~icons/ion/close';

interface CenterDialogProps {
  open: boolean;
  /**
   * Called when the user dismisses with Escape or the backdrop. `null`: the app closes the dialog
   * itself (a settlement panel that advances on its own), so the user cannot dismiss it.
   */
  onClose: (() => void) | null;
  /** Dialog heading; also its accessible name. */
  title: ReactNode;
  /** Keeps the heading for assistive technology only (the content shows its own name). */
  titleHidden?: boolean;
  /** Shown above the heading (a banner image, an eyebrow line). */
  beforeTitle?: ReactNode;
  /**
   * `regular`: padded content. `compact`: tighter gaps. `flush`: a card that draws to the
   * dialog's edges itself (no padding or gaps, profile-card width).
   */
  density?: 'regular' | 'compact' | 'flush';
  subtitle?: string;
  testId?: string;
  titleTestId?: string;
  closeButtonLabel?: string;
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
  titleHidden = false,
  beforeTitle,
  density = 'regular',
  children,
  requireConfirmation = false,
}: CenterDialogProps) {
  const isDismissible = onClose !== null && !requireConfirmation;
  return (
    <AppDialog.Root
      open={open}
      closeOnEscape={isDismissible}
      closeOnInteractOutside={isDismissible}
      onOpenChange={(details) => {
        if (!details.open && isDismissible) onClose();
      }}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <AppDialog.Backdrop className="center-dialog-backdrop" />
        <AppDialog.Positioner className="center-dialog-positioner">
          <AppDialog.Content
            className="center-dialog"
            data-density={density}
            data-has-close-button={closeButtonLabel !== undefined && onClose !== null}
            data-testid={testId}
          >
            {closeButtonLabel !== undefined && onClose !== null && (
              <span className="center-dialog-close">
                <IconButton
                  label={closeButtonLabel}
                  icon={<IconClose aria-hidden />}
                  onClick={onClose}
                />
              </span>
            )}
            {beforeTitle}
            <AppDialog.Title
              className={
                titleHidden ? 'center-dialog-title visually-hidden' : 'center-dialog-title'
              }
              data-testid={titleTestId}
            >
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
