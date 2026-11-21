/**
 * Declarative avalon confirmation dialog in the app alert's shape (same DOM, classes and
 * `alert-*` test ids as `AlertHost`). The avalon confirmations are driven by room state
 * (a pending strike / check target / night instruction), so they render from props instead of
 * the imperative alert queue.
 */
import '@/components/CenterDialog.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';

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

/** An open confirmation; Escape and the backdrop report `onClose`. */
export function AvalonAlertDialog({
  title,
  message,
  buttons,
  onClose,
}: {
  readonly title: string;
  readonly message: string;
  readonly buttons: readonly AvalonAlertDialogButton[];
  readonly onClose: () => void;
}) {
  return (
    <Dialog.Root
      open
      role="alertdialog"
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop className="center-dialog-backdrop" />
        <Dialog.Positioner
          className="center-dialog-positioner"
          data-testid={TESTIDS.alertModalOverlay}
        >
          <Dialog.Content className="center-dialog" data-testid={TESTIDS.alertModal}>
            <Dialog.Title className="center-dialog-title" data-testid={TESTIDS.alertTitle}>
              {title}
            </Dialog.Title>
            <Dialog.Description
              className="center-dialog-subtitle"
              data-testid={TESTIDS.alertMessage}
            >
              {message}
            </Dialog.Description>
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
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
