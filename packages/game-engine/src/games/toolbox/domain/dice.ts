/** 本人骰盅规则：数量在下次摇骰生效，固定骰保留点数，右往左移除未固定骰。 */

import { createSeededRng, randomIntInclusive } from '../../../platform/random/random';
import {
  TOOLBOX_DICE_DEFAULT_COUNT,
  TOOLBOX_DICE_FACES,
  TOOLBOX_DICE_MAX_COUNT,
  TOOLBOX_DICE_MIN_COUNT,
  type ToolboxDiceCup,
  type ToolboxDie,
} from '../state/types';
import { TOOLBOX_REASONS, type ToolboxReason } from './decision';

export type ToolboxCupOutcome =
  | { readonly kind: 'changed'; readonly cup: ToolboxDiceCup }
  | { readonly kind: 'rejected'; readonly reason: ToolboxReason };

export function createToolboxDiceCup(): ToolboxDiceCup {
  return {
    targetCount: TOOLBOX_DICE_DEFAULT_COUNT,
    stage: 'unrolled',
    dice: [],
    nextDieId: 0,
    version: 0,
  };
}

function countHeldDice(cup: ToolboxDiceCup): number {
  return cup.dice.filter((die) => die.held).length;
}

function changed(cup: ToolboxDiceCup, patch: Partial<ToolboxDiceCup>): ToolboxCupOutcome {
  return { kind: 'changed', cup: { ...cup, ...patch, version: cup.version + 1 } };
}

function rejected(reason: ToolboxReason): ToolboxCupOutcome {
  return { kind: 'rejected', reason };
}

/** 设置下次摇骰数量；少于已固定数量时拒绝，由用户自行取消固定。 */
export function setToolboxDiceCount(cup: ToolboxDiceCup, count: number): ToolboxCupOutcome {
  if (
    !Number.isSafeInteger(count) ||
    count < TOOLBOX_DICE_MIN_COUNT ||
    count > TOOLBOX_DICE_MAX_COUNT
  ) {
    return rejected(TOOLBOX_REASONS.diceCountInvalid);
  }
  if (count < countHeldDice(cup)) return rejected(TOOLBOX_REASONS.heldExceedsCount);
  if (count === cup.targetCount) return { kind: 'changed', cup };
  return changed(cup, { targetCount: count });
}

/**
 * 摇骰：未摇或已掀时可摇；先把骰子数量对齐到目标（右往左移除未固定骰、
 * 末尾追加新骰），再为未固定骰重新取点。
 */
export function rollToolboxDice(cup: ToolboxDiceCup, randomSeed: string): ToolboxCupOutcome {
  if (cup.stage === 'rolled') return rejected(TOOLBOX_REASONS.rollBeforeReveal);
  if (countHeldDice(cup) > cup.targetCount) return rejected(TOOLBOX_REASONS.heldExceedsCount);
  const dice: ToolboxDie[] = [...cup.dice];
  for (let index = dice.length - 1; index >= 0 && dice.length > cup.targetCount; index -= 1) {
    if (!dice[index]!.held) dice.splice(index, 1);
  }
  let nextDieId = cup.nextDieId;
  while (dice.length < cup.targetCount) {
    dice.push({ id: nextDieId, value: 1, held: false });
    nextDieId += 1;
  }
  const rng = createSeededRng(`${randomSeed}:toolbox:dice`);
  const rolled = dice.map((die) =>
    die.held ? die : { ...die, value: randomIntInclusive(1, TOOLBOX_DICE_FACES, rng) },
  );
  return changed(cup, { stage: 'rolled', dice: rolled, nextDieId });
}

export function revealToolboxDice(cup: ToolboxDiceCup): ToolboxCupOutcome {
  if (cup.stage === 'unrolled') return rejected(TOOLBOX_REASONS.notRolled);
  if (cup.stage === 'revealed') return { kind: 'changed', cup };
  return changed(cup, { stage: 'revealed' });
}

/** 固定只在掀开后可用；固定数不能超过下次摇骰数量。 */
export function toggleToolboxDieHold(cup: ToolboxDiceCup, dieId: number): ToolboxCupOutcome {
  if (cup.stage === 'unrolled') return rejected(TOOLBOX_REASONS.notRolled);
  if (cup.stage === 'rolled') return rejected(TOOLBOX_REASONS.notRevealed);
  const target = cup.dice.find((die) => die.id === dieId);
  if (target === undefined) return rejected(TOOLBOX_REASONS.dieMissing);
  if (!target.held && countHeldDice(cup) + 1 > cup.targetCount) {
    return rejected(TOOLBOX_REASONS.holdLimit);
  }
  return changed(cup, {
    dice: cup.dice.map((die) => (die.id === dieId ? { ...die, held: !die.held } : die)),
  });
}
