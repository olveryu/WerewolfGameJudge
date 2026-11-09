import './CenterDialog.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import { useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/Button';
import { type AlertButton, type AlertConfig, alertStore, dismissAlert } from '@/utils/alert';

const BUTTON_VARIANT = { default: 'primary', cancel: 'secondary', destructive: 'danger' } as const;

/**
 * The app's single alert dialog, driven by `showAlert`. Ark UI provides the alert-dialog
 * semantics, focus trap and presence; a button closes the alert after its `onPress` settles
 * unless a newer alert replaced it meanwhile.
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
        <Dialog.Positioner className="center-dialog-positioner">
          {alert && <AlertContent key={alert.generation} alert={alert} />}
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

function AlertContent({ alert }: { alert: AlertConfig }) {
  const [inputValue, setInputValue] = useState(alert.input?.defaultValue ?? '');
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);

  const press = async (button: AlertButton, index: number) => {
    setPendingIndex(index);
    try {
      await button.onPress?.(alert.input ? inputValue.trim() : undefined);
    } finally {
      setPendingIndex(null);
      dismissAlert(alert.generation);
    }
  };

  return (
    <Dialog.Content className="center-dialog">
      <Dialog.Title className="center-dialog-title">{alert.title}</Dialog.Title>
      {alert.message && (
        <Dialog.Description className="center-dialog-subtitle alert-message">
          {alert.message}
        </Dialog.Description>
      )}
      {alert.input && (
        <input
          className="text-input"
          value={inputValue}
          placeholder={alert.input.placeholder}
          onChange={(event) => setInputValue(event.target.value)}
        />
      )}
      <div className="center-dialog-actions">
        {alert.buttons.map((button, index) => (
          <Button
            key={button.text}
            variant={BUTTON_VARIANT[button.style ?? 'default']}
            disabled={button.disabled === true || (pendingIndex !== null && pendingIndex !== index)}
            loading={button.loading === true || pendingIndex === index}
            onClick={() => void press(button, index)}
          >
            {button.text}
          </Button>
        ))}
      </div>
    </Dialog.Content>
  );
}
