/**
 * useRoomReview — the one review integration every game room uses.
 *
 * Resolves the game's contribution for this viewer (validating the
 * document), and returns the entry every surface renders through the
 * shared builders, `open` (the game's confirmation first, then the
 * dialog at a page), `shareAll` (a dialog-less export for host closing
 * flows), and the overlay — dialog, hidden export stage and share
 * progress — for the room's game overlays. While the dialog is open and
 * the viewer may share, the pages are captured in the background so a
 * tap hands them to the share sheet at once.
 */

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

import { showConfirmAlert } from '@/utils/alertPresets';

import type { RoomViewer } from '../model/RoomViewer';
import { assertReviewDocument } from './assertReviewDocument';
import { RoomReviewDialog, type RoomReviewShareControls } from './components/RoomReviewDialog';
import { RoomReviewExportStage } from './components/RoomReviewExportStage';
import {
  formatReviewShareRun,
  RoomReviewProgressModal,
} from './components/RoomReviewProgressModal';
import {
  createReviewAssetStore,
  type ReviewAssetStore,
  ReviewAssetStoreContext,
} from './reviewAssetStore';
import { formatReviewShareTitle } from './reviewCopy';
import type { RoomReviewEntry } from './roomReviewActions';
import type { RoomReviewContribution, RoomReviewDocument, RoomReviewSharing } from './types';
import { type RoomReviewExport, useRoomReviewExport } from './useRoomReviewExport';

export interface UseRoomReviewInput<TState> {
  readonly contribution: RoomReviewContribution<TState>;
  readonly state: TState;
  readonly viewer: RoomViewer;
  readonly roomId: string;
  readonly roomCode: string;
  /** Fired when the dialog opens, after the game's confirmation; null when the game tracks nothing. */
  readonly onOpened: (() => void) | null;
}

export interface RoomReviewController {
  /** The entry for this viewer; null while there is nothing to review. */
  readonly entry: RoomReviewEntry | null;
  /** Opens the dialog at a page (the first when null), after the game's confirmation. */
  readonly open: (pageKey: string | null) => void;
  /** Exports every page to the platform without the dialog; requires a document this viewer may share. */
  readonly shareAll: () => Promise<void>;
  /** Dialog, export stage and share progress, for the room's game overlays. */
  readonly overlay: ReactNode;
}

function pageIndexOf(document: RoomReviewDocument, pageKey: string): number {
  const index = document.pages.findIndex((page) => page.key === pageKey);
  if (index < 0) {
    throw new Error(`[FAIL-FAST] Review ${document.fileStem} has no page ${pageKey}`);
  }
  return index;
}

/** The first page holding a drawing whose load or decode failed; null when none failed. */
function findFailedImagePage(
  document: RoomReviewDocument,
  read: ReviewAssetStore['read'],
): number | null {
  const index = document.pages.findIndex((page) =>
    page.blocks.some((block) => block.kind === 'image' && read(block.assetId)?.status === 'failed'),
  );
  return index < 0 ? null : index;
}

function resolveShareControls(input: {
  readonly document: RoomReviewDocument;
  readonly pageIndex: number;
  readonly allPages: readonly number[];
  readonly sharing: RoomReviewSharing;
  readonly failedImagePage: number | null;
  readonly exporter: RoomReviewExport;
}): RoomReviewShareControls {
  const { document, pageIndex, allPages, sharing, failedImagePage, exporter } = input;
  if (!sharing.isAllowed) return { kind: 'denied', reason: sharing.reason };
  if (exporter.run !== null) {
    return {
      kind: 'running',
      status: formatReviewShareRun(exporter.run),
      onCancel: exporter.cancel,
    };
  }
  if (exporter.isSharing) return { kind: 'busy', status: '正在打开分享…' };
  if (failedImagePage !== null) {
    return {
      kind: 'blocked',
      reason:
        document.pages.length === 1
          ? '有图片加载失败，点击图片重试后再分享'
          : `第 ${failedImagePage + 1} 页有图片加载失败，点击图片重试后再分享`,
    };
  }
  const readiness = exporter.readiness(allPages);
  switch (readiness.kind) {
    case 'idle':
      return { kind: 'busy', status: '正在准备…' };
    case 'capturing':
      return {
        kind: 'busy',
        status:
          readiness.progress === null
            ? '正在准备…'
            : `正在生成 ${readiness.progress.done}/${readiness.progress.total}`,
      };
    case 'ready':
    case 'failed':
      return {
        kind: 'ready',
        onShareAll: () => void exporter.share(allPages),
        onSharePage: allPages.length > 1 ? () => void exporter.share([pageIndex]) : null,
      };
  }
}

