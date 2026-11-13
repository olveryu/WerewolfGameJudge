/** Load and present one protected Pictionary drawing without exposing its R2 object key. */

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import { type ReactNode, useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Spinner } from '@/components/Spinner';
import { pictionaryMediaTransport } from '@/games/pictionary/services/pictionaryMediaTransport';
import { TESTIDS } from '@/testids';
import { roomScreenLog } from '@/utils/logger';
import IconClose from '~icons/ion/close';
import IconExpandOutline from '~icons/ion/expand-outline';
import IconImageOutline from '~icons/ion/image-outline';
import IconRefreshOutline from '~icons/ion/refresh-outline';

type DrawingImageState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly uri: string }
  | { readonly kind: 'failed' };

interface RecordedImageState {
  readonly requestKey: string;
  readonly value: DrawingImageState;
}

const LOADING: DrawingImageState = { kind: 'loading' };

/** Fetches the drawing through the worker and offers a retry and a fullscreen preview. */
export function PictionaryDrawingImage({
  roomCode,
  entryId,
  label,
  controlledSeat,
  revealOverlay,
  prefetchedUri,
}: {
  readonly roomCode: string;
  readonly entryId: string;
  /** Accessible name of the drawing. */
  readonly label: string;
  readonly controlledSeat: number | null;
  readonly revealOverlay?: ReactNode;
  readonly prefetchedUri?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [recorded, setRecorded] = useState<RecordedImageState | null>(null);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const requestKey = `${roomCode}:${entryId}:${controlledSeat ?? 'self'}:${attempt}`;
  const imageState: DrawingImageState =
    prefetchedUri === undefined
      ? recorded?.requestKey === requestKey
        ? recorded.value
        : LOADING
      : { kind: 'loaded', uri: prefetchedUri };

  useEffect(() => {
    if (prefetchedUri !== undefined) return;
    const controller = new AbortController();
    pictionaryMediaTransport
      .readDrawingDataUri(roomCode, entryId, controlledSeat, controller.signal)
      .then(
        (uri) => setRecorded({ requestKey, value: { kind: 'loaded', uri } }),
        (error: unknown) => {
          if (controller.signal.aborted) return;
          roomScreenLog.warn('Pictionary drawing could not be loaded', { entryId, error });
          setRecorded({ requestKey, value: { kind: 'failed' } });
        },
      );
    return () => controller.abort();
  }, [controlledSeat, entryId, prefetchedUri, requestKey, roomCode]);

  return (
    <div className="pictionary-drawing-image">
      {revealOverlay ??
        (imageState.kind === 'loaded' ? (
          <>
            <button
              type="button"
              className="pictionary-drawing-image-button"
              aria-label={`${label}，全屏查看`}
              data-testid={TESTIDS.pictionaryDrawingImageButton}
              onClick={() => setIsFullscreenOpen(true)}
            >
              <img src={imageState.uri} alt={label} data-testid={TESTIDS.pictionaryDrawingImage} />
            </button>
            <span className="pictionary-drawing-expand" aria-hidden>
              <IconExpandOutline />
            </span>
            <Dialog.Root
              open={isFullscreenOpen}
              onOpenChange={(details) => setIsFullscreenOpen(details.open)}
              lazyMount
              unmountOnExit
            >
              <Portal>
                <Dialog.Backdrop className="pictionary-fullscreen-backdrop" />
                <Dialog.Positioner className="pictionary-fullscreen-positioner">
                  <Dialog.Content className="pictionary-fullscreen" aria-label={`${label}全屏预览`}>
                    <img
                      src={imageState.uri}
                      alt={`${label}全屏预览`}
                      data-testid={TESTIDS.pictionaryDrawingFullscreenPreview}
                    />
                    <IconButton
                      className="pictionary-fullscreen-close"
                      label="关闭"
                      icon={<IconClose aria-hidden />}
                      onClick={() => setIsFullscreenOpen(false)}
                      data-testid={TESTIDS.pictionaryDrawingFullscreenCloseButton}
                    />
                  </Dialog.Content>
                </Dialog.Positioner>
              </Portal>
            </Dialog.Root>
          </>
        ) : imageState.kind === 'loading' ? (
          <div className="pictionary-drawing-status">
            <Spinner label="正在加载画作" />
            <p aria-hidden>正在加载画作</p>
          </div>
        ) : (
          <div className="pictionary-drawing-status">
            <IconImageOutline aria-hidden />
            <p>画作加载失败</p>
            <Button
              variant="ghost"
              aria-label="重新加载画作"
              onClick={() => setAttempt((current) => current + 1)}
            >
              <IconRefreshOutline aria-hidden />
              重试
            </Button>
          </div>
        ))}
    </div>
  );
}
