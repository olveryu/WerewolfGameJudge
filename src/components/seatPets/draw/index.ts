/**
 * PET_DRAW_MAP — RoleRevealEffectId → PetDrawConfig lookup.
 * Used by PetCanvas to render any pet by ID.
 */
import {
  drawCapsule,
  drawCardSprite,
  drawChainDragon,
  drawCrystal,
  drawDice,
  drawFilmBug,
  drawHound,
  drawLuckyStar,
  drawMeteorBuddy,
  drawScratchCat,
  drawSealBeast,
  drawVortexEye,
} from './petDraws';
import type { PetDrawConfig } from './types';

export const PET_DRAW_MAP: Record<string, PetDrawConfig> = {
  roulette: drawDice,
  roleHunt: drawHound,
  scratch: drawScratchCat,
  tarot: drawCrystal,
  gachaMachine: drawCapsule,
  cardPick: drawCardSprite,
  sealBreak: drawSealBeast,
  chainShatter: drawChainDragon,
  fortuneWheel: drawLuckyStar,
  meteorStrike: drawMeteorBuddy,
  filmRewind: drawFilmBug,
  vortexCollapse: drawVortexEye,
};