export function useRoomReview<TState>(input: UseRoomReviewInput<TState>): RoomReviewController {
  const { contribution, state, viewer, roomId, roomCode, onOpened } = input;
  const { userId, isHost, seat } = viewer;
  const availability = useMemo(() => {
    const resolved = contribution.resolve({ state, viewer: { userId, isHost, seat }, roomCode });
    if (resolved.kind === 'available') assertReviewDocument(resolved.document);
    return resolved;
  }, [contribution, isHost, roomCode, seat, state, userId]);
  const document = availability.kind === 'available' ? availability.document : null;
  const sharedDocument =
    availability.kind === 'available' && availability.sharing.isAllowed ? document : null;
  const allPages = useMemo(
    () => (document === null ? [] : document.pages.map((_, index) => index)),
    [document],
  );

  // One asset scope per reviewed round: a new round starts with no drawings loaded.
  const roundKey = document?.roundKey ?? null;
  const [assetScope, setAssetScope] = useState(() => ({
    roundKey,
    store: createReviewAssetStore(),
  }));
  if (assetScope.roundKey !== roundKey) {
    setAssetScope({ roundKey, store: createReviewAssetStore() });
  }
  const assetStore = assetScope.store;
  useEffect(() => () => assetStore.abortPending(), [assetStore]);
  const failedImagePage = useSyncExternalStore(assetStore.subscribe, () =>
    document === null ? null : findFailedImagePage(document, assetStore.read),
  );

  const [openState, setOpenState] = useState<{
    readonly roundKey: string;
    readonly pageKey: string;
  } | null>(null);
  if (openState !== null && openState.roundKey !== roundKey) setOpenState(null);
  const openPageIndex =
    document !== null && openState !== null && openState.roundKey === document.roundKey
      ? pageIndexOf(document, openState.pageKey)
      : null;

  const exporter = useRoomReviewExport({
    roomId,
    userId,
    shareTitle: formatReviewShareTitle(roomCode),
    document: sharedDocument,
  });

  const open = useCallback(
    (pageKey: string | null) => {
      if (availability.kind !== 'available') {
        throw new Error(`[FAIL-FAST] Review opened while ${availability.kind}`);
      }
      const { document: openedDocument, confirmation } = availability;
      const [firstPage] = openedDocument.pages;
      if (firstPage === undefined) throw new Error('[FAIL-FAST] Review document has no pages');
      const targetKey = pageKey ?? firstPage.key;
      pageIndexOf(openedDocument, targetKey);
      const show = () => {
        setOpenState({ roundKey: openedDocument.roundKey, pageKey: targetKey });
        if (onOpened !== null) onOpened();
      };
      if (confirmation === null) {
        show();
        return;
      }
      showConfirmAlert(confirmation.title, confirmation.message, show, {
        confirmText: confirmation.confirmText,
      });
    },
    [availability, onOpened],
  );

  const shareAll = useCallback(() => {
    if (sharedDocument === null) {
      throw new Error('[FAIL-FAST] Review shared without a document this viewer may share');
    }
    return exporter.share(allPages);
  }, [allPages, exporter, sharedDocument]);

  const shareControls =
    openPageIndex === null || document === null || availability.kind !== 'available'
      ? null
      : resolveShareControls({
          document,
          pageIndex: openPageIndex,
          allPages,
          sharing: availability.sharing,
          failedImagePage,
          exporter,
        });
  const readinessKind =
    shareControls !== null && sharedDocument !== null && failedImagePage === null
      ? exporter.readiness(allPages).kind
      : null;
  const { prepare } = exporter;
  useEffect(() => {
    if (readinessKind === 'idle') prepare(allPages);
  }, [allPages, prepare, readinessKind]);

  const entry: RoomReviewEntry | null =
    availability.kind === 'notEnded'
      ? null
      : availability.kind === 'notPermitted'
        ? { isEnabled: false, disabledReason: availability.reason }
        : { isEnabled: true, onPress: () => open(null) };

  const overlay = (
    <ReviewAssetStoreContext.Provider value={assetStore}>
      {document !== null && openPageIndex !== null && shareControls !== null && (
        <RoomReviewDialog
          document={document}
          pageIndex={openPageIndex}
          onPageChange={(pageIndex) => {
            const page = document.pages[pageIndex];
            if (page === undefined) throw new Error(`[FAIL-FAST] Review has no page ${pageIndex}`);
            setOpenState({ roundKey: document.roundKey, pageKey: page.key });
          }}
          shareControls={shareControls}
          onClose={() => setOpenState(null)}
        />
      )}
      {exporter.stageRequest !== null && (
        <RoomReviewExportStage
          key={exporter.stageRequest.id}
          request={exporter.stageRequest}
          width={exporter.pageWidth}
        />
      )}
      {exporter.run !== null && openPageIndex === null && (
        <RoomReviewProgressModal run={exporter.run} onCancel={exporter.cancel} />
      )}
    </ReviewAssetStoreContext.Provider>
  );

  return { entry, open, shareAll, overlay };
}
