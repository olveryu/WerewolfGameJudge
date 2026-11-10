/**
 * A drawing block. The drawing loads through the review's shared asset
 * store; the block shows a skeleton while it loads, the game's message
 * when the drawing is honestly unavailable, and a retry when the load or
 * the decode failed. In the export stage it reports readiness to the
 * gate: decoded or unavailable is ready, a failure blocks the export.
 */
import { type ReactNode, use, useEffect, useSyncExternalStore } from 'react';

import { TESTIDS } from '@/testids';

import { ReviewExportGateContext, useReviewAssetStore } from '../reviewAssetStore';
import type { ReviewImageBlock as ReviewImageBlockModel } from '../types';

export function ReviewImageBlock({
  block,
  blockId,
}: {
  readonly block: ReviewImageBlockModel;
  readonly blockId: string;
}) {
  const store = useReviewAssetStore();
  const gate = use(ReviewExportGateContext);
  const asset = useSyncExternalStore(store.subscribe, () => store.read(block.assetId));

  useEffect(() => {
    if (asset === null) store.request(block.assetId, block.load);
  }, [asset, block.assetId, block.load, store]);

  useEffect(() => {
    if (gate === null || asset === null) return;
    if (asset.status === 'unavailable') gate.report(blockId, 'ready');
    if (asset.status === 'failed') gate.report(blockId, 'failed');
  }, [asset, blockId, gate]);

  const frameStyle = { aspectRatio: String(block.aspectRatio) };
  let body: ReactNode;
  if (asset === null || asset.status === 'loading') {
    body = (
      <div className="review-image-frame" data-placeholder="true" style={frameStyle}>
        <span className="review-image-spinner" role="progressbar" aria-label="图片加载中" />
      </div>
    );
  } else if (asset.status === 'loaded') {
    body = (
      <img
        className="review-image-frame"
        style={frameStyle}
        data-testid={TESTIDS.roomReviewImage}
        src={asset.dataUri}
        alt={block.caption}
        onLoad={() => gate?.report(blockId, 'ready')}
        onError={() => store.markDecodeFailed(block.assetId)}
      />
    );
  } else if (asset.status === 'unavailable') {
    body = (
      <div className="review-image-frame" data-placeholder="true" style={frameStyle}>
        <p className="review-image-message">{asset.message}</p>
      </div>
    );
  } else {
    body = (
      <button
        type="button"
        className="review-image-frame"
        data-placeholder="true"
        style={frameStyle}
        onClick={() => store.retry(block.assetId, block.load)}
        aria-label={`${block.caption}加载失败，点击重试`}
      >
        <span className="review-image-message">加载失败 · 点击重试</span>
      </button>
    );
  }
  return (
    <figure className="review-image">
      <figcaption className="review-caption">{block.caption}</figcaption>
      {body}
    </figure>
  );
}
