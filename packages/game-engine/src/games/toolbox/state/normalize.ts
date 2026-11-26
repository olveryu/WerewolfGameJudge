/** 工具箱权威状态不变量：持久化或演化后的破损状态直接失败，不做修补。 */

import {
  assertStateIdentity,
  createStateInvariant,
  type StateInvariant,
} from '../../../platform/protocol/stateInvariant';
import {
  hasEnoughToolboxCards,
  isStorableToolboxConfig,
  isUsableToolboxIdentityConfig,
} from '../domain/config';
import {
  TOOLBOX_DICE_CUP_STAGES,
  TOOLBOX_DICE_FACES,
  TOOLBOX_DICE_MAX_COUNT,
  TOOLBOX_DICE_MIN_COUNT,
  TOOLBOX_GAME_TYPE,
  type ToolboxActivePhase,
  type ToolboxDiceCup,
  type ToolboxIdentityConfig,
  type ToolboxIdentityRound,
  type ToolboxState,
} from './types';

const invariant: StateInvariant = createStateInvariant('Toolbox');

function isNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function isUniqueUserList(userIds: readonly string[]): boolean {
  return userIds.every((userId) => userId.length > 0) && new Set(userIds).size === userIds.length;
}

export function buildToolboxSessionId(sequence: number): string {
  return `toolbox:session:${sequence}`;
}

/** 结构比较两份身份配置（含顺序）。 */
function isSameToolboxIdentityConfig(
  left: ToolboxIdentityConfig,
  right: ToolboxIdentityConfig,
): boolean {
  return (
    left.cardsPerPlayer === right.cardsPerPlayer &&
    left.identities.length === right.identities.length &&
    left.identities.every((identity, index) => {
      const other = right.identities[index];
      return (
        other !== undefined &&
        other.name === identity.name &&
        other.description === identity.description &&
        other.count === identity.count
      );
    })
  );
}

function assertCup(cup: ToolboxDiceCup, path: string): void {
  invariant(
    Number.isSafeInteger(cup.targetCount) &&
      cup.targetCount >= TOOLBOX_DICE_MIN_COUNT &&
      cup.targetCount <= TOOLBOX_DICE_MAX_COUNT,
    `${path} target count`,
  );
  invariant(TOOLBOX_DICE_CUP_STAGES.includes(cup.stage), `${path} stage`);
  invariant(isNonNegativeInteger(cup.version), `${path} version`);
  invariant(isNonNegativeInteger(cup.nextDieId), `${path} next die id`);
  invariant((cup.stage === 'unrolled') === (cup.dice.length === 0), `${path} unrolled dice`);
  invariant(cup.dice.length <= TOOLBOX_DICE_MAX_COUNT, `${path} dice count`);
  invariant(new Set(cup.dice.map((die) => die.id)).size === cup.dice.length, `${path} die ids`);
  invariant(
    cup.dice.every(
      (die) =>
        isNonNegativeInteger(die.id) &&
        die.id < cup.nextDieId &&
        Number.isSafeInteger(die.value) &&
        die.value >= 1 &&
        die.value <= TOOLBOX_DICE_FACES,
    ),
    `${path} dice`,
  );
  invariant(
    cup.dice.filter((die) => die.held).length <= cup.targetCount,
    `${path} held count exceeds target`,
  );
}

function assertIdentityRound(
  round: ToolboxIdentityRound,
  phase: ToolboxActivePhase,
  publicConfig: ToolboxIdentityConfig,
): void {
  invariant(isUsableToolboxIdentityConfig(round.config), 'identity round configuration');
  invariant(
    isSameToolboxIdentityConfig(round.config, publicConfig),
    'identity public configuration',
  );
  invariant(
    hasEnoughToolboxCards(round.config, phase.participantUserIds.length),
    'identity deck size',
  );
  const { identities, cardsPerPlayer } = round.config;
  invariant(round.remaining.length === identities.length, 'identity remaining length');
  invariant(
    round.hands.length === phase.participantUserIds.length &&
      round.hands.every((hand, index) => hand.userId === phase.participantUserIds[index]),
    'identity hands order',
  );
  const drawn = identities.map(() => 0);
  for (const hand of round.hands) {
    invariant(hand.identityIndexes.length <= cardsPerPlayer, 'identity hand quota');
    for (const identityIndex of hand.identityIndexes) {
      invariant(
        Number.isSafeInteger(identityIndex) &&
          identityIndex >= 0 &&
          identityIndex < identities.length,
        'identity hand index',
      );
      drawn[identityIndex] = drawn[identityIndex]! + 1;
    }
  }
  invariant(
    identities.every((identity, index) => {
      const remaining = round.remaining[index]!;
      return isNonNegativeInteger(remaining) && remaining + drawn[index]! === identity.count;
    }),
    'identity deck conservation',
  );
}

function assertActivePhase(state: ToolboxState, phase: ToolboxActivePhase): void {
  invariant(state.sessionSequence >= 1, 'active session sequence');
  invariant(phase.sessionId === buildToolboxSessionId(state.sessionSequence), 'session id');
  invariant(
    phase.participantUserIds.length > 0 && isUniqueUserList(phase.participantUserIds),
    'participants',
  );
  invariant(state.config.tools.length > 0, 'active tools');
  invariant((phase.dice !== null) === state.config.tools.includes('dice'), 'dice tool state');
  invariant(
    (phase.identity !== null) === state.config.tools.includes('identity'),
    'identity tool state',
  );
  if (phase.dice !== null) {
    invariant(
      phase.dice.length === phase.participantUserIds.length &&
        phase.dice.every((entry, index) => entry.userId === phase.participantUserIds[index]),
      'dice cups order',
    );
    phase.dice.forEach((entry, index) => assertCup(entry.cup, `dice cup ${index}`));
  }
  if (phase.identity !== null) {
    assertIdentityRound(phase.identity, phase, state.config.identity);
  }
}

/** 校验权威状态，不补默认值、不丢弃提交内容。 */
export function normalizeToolboxState(state: ToolboxState): ToolboxState {
  assertStateIdentity(state, TOOLBOX_GAME_TYPE, 'Toolbox');
  invariant(isUniqueUserList(state.memberUserIds), 'members');
  invariant(isStorableToolboxConfig(state.config), 'configuration');
  invariant(isNonNegativeInteger(state.configVersion), 'configuration version');
  invariant(isNonNegativeInteger(state.sessionSequence), 'session sequence');
  if (state.phase.kind === 'preparing') {
    invariant(isUniqueUserList(state.phase.seatedUserIds), 'seated users');
  } else {
    assertActivePhase(state, state.phase);
  }
  return state;
}
