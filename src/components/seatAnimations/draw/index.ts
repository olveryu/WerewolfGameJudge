/**
 * OVERLAY_DRAW_MAP — effectId → draw function lookup.
 * Used by AnimationOverlay to render the appropriate overlay effect.
 */
import {
  arcSweep,
  bloodMoonRise,
  burstParticles,
  burstRing,
  cardSparkles,
  concentricRings,
  creatureSwarm,
  dawnRays,
  flameTongues,
  guardHexShield,
  hunterCrosshair,
  implodingRing,
  lightningBolt,
  nightFallStars,
  petalBloom,
  phaseGlow,
  portalEllipses,
  risingShapes,
  seerEye,
  shatterShards,
  shimmerLine,
  slashLines,
  spiritWisps,
  staticGlow,
  trailLine,
  vortexDots,
  witchBubbles,
  wolfKingOverlay,
} from './overlayDraws';
import type { OverlayDrawFn } from './types';

export type { OverlayDrawFn } from './types';

export const OVERLAY_DRAW_MAP: Record<string, OverlayDrawFn> = {
  // Common
  burstRing,
  implodingRing,
  staticGlow,
  trailLine,
  shimmerLine,
  arcSweep,
  // Rare
  petalBloom,
  shatterShards,
  portalEllipses,
  lightningBolt,
  // Epic
  flameTongues,
  vortexDots,
  concentricRings,
  phaseGlow,
  burstParticles,
  slashLines,
  risingShapes,
  creatureSwarm,
  // Legendary
  wolfKingOverlay,
  witchBubbles,
  seerEye,
  hunterCrosshair,
  guardHexShield,
  nightFallStars,
  dawnRays,
  bloodMoonRise,
  spiritWisps,
  cardSparkles,
};
