import './CenterDialog.css';

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
  /** `md`: the standard card width. `sm`: a narrow card for a short status (a progress spinner). */
  size?: 'sm' | 'md';
  /**
   * `alertdialog`: a decision or status the user must answer (`AlertDialog`); the backdrop never
   * dismisses it, only Escape does when `onClose` is given.
   */
  role?: 'dialog' | 'alertdialog';
  subtitle?: string;
  testId?: string;
  positionerTestId?: string;
  titleTestId?: string;
  subtitleTestId?: string;
  closeButtonLabel?: string;
  closeButtonTestId?: string;
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
  positionerTestId,
  titleTestId,
  subtitleTestId,
  closeButtonLabel,
  closeButtonTestId,
  titleHidden = false,
  beforeTitle,
  density = 'regular',
  size = 'md',
  role = 'dialog',
  children,
  requireConfirmation = false,
}: CenterDialogProps) {
  const isDismissible = onClose !== null && !requireConfirmation;
  return (
    <AppDialog.Root
      open={open}
      role={role}
      closeOnEscape={isDismissible}
      closeOnInteractOutside={isDismissible && role === 'dialog'}
      onOpenChange={(details) => {
        if (!details.open && isDismissible) onClose();
      }}
      lazyMount
      unmountOnExit
    >
      <AppDialog.Portal>
        <AppDialog.Backdrop tone="scrim" />
        <AppDialog.Positioner placement="center" data-testid={positionerTestId}>
          <AppDialog.Content
            className="center-dialog"
            motion="pop"
            data-density={density}
            data-size={size}
            data-has-close-button={closeButtonLabel !== undefined && onClose !== null}
            data-testid={testId}
          >
            {closeButtonLabel !== undefined && onClose !== null && (
              <span className="center-dialog-close">
                <IconButton
                  label={closeButtonLabel}
                  icon={<IconClose aria-hidden />}
                  onClick={onClose}
                  data-testid={closeButtonTestId}
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
              <AppDialog.Description
                className="center-dialog-subtitle"
                data-testid={subtitleTestId}
              >
                {subtitle}
              </AppDialog.Description>
            )}
            {children}
          </AppDialog.Content>
        </AppDialog.Positioner>
      </AppDialog.Portal>
    </AppDialog.Root>
  );
}
