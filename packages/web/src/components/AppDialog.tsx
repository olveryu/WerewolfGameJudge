/**
 * The app's only entry to Ark's dialog primitives (pinned by `Client dialogs: one Ark dialog
 * root` in `contracts/architecture.contract.test.ts`).
 *
 * Dialogs in this app hand over to each other (a confirmation opens a reveal, a review or a
 * sheet); none is a child that should close with its parent. zag's layer stack (1.47.0,
 * `@zag-js/dismissable` `layerStack.remove`) instead dismisses every layer above a removed one.
 * A dialog opened from a confirmation mounts while the confirmation is still playing its exit, so
 * removing the confirmation dismissed the new dialog straight away. That parent-removal cascade is
 * the only path into `onRequestDismiss`; Escape and outside interactions call `onDismiss`
 * directly and still follow each dialog's `closeOnEscape` / `closeOnInteractOutside`.
 */
import { Dialog, type DialogRootProps } from '@ark-ui/react/dialog';

import { log } from '@/utils/logger';

const dialogLog = log.extend('Dialog');

type LayerDismissEvent = Parameters<NonNullable<DialogRootProps['onRequestDismiss']>>[0];

type AppDialogRootProps = Omit<DialogRootProps, 'onRequestDismiss'>;

/**
 * Names a layer (a dialog's content node) for the log: its test id, else its accessible name
 * (`aria-label`, else the text of the title it is labelled by), else its generated Ark id.
 */
function layerName(node: HTMLElement): string {
  const labelledBy = node.getAttribute('aria-labelledby');
  const title = labelledBy === null ? null : node.ownerDocument.getElementById(labelledBy);
  return node.dataset.testid || node.getAttribute('aria-label') || title?.textContent || node.id;
}

function preventCascadeDismiss(event: LayerDismissEvent) {
  event.preventDefault();
  const { originalLayer, targetLayer } = event.detail;
  // zag types the removed layer as optional, but `layerStack.remove` always passes it.
  if (targetLayer === undefined) {
    throw new Error('[FAIL-FAST] A cascade dismiss arrived without the layer that was removed');
  }
  dialogLog.debug('Kept a dialog open after the layer below it was removed', {
    dialog: layerName(originalLayer),
    removedLayer: layerName(targetLayer),
  });
}

/** Ark `Dialog.Root` that never closes because the dialog below it was removed. */
function AppDialogRoot(props: AppDialogRootProps) {
  return <Dialog.Root {...props} onRequestDismiss={preventCascadeDismiss} />;
}

/** Dialog parts used by the app; `Root` is the cascade-safe root above. */
export const AppDialog = {
  Root: AppDialogRoot,
  Backdrop: Dialog.Backdrop,
  Positioner: Dialog.Positioner,
  Content: Dialog.Content,
  Title: Dialog.Title,
  Description: Dialog.Description,
  CloseTrigger: Dialog.CloseTrigger,
} as const;
