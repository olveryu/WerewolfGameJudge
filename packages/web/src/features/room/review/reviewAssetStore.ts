/**
 * Image assets of one review scope, shared by the in-room page and the
 * export stage so a drawing is fetched once however many surfaces show it.
 *
 * An asset moves loading → loaded | unavailable | failed. A failure is
 * retried only on the reader's request (the image block's retry button);
 * a decode failure of a loaded asset is a failure too. `abortPending`
 * aborts and forgets in-flight loads — the owner calls it when the scope
 * ends; a still-mounted reader simply requests again, which keeps the
 * store correct under React's mount → unmount → mount development replay.
 */

import { createContext, useContext } from 'react';

import { roomScreenLog } from '@/utils/logger';

import type { ReviewImageBlock } from './types';

export type ReviewAssetState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly dataUri: string }
  | { readonly status: 'unavailable'; readonly message: string }
  | { readonly status: 'failed' };

type ReviewAssetLoad = ReviewImageBlock['load'];

export interface ReviewAssetStore {
  /** The asset's state; null until some reader requests it. */
  readonly read: (assetId: string) => ReviewAssetState | null;
  /** Starts loading an asset nobody requested yet; a known asset is left as it is. */
  readonly request: (assetId: string, load: ReviewAssetLoad) => void;
  /** Reloads a failed asset. */
  readonly retry: (assetId: string, load: ReviewAssetLoad) => void;
  /** Marks a loaded asset failed: its data URI did not decode. */
  readonly markDecodeFailed: (assetId: string) => void;
  /** Changes on every state change; a cheap snapshot for subscribers of the whole store. */
  readonly getVersion: () => number;
  readonly subscribe: (listener: () => void) => () => void;
  readonly abortPending: () => void;
}

export function createReviewAssetStore(): ReviewAssetStore {
  const states = new Map<string, ReviewAssetState>();
  const pending = new Map<string, AbortController>();
  const listeners = new Set<() => void>();
  let version = 0;

  const emit = () => {
    version += 1;
    for (const listener of listeners) listener();
  };

  const start = (assetId: string, load: ReviewAssetLoad) => {
    const controller = new AbortController();
    pending.set(assetId, controller);
    states.set(assetId, { status: 'loading' });
    emit();
    load(controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        pending.delete(assetId);
        states.set(
          assetId,
          result.kind === 'loaded'
            ? { status: 'loaded', dataUri: result.dataUri }
            : { status: 'unavailable', message: result.message },
        );
        emit();
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        pending.delete(assetId);
        roomScreenLog.warn('Review image failed to load', { assetId, error });
        states.set(assetId, { status: 'failed' });
        emit();
      },
    );
  };

  return {
    read: (assetId) => states.get(assetId) ?? null,
    request: (assetId, load) => {
      if (!states.has(assetId)) start(assetId, load);
    },
    retry: (assetId, load) => {
      if (states.get(assetId)?.status !== 'failed') {
        throw new Error(`[FAIL-FAST] Review image ${assetId} retried while not failed`);
      }
      start(assetId, load);
    },
    markDecodeFailed: (assetId) => {
      if (states.get(assetId)?.status !== 'loaded') {
        throw new Error(`[FAIL-FAST] Review image ${assetId} failed to decode while not loaded`);
      }
      roomScreenLog.warn('Review image failed to decode', { assetId });
      states.set(assetId, { status: 'failed' });
      emit();
    },
    getVersion: () => version,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    abortPending: () => {
      if (pending.size === 0) return;
      for (const [assetId, controller] of pending) {
        controller.abort();
        states.delete(assetId);
      }
      pending.clear();
      emit();
    },
  };
}

export const ReviewAssetStoreContext = createContext<ReviewAssetStore | null>(null);

export function useReviewAssetStore(): ReviewAssetStore {
  const store = useContext(ReviewAssetStoreContext);
  if (store === null) {
    throw new Error('[FAIL-FAST] Review images render only inside a review asset scope');
  }
  return store;
}

/**
 * The export stage's readiness gate. Export-mode image blocks report when
 * their drawing is decoded (or honestly unavailable) and when it failed;
 * the in-room page renders without a gate.
 */
export interface ReviewExportGate {
  readonly report: (blockId: string, status: 'ready' | 'failed') => void;
}

export const ReviewExportGateContext = createContext<ReviewExportGate | null>(null);
