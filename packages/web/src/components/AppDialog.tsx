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

/** Names a layer node for the log: its test id, else its Ark id. */
function layerName(node: HTMLElement | undefined): string | null {
  return node === undefined ? null : (node.dataset.testid ?? node.id);
}

function preventCascadeDismiss(event: LayerDismissEvent) {
  event.preventDefault();
  dialogLog.debug('Kept a dialog open after the layer below it was removed', {
    dialog: layerName(event.detail.originalLayer),
    removedLayer: layerName(event.detail.targetLayer),
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
