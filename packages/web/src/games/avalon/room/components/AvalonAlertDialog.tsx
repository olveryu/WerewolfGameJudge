/**
 * Declarative avalon confirmation dialog in the app alert's shape (same DOM, classes and
 * `alert-*` test ids as `AlertHost`). The avalon confirmations are driven by room state
 * (a pending strike / check target / night instruction), so they render from props instead of
 * the imperative alert queue.
 */
import '@/components/CenterDialog.css';

import { Portal } from '@ark-ui/react/portal';

import { AppDialog } from '@/components/AppDialog';
import { Button } from '@/components/Button';
import { TESTIDS } from '@/testids';

const BUTTON_VARIANT = { default: 'primary', cancel: 'secondary', destructive: 'danger' } as const;

/** One dialog action, rendered left to right in the given order. */
export interface AvalonAlertDialogButton {
  readonly text: string;
  readonly style?: 'default' | 'cancel' | 'destructive';
  readonly onPress: () => void;
  readonly disabled?: boolean;
}

/** An open dialog; required confirmations cannot be dismissed implicitly. */
export function AvalonAlertDialog({
  title,
  message,
  buttons,
  onClose,
  requireConfirmation = false,
}: {
  readonly title: string;
  readonly message: string;
  readonly buttons: readonly AvalonAlertDialogButton[];
  readonly onClose: () => void;
  readonly requireConfirmation?: boolean;
}) {
  return (
    <AppDialog.Root
      open
      role="alertdialog"
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
        <AppDialog.Positioner
          className="center-dialog-positioner"
          data-testid={TESTIDS.alertModalOverlay}
        >
          <AppDialog.Content className="center-dialog" data-testid={TESTIDS.alertModal}>
            <AppDialog.Title className="center-dialog-title" data-testid={TESTIDS.alertTitle}>
              {title}
            </AppDialog.Title>
            <AppDialog.Description
              className="center-dialog-subtitle"
              data-testid={TESTIDS.alertMessage}
            >
              {message}
            </AppDialog.Description>
            <div className="center-dialog-actions" data-stacked={buttons.length > 2}>
              {buttons.map((button, index) => (
                <Button
                  key={button.text}
                  variant={BUTTON_VARIANT[button.style ?? 'default']}
                  disabled={button.disabled === true}
                  onClick={button.onPress}
                  data-testid={TESTIDS.alertButton(index)}
                >
                  {button.text}
                </Button>
              ))}
            </div>
          </AppDialog.Content>
        </AppDialog.Positioner>
      </Portal>
    </AppDialog.Root>
  );
}
