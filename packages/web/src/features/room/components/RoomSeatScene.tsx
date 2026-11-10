/**
 * Scene layer of the room seat board, loaded lazily (with PixiJS and the flair specs) only while
 * at least one seat shows a resident decoration or an entrance. Avatar frames, pets and
 * entrances load as their own chunks.
 */
import { type RefObject, use, useState } from 'react';

import type { DecorationSpec } from '@/scene/decoration';
import type { EntranceSpec } from '@/scene/entrance';
import { loadEntranceSpec } from '@/scene/entrances/registry';
import { FLAIR_SPECS } from '@/scene/flairs/registry';
import { loadFrameSpec } from '@/scene/frames/registry';
import { loadPetSpec } from '@/scene/pets/registry';
import type { ResidentDecorations } from '@/scene/residentDecorations';
import { SceneCanvas } from '@/scene/SceneCanvas';
import { SeatDecoration } from '@/scene/SeatDecoration';
import { SeatEntrance } from '@/scene/SeatEntrance';
import type { SceneFrameRate } from '@/scene/stage';

interface ResidentSpecs {
  readonly entrance: EntranceSpec | null;
  /** Back to front: frame, flair, pet (the previous seat tile's order). */
  readonly decorations: readonly DecorationSpec[];
  /** Flair and pet, which the previous tile hid while its entrance played. */
  readonly hiddenDuringEntrance: ReadonlySet<DecorationSpec>;
}

const NOTHING_HIDDEN: ReadonlySet<DecorationSpec> = new Set();

const specsByResidents = new WeakMap<ResidentDecorations, Promise<ResidentSpecs>>();

function loadOptional<Id, Spec>(id: Id | null, load: (id: Id) => Promise<Spec>) {
  return id === null ? Promise.resolve(null) : load(id);
}

/** One promise per residents object, so the seat's effects stay mounted. */
function residentSpecs(residents: ResidentDecorations): Promise<ResidentSpecs> {
  let specs = specsByResidents.get(residents);
  if (!specs) {
    const { frameId, flairId, petId, entranceId } = residents;
    const flair = flairId === null ? null : FLAIR_SPECS.get(flairId);
    if (flair === undefined) {
      throw new Error(`Missing seat flair spec for "${flairId}"`);
    }
    specs = Promise.all([
      loadOptional(frameId, loadFrameSpec),
      loadOptional(petId, loadPetSpec),
      loadOptional(entranceId, loadEntranceSpec),
    ]).then(([frame, pet, entrance]) => ({
      entrance,
      decorations: [frame, flair, pet].filter((spec) => spec !== null),
      hiddenDuringEntrance: new Set([flair, pet].filter((spec) => spec !== null)),
    }));
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

/**
 * One seat's entrance and resident decorations, aligned with its tile. The entrance plays when
 * the seat mounts and replays after each pause; flair and pet hide while it plays. `opacity`
 * dims the stage-drawn effects with a dimmed (locked) picker cell.
 */
export function RoomSeatResidents({
  residents,
  tileRef,
  hostRef,
  avatarRef,
  ghostHostRef,
  opacity = 1,
}: {
  readonly residents: ResidentDecorations;
  readonly tileRef: RefObject<HTMLElement | null>;
  readonly hostRef: RefObject<HTMLElement | null>;
  readonly avatarRef: RefObject<HTMLElement | null>;
  readonly ghostHostRef: RefObject<HTMLElement | null>;
  readonly opacity?: number;
}) {
  const specs = use(residentSpecs(residents));
  const [isEntranceActive, setEntranceActive] = useState(true);
  const suspended =
    specs.entrance !== null && isEntranceActive ? specs.hiddenDuringEntrance : NOTHING_HIDDEN;
  return (
    <>
      {specs.entrance !== null && (
        <SeatEntrance
          key={specs.entrance.id}
          spec={specs.entrance}
          tileRef={tileRef}
          hostRef={hostRef}
          avatarRef={avatarRef}
          ghostHostRef={ghostHostRef}
          onActiveChange={setEntranceActive}
          opacity={opacity}
        />
      )}
      <SeatDecoration
        decorations={specs.decorations}
        suspended={suspended}
        tileRef={tileRef}
        hostRef={hostRef}
        opacity={opacity}
      />
    </>
  );
}

/**
 * Loads the role reveal's stage chunk. Every reveal loader goes through this module because the
 * import site has to live in the seat-scene chunk: a PixiJS consumer imported from anywhere else
 * makes Rolldown fold the WebGL and WebGPU renderers into the stage's static closure, pushing the
 * scene budget over its limit.
 */
export const loadRevealEffectStage = () => import('./RoleRevealEffects/RevealEffectStage');

/** Loads the gacha page's capsule machine; it is a PixiJS consumer, so its import site lives here too. */
export const loadCapsuleMachine = () => import('@/features/gacha/machine/CapsuleMachine');
