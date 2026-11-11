/**
 * Seat entrance registry: statically imported code, with specs prepared and cached on demand.
 * Building the registry fails fast when a catalog id has no factory; preparation checks the id.
 */
import { SEAT_ANIMATION_IDS, type SeatAnimationId } from '@game-judge/game-engine/product/rewards';

import type { EntranceSpec } from '@/scene/entrance';

import { generatedEntrance } from './common';
import { epicEntrance } from './epic';
import * as legendaryModule from './legendary';
import * as mythicModule from './mythic';

type EntranceLoader = () => Promise<EntranceSpec>;

const legendary =
  (pick: (module: typeof import('./legendary')) => () => EntranceSpec) => async () =>
    pick(legendaryModule)();

const mythic = (pick: (module: typeof import('./mythic')) => () => EntranceSpec) => async () =>
  pick(mythicModule)();

const HAND_CRAFTED_ENTRANCES = {
  throneArrival: mythic((module) => module.throneArrival),
  wovenArrival: mythic((module) => module.wovenArrival),
  tidalArrival: mythic((module) => module.tidalArrival),
  inkArrival: mythic((module) => module.inkArrival),
  wolfKingEntry: legendary((module) => module.wolfKingEntry),
  witchBrew: legendary((module) => module.witchBrew),
  seerVision: legendary((module) => module.seerVision),
  hunterShot: legendary((module) => module.hunterShot),
  guardShield: legendary((module) => module.guardShield),
  nightFall: legendary((module) => module.nightFall),
  dawnBreak: legendary((module) => module.dawnBreak),
  bloodMoonRise: legendary((module) => module.bloodMoonRise),
  spiritSummon: legendary((module) => module.spiritSummon),
  cardReveal: legendary((module) => module.cardReveal),
} satisfies Partial<Record<SeatAnimationId, EntranceLoader>>;

/** Generated ids: a common or rare pattern plus a capitalised palette colour. */
const GENERATED_ENTRANCE_ID =
  /^(fade|slideUp|slideDown|zoomIn|zoomOut|spin|bounce|flip|blur|pop|spiral|shatter|portal|lightning|bloom)(Red|Orange|Amber|Green|Teal|Blue|Indigo|Purple|Pink|Gray)Enter$/;

/** The remaining `…Enter` ids are the 40 themed epic entrances. */
const EPIC_ENTRANCE_ID = /^[a-z][A-Za-z]*Enter$/;

function buildEntranceLoaders(): ReadonlyMap<SeatAnimationId, EntranceLoader> {
  const handCrafted: Partial<Record<SeatAnimationId, EntranceLoader>> = HAND_CRAFTED_ENTRANCES;
  return new Map(
    SEAT_ANIMATION_IDS.map((id) => {
      let loader = handCrafted[id];
      if (loader === undefined && GENERATED_ENTRANCE_ID.test(id)) {
        loader = async () => generatedEntrance(id);
      } else if (loader === undefined && EPIC_ENTRANCE_ID.test(id)) {
        loader = async () => epicEntrance(id);
      }
      if (loader === undefined) {
        throw new Error(`Missing seat entrance spec for "${id}"`);
      }
      return [id, loader] as const;
    }),
  );
}

/** Every catalog seat animation's spec loader, keyed by id. */
const ENTRANCE_LOADERS: ReadonlyMap<SeatAnimationId, EntranceLoader> = buildEntranceLoaders();

const loadedEntrances = new Map<SeatAnimationId, Promise<EntranceSpec>>();

/**
 * The entrance of catalog seat animation `id`, loaded once and shared (a stable promise for
 * `use()`). Rejects when preparation fails or the spec is registered under another id.
 */
export function loadEntranceSpec(id: SeatAnimationId): Promise<EntranceSpec> {
  let spec = loadedEntrances.get(id);
  if (!spec) {
    const loader = ENTRANCE_LOADERS.get(id);
    if (!loader) {
      throw new Error(`Missing seat entrance spec for "${id}"`);
    }
    spec = loader().then((loaded) => {
      if (loaded.id !== id) {
        throw new Error(`Seat entrance spec "${loaded.id}" is registered under "${id}"`);
      }
      return loaded;
    });
    loadedEntrances.set(id, spec);
  }
  return spec;
}
