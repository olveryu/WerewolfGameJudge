/**
 * The in-room review dialog: the shared room dialog frame printing the
 * review page edge to edge, a pager for multi-page documents, and the
 * share controls. It owns no export state — the controls arrive resolved.
 */
import { Button } from '@/components/Button';
import {
  DisabledReasonCaption,
  GalleryPagerControls,
} from '@/features/room/components/RoomControls';
import { RoomDialog } from '@/features/room/components/RoomDialog';
import { TESTIDS } from '@/testids';
import IconShareOutline from '~icons/ion/share-outline';

import { REVIEW_TITLE } from '../reviewCopy';
import type { RoomReviewDocument } from '../types';
import { ReviewDocumentView } from './ReviewDocumentView';

/** The share area of the dialog, resolved from permission, drawings and the export state. */
export type RoomReviewShareControls =
  /** This viewer may read but not export. */
  | { readonly kind: 'denied'; readonly reason: string }
  /** A drawing failed; the export waits for the reader's retry. */
  | { readonly kind: 'blocked'; readonly reason: string }
  /** Pages are captured in the background, or the platform share sheet is up. */
  | { readonly kind: 'busy'; readonly status: string }
  /** A share run waits on capture or upload; the reader may stop waiting. */
  | { readonly kind: 'running'; readonly status: string; readonly onCancel: () => void }
  | {
      readonly kind: 'ready';
      readonly onShareAll: () => void;
      /** Shares only the current page; null on a single-page document. */
      readonly onSharePage: (() => void) | null;
    };

const REVIEW_SHARE_LABEL = '保存／分享图片';

function shareAllLabel(pageCount: number): string {
  return pageCount === 1 ? REVIEW_SHARE_LABEL : `保存／分享全部 ${pageCount} 页`;
}

function ShareControls({
  controls,
  pageCount,
}: {
  readonly controls: RoomReviewShareControls;
  readonly pageCount: number;
}) {
  const label = shareAllLabel(pageCount);
  switch (controls.kind) {
    case 'denied':
    case 'blocked':
      return (
        <div>
          <Button
            disabled
            data-testid={TESTIDS.roomReviewShareButton}
            className="review-share-full"
          >
            {label}
          </Button>
          <DisabledReasonCaption reason={controls.reason} />
        </div>
      );
    case 'busy':
      return (
        <Button disabled data-testid={TESTIDS.roomReviewShareButton} className="review-share-full">
          {controls.status}
        </Button>
      );
    case 'running':
      return (
        <div className="review-share-run">
          <p className="review-share-status" role="status">
            {controls.status}
          </p>
          <Button variant="ghost" size="sm" onClick={controls.onCancel}>
            取消
          </Button>
        </div>
      );
    case 'ready':
      return (
        <div className="review-share-ready">
          {controls.onSharePage !== null && (
            <Button
              variant="secondary"
              onClick={controls.onSharePage}
              data-testid={TESTIDS.roomReviewSharePageButton}
            >
              仅分享本页
            </Button>
          )}
          <Button onClick={controls.onShareAll} data-testid={TESTIDS.roomReviewShareButton}>
            <IconShareOutline aria-hidden />
            {label}
          </Button>
        </div>
      );
  }
}

export function RoomReviewDialog({
  document,
  pageIndex,
  onPageChange,
  shareControls,
  onClose,
}: {
  readonly document: RoomReviewDocument;
  readonly pageIndex: number;
  readonly onPageChange: (pageIndex: number) => void;
  readonly shareControls: RoomReviewShareControls;
  readonly onClose: () => void;
}) {
  const pageCount = document.pages.length;
  const page = document.pages[pageIndex];
  if (page === undefined) {
    throw new Error(`[FAIL-FAST] Review dialog has no page ${pageIndex}`);
  }
  return (
    <RoomDialog
      title={REVIEW_TITLE}
      {...(page.label === null ? {} : { subtitle: page.label })}
      testId={TESTIDS.roomReviewDialog}
      isContentFlush
      onClose={onClose}
      footer={
        <>
          {pageCount > 1 && (
            <GalleryPagerControls
              current={pageIndex}
              total={pageCount}
              prevLabel="上一页"
              nextLabel="下一页"
              onPrev={() => onPageChange(pageIndex - 1)}
              onNext={() => onPageChange(pageIndex + 1)}
              testIdScope={TESTIDS.roomReviewDialog}
            />
          )}
          <ShareControls controls={shareControls} pageCount={pageCount} />
        </>
      }
    >
      <ReviewDocumentView key={page.key} document={document} pageIndex={pageIndex} mode="screen" />
    </RoomDialog>
  );
}
