/**
 * The app's only entry to Ark's dialog primitives (pinned by `PACKAGE_ADAPTERS` in
 * `eslint.config.mjs`). It also owns what every dialog shares around its surface: the backdrop,
 * the positioner's placement and the surface's entrance motion (`AppDialog.css`). Pages build
 * dialogs from the shells (`CenterDialog`, `AlertDialog`, `BottomSheet`, `MediaViewer`,
 * `RoomDialog`); only those and the registered primitives (`DIALOG_PRIMITIVES` in
 * `eslint.config.mjs`) import this module.
 *
 * Dialogs in this app hand over to each other (a confirmation opens a reveal, a review or a
 * sheet); none is a child that should close with its parent. zag's layer stack (1.47.0,
 * `@zag-js/dismissable` `layerStack.remove`) instead dismisses every layer above a removed one.
 * A dialog opened from a confirmation mounts while the confirmation is still playing its exit, so
 * removing the confirmation dismissed the new dialog straight away. That parent-removal cascade is
 * the only path into `onRequestDismiss`; Escape and outside interactions call `onDismiss`
 * directly and still follow each dialog's `closeOnEscape` / `closeOnInteractOutside`.
 */
import './AppDialog.css';

import {
  Dialog,
  type DialogBackdropProps,
  type DialogContentProps,
  type DialogPositionerProps,
  type DialogRootProps,
} from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';

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

/**
 * `scrim`: the standard dimmed page. `light`: a lighter dim that keeps the page readable (the
 * werewolf assistant). `media`: an opaque stage for a fullscreen image, above every page layer.
 */
type BackdropTone = 'scrim' | 'light' | 'media';

/**
 * The shared backdrop. Without `tone` it is the bare Ark part, styled by the registered primitive
 * that renders it (the admin drawer's scoped theme).
 */
function AppDialogBackdrop({
  tone,
  className,
  ...rest
}: DialogBackdropProps & { readonly tone?: BackdropTone }) {
  return (
    <Dialog.Backdrop
      {...rest}
      className={tone === undefined ? className : 'app-dialog-backdrop'}
      data-tone={tone}
    />
  );
}

/**
 * `center`: centered inside the screen gutter (modal cards). `center-sized`: centered with no
 * gutter, for a surface that sizes itself from the viewport (the room dialog). `bottom`: docked to
 * the bottom edge (sheets). `fill`: the surface fills the screen (media viewer).
 */
type Placement = 'center' | 'center-sized' | 'bottom' | 'fill';

/** The shared positioner; without `placement` a registered primitive lays it out itself. */
function AppDialogPositioner({
  placement,
  className,
  ...rest
}: DialogPositionerProps & { readonly placement?: Placement }) {
  return (
    <Dialog.Positioner
      {...rest}
      className={placement === undefined ? className : 'app-dialog-positioner'}
      data-placement={placement}
    />
  );
}

/** `pop`: scales in from the centre (cards). `slide-up`: rises from the bottom edge (sheets). */
type Motion = 'pop' | 'slide-up';

/** The dialog surface; `motion` gives it the shared entrance (the shell's class draws the rest). */
function AppDialogContent({
  motion,
  className,
  ...rest
}: DialogContentProps & { readonly motion?: Motion }) {
  return (
    <Dialog.Content
      {...rest}
      className={motion === undefined ? className : `app-dialog-content ${className ?? ''}`}
      data-motion={motion}
    />
  );
}

/** Dialog parts used by the app; `Root` is the cascade-safe root above. */
export const AppDialog = {
  Root: AppDialogRoot,
  /** Renders the dialog at the end of the document body, above the page. */
  Portal,
  Backdrop: AppDialogBackdrop,
  Positioner: AppDialogPositioner,
  Content: AppDialogContent,
  Title: Dialog.Title,
  Description: Dialog.Description,
  CloseTrigger: Dialog.CloseTrigger,
} as const;
