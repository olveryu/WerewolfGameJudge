/**
 * Canonical Werewolf night-step identifiers and execution order.
 *
 * This module owns only stable identifiers and their order. Role specs, schemas,
 * plans, and resolvers all depend on this one vocabulary.
 */

const NIGHT_STEP_IDS = [
  'thiefChoose',
  'treasureMasterChoose',
  'cupidChooseLovers',
  'cupidLoversReveal',
  'magicianSwap',
  'slackerChooseIdol',
  'wildChildChooseIdol',
  'shadowChooseMimic',
  'avengerConfirm',
  'eclipseWolfQueenShelter',
  'nightmareBlock',
  'dreamcatcherDream',
  'guardProtect',
  'silenceElderSilence',
  'votebanElderBan',
  'crowCurse',
  'wolfKill',
  'seedWolfInfect',
  'wolfQueenCharm',
  'hiddenWolfReveal',
  'witchAction',
  'poisonerPoison',
  'hunterConfirm',
  'darkWolfKingConfirm',
  'wolfRobotLearn',
  'seerCheck',
  'mirrorSeerCheck',
  'drunkSeerCheck',
  'wolfWitchCheck',
  'gargoyleCheck',
  'pureWhiteCheck',
  'psychicCheck',
  'awakenedGargoyleConvert',
  'piperHypnotize',
  'piperHypnotizedReveal',
  'awakenedGargoyleConvertReveal',
  'seedWolfInfectReveal',
] as const;

export type NightStepId = (typeof NIGHT_STEP_IDS)[number];

export const NIGHT_STEP_ORDER: readonly NightStepId[] = NIGHT_STEP_IDS;

const NIGHT_STEP_ID_SET: ReadonlySet<string> = new Set(NIGHT_STEP_IDS);

export function isNightStepId(value: string): value is NightStepId {
  return NIGHT_STEP_ID_SET.has(value);
}
