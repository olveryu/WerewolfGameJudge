import './CenterDialog.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import { useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/Button';
import { TESTIDS } from '@/testids';
import { type AlertButton, type AlertConfig, alertStore, dismissAlert } from '@/utils/alert';
import { log } from '@/utils/logger';

const alertLog = log.extend('Alert');

const BUTTON_VARIANT = { default: 'primary', cancel: 'secondary', destructive: 'danger' } as const;

/**
 * iOS alert order: two buttons sit in a row with cancel on the left; three or more stack with
 * cancel at the bottom.
 */
function orderButtons(buttons: readonly AlertButton[]): readonly AlertButton[] {
  const cancel = buttons.filter((button) => button.style === 'cancel');
  if (cancel.length === 0) return buttons;
  const rest = buttons.filter((button) => button.style !== 'cancel');
  return buttons.length === 2 ? [...cancel, ...rest] : [...rest, ...cancel];
}

/**
 * The app's single alert dialog, driven by `showAlert`. Ark UI provides the alert-dialog
 * semantics, focus trap and presence; a button closes the alert once its `onPress` settles
 * unless a newer alert replaced it meanwhile. A rejected `onPress` keeps the alert open so the
 * press can be retried (the callback presented its own failure).
 *
 * The dialog content node stays mounted while alerts replace each other: the open dialog's
 * dismissable layer marks that node as the one pointer-interactive layer above the inert body,
 * so remounting it would leave the replacement alert unclickable. Only the per-alert body is
 * keyed by generation, which resets its input and pending state.
 */
export function AlertHost() {
  const alert = useSyncExternalStore(alertStore.subscribe, alertStore.getSnapshot);
  return (
    <Dialog.Root
      open={alert !== null}
      role="alertdialog"
      closeOnInteractOutside={false}
      closeOnEscape={false}
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
            {alert && <AlertBody key={alert.generation} alert={alert} />}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

function AlertBody({ alert }: { alert: AlertConfig }) {
  const [inputValue, setInputValue] = useState(alert.input?.defaultValue ?? '');
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);

  const press = async (button: AlertButton, index: number) => {
    setPendingIndex(index);
    let isSettled = false;
    try {
      await button.onPress?.(alert.input ? inputValue.trim() : undefined);
      isSettled = true;
    } catch (error) {
      alertLog.warn(`Alert button "${button.text}" rejected; keeping the alert open`, error);
    } finally {
      setPendingIndex(null);
    }
    if (isSettled) dismissAlert(alert.generation);
  };

  return (
    <>
      <Dialog.Title className="center-dialog-title" data-testid={TESTIDS.alertTitle}>
        {alert.title}
      </Dialog.Title>
      {alert.message && (
        <Dialog.Description
          className="center-dialog-subtitle alert-message"
          data-testid={TESTIDS.alertMessage}
        >
          {alert.message}
        </Dialog.Description>
      )}
      {alert.input && (
        <input
          className="text-input"
          value={inputValue}
          placeholder={alert.input.placeholder}
          onChange={(event) => setInputValue(event.target.value)}
          data-testid={TESTIDS.alertInput}
        />
      )}
      <div className="center-dialog-actions" data-stacked={alert.buttons.length > 2}>
        {orderButtons(alert.buttons).map((button, index) => (
          <Button
            key={button.text}
            variant={BUTTON_VARIANT[button.style ?? 'default']}
            disabled={button.disabled === true || (pendingIndex !== null && pendingIndex !== index)}
            loading={button.loading === true || pendingIndex === index}
            onClick={() => void press(button, index)}
            data-testid={TESTIDS.alertButton(index)}
          >
            {button.text}
          </Button>
        ))}
      </div>
    </>
  );
}
