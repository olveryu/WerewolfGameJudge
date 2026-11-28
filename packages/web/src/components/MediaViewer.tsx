import './MediaViewer.css';

import { AppDialog } from '@/components/AppDialog';
import { IconButton } from '@/components/IconButton';
import IconClose from '~icons/ion/close';

/**
 * Fullscreen image viewer: the image fills an opaque stage above every page layer, contained
 * inside the safe area, with one close button on the media. Escape and the close button dismiss.
 */
export function MediaViewer({
  open,
  onClose,
  src,
  alt,
  imageTestId,
  closeButtonTestId,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly src: string;
  /** The image's text alternative; also the viewer's accessible name. */
  readonly alt: string;
  readonly imageTestId?: string;
  readonly closeButtonTestId?: string;
}) {
  return (
    <AppDialog.Root
      open={open}
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
      lazyMount
      unmountOnExit
    >
      <AppDialog.Portal>
        <AppDialog.Backdrop tone="media" />
        <AppDialog.Positioner placement="fill">
          <AppDialog.Content className="media-viewer" aria-label={alt}>
            <img src={src} alt={alt} data-testid={imageTestId} />
            <span className="media-viewer-close">
              <IconButton
                variant="on-media"
                label="关闭"
                icon={<IconClose aria-hidden />}
                onClick={onClose}
                data-testid={closeButtonTestId}
              />
            </span>
          </AppDialog.Content>
        </AppDialog.Positioner>
      </AppDialog.Portal>
    </AppDialog.Root>
  );
}
