/**
 * Scene layer of the room seat board, loaded lazily (with PixiJS and the flair specs) only while
 * at least one seat shows a resident decoration. Avatar frames load as their own chunks.
 */
import { type RefObject, use } from 'react';

import type { DecorationSpec } from '@/scene/decoration';
import { FLAIR_SPECS } from '@/scene/flairs/registry';
import { loadFrameSpec } from '@/scene/frames/registry';
import type { ResidentDecorations } from '@/scene/residentDecorations';
import { SceneCanvas } from '@/scene/SceneCanvas';
import { SeatDecoration } from '@/scene/SeatDecoration';
import type { SceneFrameRate } from '@/scene/stage';

const specsByResidents = new WeakMap<ResidentDecorations, Promise<readonly DecorationSpec[]>>();

/**
 * Specs back to front (frame under flair, as in the previous seat tile); one promise per
 * residents object, so the seat's effect stays mounted.
 */
function residentSpecs(residents: ResidentDecorations): Promise<readonly DecorationSpec[]> {
  let specs = specsByResidents.get(residents);
  if (!specs) {
    const { frameId, flairId } = residents;
    const flair = flairId === null ? null : FLAIR_SPECS.get(flairId);
    if (flair === undefined) {
      throw new Error(`Missing seat flair spec for "${flairId}"`);
    }
    specs = (frameId === null ? Promise.resolve(null) : loadFrameSpec(frameId)).then((frame) =>
      [frame, flair].filter((spec) => spec !== null),
    );
    specsByResidents.set(residents, specs);
  }
  return specs;
}

/** The board's scene canvas. */
export function RoomSeatSceneCanvas({
  hostRef,
  frameRate,
}: {
  readonly hostRef: RefObject<HTMLElement | null>;
  readonly frameRate: SceneFrameRate;
}) {
  return <SceneCanvas hostRef={hostRef} frameRate={frameRate} />;
}

/** One seat's resident decorations, aligned with its tile. */
export function RoomSeatResidents({
  residents,
  tileRef,
  hostRef,
}: {
  readonly residents: ResidentDecorations;
  readonly tileRef: RefObject<HTMLElement | null>;
  readonly hostRef: RefObject<HTMLElement | null>;
}) {
  return (
    <SeatDecoration
      decorations={use(residentSpecs(residents))}
      tileRef={tileRef}
      hostRef={hostRef}
    />
  );
}
