import './AlertDialog.css';

import { type ReactNode, useState } from 'react';

import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import { TESTIDS } from '@/testids';
import { log } from '@/utils/logger';

const alertLog = log.extend('Alert');

const BUTTON_VARIANT = { default: 'primary', cancel: 'secondary', destructive: 'danger' } as const;

/** One alert action. A promise keeps the button loading (and the others disabled) until it settles. */
export interface AlertDialogButton {
  readonly text: string;
  readonly style?: 'default' | 'cancel' | 'destructive';
  readonly onPress: () => void | Promise<void>;
  readonly disabled?: boolean;
  readonly loading?: boolean;
}

/** Test ids of the dialog's parts; `ALERT_TEST_IDS` is the app alert's set. */
export interface AlertDialogTestIds {
  readonly positioner?: string;
  readonly content?: string;
  readonly title?: string;
  readonly message?: string;
  readonly button?: (index: number) => string;
}

/** The app alert's test ids (the `showAlert` queue and the alerts driven by room state). */
export const ALERT_TEST_IDS: AlertDialogTestIds = {
  positioner: TESTIDS.alertModalOverlay,
  content: TESTIDS.alertModal,
  title: TESTIDS.alertTitle,
  message: TESTIDS.alertMessage,
  button: TESTIDS.alertButton,
};

/**
 * iOS alert order: two buttons sit in a row with cancel on the left; three or more stack with
 * cancel at the bottom.
 */
function orderButtons(buttons: readonly AlertDialogButton[]): readonly AlertDialogButton[] {
  const cancel = buttons.filter((button) => button.style === 'cancel');
  if (cancel.length === 0) return buttons;
  const rest = buttons.filter((button) => button.style !== 'cancel');
  return buttons.length === 2 ? [...cancel, ...rest] : [...rest, ...cancel];
}

/**
 * Declarative alert dialog (`role="alertdialog"` on `CenterDialog`): a title, an optional
 * message, optional body content and the ordered actions. The backdrop never dismisses it;
 * Escape calls `onDismiss` when one is given. Closing is the caller's job: it unmounts the dialog
 * or clears `open` once an action has done its work.
 *
 * `contentKey` names the alert being shown: when it changes everything inside the card (title,
 * message, body, actions and their pending state) remounts while the dialog surface stays
 * mounted, so one alert replaces another in place without reusing its nodes.
 */
export function AlertDialog({
  open,
  title,
  titleHidden = false,
  message,
  media,
  buttons,
  onDismiss = null,
  size = 'md',
  contentKey,
  testIds = {},
  children,
}: {
  readonly open: boolean;
  /** Heading; also the accessible name. */
  readonly title: string;
  /** Keeps the heading for assistive technology only (a status whose message says it all). */
  readonly titleHidden?: boolean;
  readonly message?: string;
  /** Centered above the heading (a progress spinner). */
  readonly media?: ReactNode;
  readonly buttons: readonly AlertDialogButton[];
  /** Escape; `null`: the alert can only be answered by its actions. */
  readonly onDismiss?: (() => void) | null;
  readonly size?: 'sm' | 'md';
  readonly contentKey?: string | number;
  readonly testIds?: AlertDialogTestIds;
  /** Between the message and the actions (an input, a progress bar). */
  readonly children?: ReactNode;
}) {
  return (
    <CenterDialog
      open={open}
      role="alertdialog"
      onClose={onDismiss}
      title={title}
      titleHidden={titleHidden}
      subtitle={message}
      beforeTitle={
        media === undefined ? undefined : <span className="alert-dialog-media">{media}</span>
      }
      size={size}
      testId={testIds.content}
      positionerTestId={testIds.positioner}
      titleTestId={testIds.title}
      subtitleTestId={testIds.message}
      contentKey={contentKey}
    >
      {children}
      {buttons.length > 0 && <AlertDialogActions buttons={buttons} buttonTestId={testIds.button} />}
    </CenterDialog>
  );
}

function AlertDialogActions({
  buttons,
  buttonTestId,
}: {
  readonly buttons: readonly AlertDialogButton[];
  readonly buttonTestId: ((index: number) => string) | undefined;
}) {
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);

  const press = async (button: AlertDialogButton, index: number) => {
    setPendingIndex(index);
    try {
      await button.onPress();
    } catch (error) {
      alertLog.warn(`Alert button "${button.text}" rejected; keeping the alert open`, error);
    } finally {
      setPendingIndex(null);
    }
  };

  return (
    <div className="center-dialog-actions" data-stacked={buttons.length > 2}>
      {orderButtons(buttons).map((button, index) => (
        <Button
          key={button.text}
          variant={BUTTON_VARIANT[button.style ?? 'default']}
          disabled={button.disabled === true || (pendingIndex !== null && pendingIndex !== index)}
          loading={button.loading === true || pendingIndex === index}
          onClick={() => void press(button, index)}
          data-testid={buttonTestId?.(index)}
        >
          {button.text}
        </Button>
      ))}
    </div>
  );
}
