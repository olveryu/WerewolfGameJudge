import { useState, useSyncExternalStore } from 'react';

import { ALERT_TEST_IDS, AlertDialog, type AlertDialogButton } from '@/components/AlertDialog';
import { TESTIDS } from '@/testids';
import { alertStore, dismissAlert } from '@/utils/alert';

/**
 * The app's single alert dialog, driven by `showAlert`, rendered by `AlertDialog`. A button
 * closes the alert once its `onPress` settles unless a newer alert replaced it meanwhile. A
 * rejected `onPress` keeps the alert open so the press can be retried (the callback presented its
 * own failure).
 *
 * The dialog surface stays mounted while alerts replace each other: the open dialog's dismissable
 * layer marks that node as the one pointer-interactive layer above the inert body, so remounting
 * it would leave the replacement alert unclickable. Only the per-alert state is keyed by
 * generation: the actions' pending state (`contentKey`) and the input's value.
 */
export function AlertHost() {
  const alert = useSyncExternalStore(alertStore.subscribe, alertStore.getSnapshot);
  const [input, setInput] = useState<{ readonly generation: number; readonly value: string }>({
    generation: -1,
    value: '',
  });
  const inputValue =
    alert !== null && input.generation === alert.generation
      ? input.value
      : (alert?.input?.defaultValue ?? '');

  const buttons: readonly AlertDialogButton[] =
    alert === null
      ? []
      : alert.buttons.map((button) => ({
          text: button.text,
          style: button.style,
          disabled: button.disabled,
          loading: button.loading,
          onPress: async () => {
            await button.onPress?.(alert.input ? inputValue.trim() : undefined);
            dismissAlert(alert.generation);
          },
        }));

  return (
    <AlertDialog
      open={alert !== null}
      title={alert?.title ?? ''}
      message={alert?.message}
      buttons={buttons}
      contentKey={alert?.generation}
      testIds={ALERT_TEST_IDS}
    >
      {alert?.input && (
        <input
          className="text-input"
          value={inputValue}
          placeholder={alert.input.placeholder}
          onChange={(event) =>
            setInput({ generation: alert.generation, value: event.target.value })
          }
          data-testid={TESTIDS.alertInput}
        />
      )}
    </AlertDialog>
  );
}
