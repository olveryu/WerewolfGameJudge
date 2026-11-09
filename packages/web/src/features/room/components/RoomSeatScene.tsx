/**
 * Scene layer of the room seat board, loaded lazily (with PixiJS and the decoration specs) only
 * while at least one seat shows a resident decoration.
 */
import type { RefObject } from 'react';

import type { DecorationSpec } from '@/scene/decoration';
import { FLAIR_SPECS } from '@/scene/flairs/registry';
import type { ResidentDecorations } from '@/scene/residentDecorations';
import { SceneCanvas } from '@/scene/SceneCanvas';
import { SeatDecoration } from '@/scene/SeatDecoration';
import type { SceneFrameRate } from '@/scene/stage';

const specsByResidents = new WeakMap<ResidentDecorations, readonly DecorationSpec[]>();

/** Specs back to front; cached per residents object so the seat's effect stays mounted. */
function residentSpecs(residents: ResidentDecorations): readonly DecorationSpec[] {
  let specs = specsByResidents.get(residents);
  if (!specs) {
    const flair = residents.flairId === null ? null : FLAIR_SPECS.get(residents.flairId);
    if (flair === undefined) {
      throw new Error(`Missing seat flair spec for "${residents.flairId}"`);
    }
    specs = flair === null ? [] : [flair];
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
    <SeatDecoration decorations={residentSpecs(residents)} tileRef={tileRef} hostRef={hostRef} />
  );
}
