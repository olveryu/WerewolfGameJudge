/**
 * resolveNightInteraction: every model kind from a real engine
 * projection — actioner vs non-actioner, locks, drafts, hints — and the
 * message / command each kind produces.
 */
import {
  type ActionSchema,
  type GameState,
  type RoleId,
  type SchemaId,
  SCHEMAS,
} from '@game-judge/game-engine/games/werewolf/public';

import { AUDIO_PLAYBACK_LOCK_REASON } from '@/features/room/model/audioPlaybackLock';

import { buildNightCommand, WOLF_VOTE_WITHDRAW_TARGET } from '../buildNightCommand';
import type { NightDraft, NightInteractionModel } from '../NightInteractionModel';
import {
  PENDING_ACK_LOCK_REASON,
  renderActionerMessage,
  resolveNightInteraction,
} from '../resolveNightInteraction';
import { nightState, viewAs } from './nightFixtures';

const EMPTY_DRAFT: NightDraft = { firstSwapSeat: null, multiSelectedSeats: [] };
const NOW = 10_000;
const SCOPE = { stepId: 'wolfKill' as const, roleRevealRandomNonce: null };

function resolve(
  viewModel: ReturnType<typeof viewAs>,
  extra: Partial<{
    draft: NightDraft;
    swapSecondSeat: number | null;
    isAudioPlaying: boolean;
    hasPendingCommand: boolean;
    nowMs: number;
  }> = {},
): NightInteractionModel {
  return resolveNightInteraction({
    viewModel,
    draft: extra.draft ?? EMPTY_DRAFT,
    swapSecondSeat: extra.swapSecondSeat ?? null,
    locks: {
      isAudioPlaying: extra.isAudioPlaying ?? false,
      hasPendingCommand: extra.hasPendingCommand ?? false,
    },
    nowMs: extra.nowMs ?? NOW,
  });
}

function expectKind<K extends NightInteractionModel['kind']>(
  model: NightInteractionModel,
  kind: K,
): Extract<NightInteractionModel, { kind: K }> {
  if (model.kind !== kind) throw new Error(`Expected ${kind}, received ${model.kind}`);
  return model as Extract<NightInteractionModel, { kind: K }>;
}

/** Narrows a registry schema to one kind; the registry type is the union. */
function schemaOfKind<K extends ActionSchema['kind']>(
  id: SchemaId,
  kind: K,
): Extract<ActionSchema, { kind: K }> {
  const schema = SCHEMAS[id];
  if (schema.kind !== kind) throw new Error(`${id} is ${schema.kind}, expected ${kind}`);
  return schema as Extract<ActionSchema, { kind: K }>;
}

const BOARD: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager'];
const MAGICIAN_BOARD: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'magician'];

describe('locks and idleness', () => {
  it('is idle outside the night and for a non-actioner', () => {
    const state = nightState({ roles: BOARD, stepId: 'seerCheck' });
    expect(resolve(viewAs(state, 5))).toEqual({ kind: 'idle' });
    expect(resolve(viewAs(state, null))).toEqual({ kind: 'idle' });
  });

  it('blocks on narration before anything else, then on a pending command', () => {
    const state = nightState({ roles: BOARD, stepId: 'seerCheck' });
    expect(resolve(viewAs(state, 2), { isAudioPlaying: true })).toEqual({
      kind: 'blocked',
      reason: AUDIO_PLAYBACK_LOCK_REASON,
    });
    expect(resolve(viewAs(state, 2), { hasPendingCommand: true })).toEqual({
      kind: 'blocked',
      reason: PENDING_ACK_LOCK_REASON,
    });
  });
});

describe('pickSeat (chooseSeat)', () => {
  it('lists pickable seats (not self) with the schema confirm copy', () => {
    const state = nightState({ roles: BOARD, stepId: 'seerCheck' });
    const model = expectKind(resolve(viewAs(state, 2)), 'pickSeat');
    expect(model.selectable).toEqual([0, 1, 3, 4, 5]);
    expect(model.prompt.title).toBe('预言家行动');
    expect(model.confirmTitle).toBe(SCHEMAS.seerCheck.ui!.confirmTitle);
    expect(model.skipLabel).toBe('不用技能');
    expect(buildNightCommand(model, { kind: 'seat', seat: 0 }, SCOPE)).toEqual({
      type: 'werewolf.action.submit',
      input: { kind: 'target', target: 0 },
      expectedStep: { currentStepId: 'wolfKill', roleRevealRandomNonce: null },
    });
    expect(buildNightCommand(model, { kind: 'skip' }, SCOPE)).toMatchObject({
      input: { kind: 'skip' },
    });
  });

  it('owes a reveal ack after the check lands, even though the seer is no longer the actioner', () => {
    const state = nightState({
      roles: BOARD,
      stepId: 'seerCheck',
      overrides: {
        actions: [{ schemaId: 'seerCheck', actorSeat: 2, targetSeat: 0, timestamp: 1 }],
        pendingRevealAcks: ['seerCheck'],
        seerReveal: { targetSeat: 0, result: '狼人' },
      },
    });
    const model = expectKind(resolve(viewAs(state, 2)), 'ackReveal');
    expect(model.title).toBe('查验结果：1号是狼人');
    expect(buildNightCommand(model, { kind: 'ack' }, SCOPE)).toEqual({
      type: 'werewolf.reveal.ack',
    });
    expect(resolve(viewAs(state, 0))).toEqual({ kind: 'idle' });
  });
});

describe('wolfVote', () => {
  const armed = () =>
    nightState({
      roles: BOARD,
      stepId: 'wolfKill',
      overrides: {
        currentNightResults: { wolfVotesBySeat: { '0': 5 } },
        nightStep: { kind: 'inStep', stepId: 'wolfKill', stepDeadline: NOW + 4_200 },
      },
    });

  it('shows votes, the countdown line for a voted wolf and the plain summary for the other', () => {
    const voted = expectKind(resolve(viewAs(armed(), 0)), 'wolfVote');
    expect(voted.myVote).toBe(5);
    expect(voted.statusLine).toBe('1/2 狼人已确认（5秒后确认）');
    expect(voted.emptyVoteLabel).toBe('放弃袭击');
    expect(voted.voteConfirmTemplate).toBe('1号狼人，确定袭击{seat}吗？');

    const pending = expectKind(resolve(viewAs(armed(), 1)), 'wolfVote');
    expect(pending.myVote).toBeNull();
    expect(pending.statusLine).toBe('1/2 狼人已确认');
  });

  it('offers the change hint once the countdown passed', () => {
    const model = expectKind(resolve(viewAs(armed(), 0), { nowMs: NOW + 9_000 }), 'wolfVote');
    expect(model.statusLine).toBe('1/2 狼人已确认（可点击改票或取消）');
  });

  it('maps seat, empty and withdraw confirmations to the wire inputs', () => {
    const model = expectKind(resolve(viewAs(armed(), 0)), 'wolfVote');
    expect(buildNightCommand(model, { kind: 'seat', seat: 4 }, SCOPE)).toMatchObject({
      input: { kind: 'target', target: 4 },
    });
    expect(buildNightCommand(model, { kind: 'emptyVote' }, SCOPE)).toMatchObject({
      input: { kind: 'target', target: null },
    });
    expect(buildNightCommand(model, { kind: 'withdrawVote' }, SCOPE)).toMatchObject({
      input: { kind: 'target', target: WOLF_VOTE_WITHDRAW_TARGET },
    });
    const unvoted = expectKind(resolve(viewAs(armed(), 1)), 'wolfVote');
    expect(() => buildNightCommand(unvoted, { kind: 'withdrawVote' }, SCOPE)).toThrow(
      '[FAIL-FAST]',
    );
  });

  it('restricts to an empty vote under the kill-disabled hint and renders the hint as the message', () => {
    const state = nightState({
      roles: BOARD,
      stepId: 'wolfKill',
      overrides: {
        ui: {
          currentActorHint: {
            kind: 'wolf_kill_disabled',
            targetRoleIds: ['wolf'],
            message: '今晚狼人无法袭击',
            bottomAction: 'wolfEmptyOnly',
          },
        },
      },
    });
    const vm = viewAs(state, 0);
    const model = expectKind(resolve(vm), 'wolfVote');
    expect(model.emptyVoteOnly).toBe(true);
    expect(model.emptyVoteLabel).toBe('确认放弃袭击');
    expect(renderActionerMessage(model, vm)).toBe('今晚狼人无法袭击');
    expect(() => buildNightCommand(model, { kind: 'seat', seat: 4 }, SCOPE)).toThrow('[FAIL-FAST]');
  });

  it('builds the bottom message from the plain prompt, status line and wolf warning', () => {
    const state = nightState({
      roles: BOARD,
      stepId: 'wolfKill',
      overrides: {
        ui: {
          currentActorHint: {
            kind: 'wolf_unanimity_required',
            targetRoleIds: ['wolf'],
            message: '狼人必须统一目标',
          },
        },
      },
    });
    const vm = viewAs(state, 0);
    const model = expectKind(resolve(vm), 'wolfVote');
    expect(model.prompt.text).toBe(`${SCHEMAS.wolfKill.ui!.prompt}\n\n⚠️ 狼人必须统一目标`);
    expect(renderActionerMessage(model, vm)).toBe(
      `${SCHEMAS.wolfKill.ui!.prompt}\n0/2 狼人已确认\n⚠️ 狼人必须统一目标`,
    );
  });
});

describe('pickTwoSeats (swap)', () => {
  it('carries the draft first seat and the transient second seat', () => {
    const state = nightState({ roles: MAGICIAN_BOARD, stepId: 'magicianSwap' });
    const model = expectKind(
      resolve(viewAs(state, 5), {
        draft: { firstSwapSeat: 1, multiSelectedSeats: [] },
        swapSecondSeat: 3,
      }),
      'pickTwoSeats',
    );
    expect(model.pick).toEqual({ first: 1, second: 3 });
    expect(model.firstPickTemplate).toContain('{seat}');
    expect(model.skipLabel).toBe('不用技能');
    expect(buildNightCommand(model, { kind: 'seats', seats: [1, 3] }, SCOPE)).toMatchObject({
      input: { kind: 'multiTarget', targets: [1, 3] },
    });
    expect(() => buildNightCommand(model, { kind: 'seats', seats: [1] }, SCOPE)).toThrow(
      '[FAIL-FAST]',
    );
  });
});

describe('witch (compound)', () => {
  const witchStep = (witchContext: { killedSeat: number; canSave: boolean; canPoison: boolean }) =>
    nightState({ roles: BOARD, stepId: 'witchAction', overrides: { witchContext } });

  it('renders the antidote dialog and allows save / poison / skip', () => {
    const model = expectKind(
      resolve(viewAs(witchStep({ killedSeat: 4, canSave: true, canPoison: true }), 3)),
      'witch',
    );
    expect(model.prompt.text).toContain('5号');
    expect(model.saveLabel).toBe('对5号用解药');
    expect(model.skipLabel).toBe('不用技能');
    expect(buildNightCommand(model, { kind: 'save' }, SCOPE)).toMatchObject({
      input: { kind: 'witch', saveTarget: 4, poisonTarget: null },
    });
    expect(buildNightCommand(model, { kind: 'poison', seat: 0 }, SCOPE)).toMatchObject({
      input: { kind: 'witch', saveTarget: null, poisonTarget: 0 },
    });
    expect(buildNightCommand(model, { kind: 'skip' }, SCOPE)).toMatchObject({
      input: { kind: 'skip' },
    });
  });

  it('shows the cannot-save prompt and refuses a save when the witch was killed', () => {
    const model = expectKind(
      resolve(viewAs(witchStep({ killedSeat: 3, canSave: false, canPoison: true }), 3)),
      'witch',
    );
    expect(model.canSave).toBe(false);
    const saveStep = schemaOfKind('witchAction', 'compound').steps.find(
      (step) => step.key === 'save',
    );
    expect(model.prompt.text).toBe(saveStep!.ui!.cannotSavePrompt);
    expect(() => buildNightCommand(model, { kind: 'save' }, SCOPE)).toThrow('[FAIL-FAST]');
  });

  it('uses the empty-kill title when nobody was attacked', () => {
    const model = expectKind(
      resolve(viewAs(witchStep({ killedSeat: -1, canSave: true, canPoison: true }), 3)),
      'witch',
    );
    expect(model.killedSeat).toBeNull();
    expect(model.canSave).toBe(false);
    expect(model.prompt.title).toBe(SCHEMAS.witchAction.ui!.emptyKillTitle);
  });
});

describe('confirmStatus (hunter)', () => {
  it('renders the shoot dialog from the confirm status', () => {
    const state = nightState({
      roles: BOARD,
      stepId: 'hunterConfirm',
      overrides: { confirmStatus: { role: 'hunter', canShoot: true } },
    });
    const model = expectKind(resolve(viewAs(state, 4)), 'confirmStatus');
    expect(model.dialog.title).toBe(SCHEMAS.hunterConfirm.ui!.confirmStatusUi!.statusDialogTitle);
    expect(model.buttonLabel).toBe('发动状态');
    expect(buildNightCommand(model, { kind: 'confirm' }, SCOPE)).toMatchObject({
      input: { kind: 'confirm' },
    });
  });
});

describe('nightmare block is not pre-judged (the server rejects)', () => {
  it('keeps the blocked seer a normal pickSeat actioner', () => {
    const state = nightState({
      roles: BOARD,
      stepId: 'seerCheck',
      overrides: { nightmareBlockedSeat: 2 },
    });
    const model = expectKind(resolve(viewAs(state, 2)), 'pickSeat');
    expect(model.selectable).toContain(0);
    expect(model.skipLabel).toBe('不用技能');
  });

  it('keeps a wolf-kill-immune seat selectable and only annotates it', () => {
    const roles: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'spiritKnight'];
    const state = nightState({ roles, stepId: 'wolfKill' });
    const model = expectKind(resolve(viewAs(state, 0)), 'wolfVote');
    expect(model.selectable).toContain(5);
    expect(model.immuneSeats).toEqual([5]);
  });

  it('keeps the blocked wolf on the normal empty-vote label', () => {
    const state = nightState({
      roles: BOARD,
      stepId: 'wolfKill',
      overrides: { nightmareBlockedSeat: 0 },
    });
    const model = expectKind(resolve(viewAs(state, 0)), 'wolfVote');
    expect(model.emptyVoteOnly).toBe(false);
    expect(model.emptyVoteLabel).toBe(SCHEMAS.wolfKill.ui!.emptyVoteText);
  });
});

describe('confirmStatus variants', () => {
  it('hunter seat taps are not an action: the model lists no selectable seats', () => {
    const state = nightState({
      roles: BOARD,
      stepId: 'hunterConfirm',
      overrides: { confirmStatus: { role: 'hunter', canShoot: false } },
    });
    const model = expectKind(resolve(viewAs(state, 4)), 'confirmStatus');
    expect(model.skipLabel).toBeNull();
    expect(model.isUnavailable).toBe(false);
    const statusUi = SCHEMAS.hunterConfirm.ui!.confirmStatusUi!;
    if (statusUi.kind !== 'shoot') throw new Error('hunterConfirm is a shoot status');
    expect(model.dialog.text).toBe(statusUi.cannotText);
  });

  it('seed wolf with a target offers infect or decline; without a target only acknowledges', () => {
    const roles: readonly RoleId[] = ['seedWolf', 'wolf', 'seer', 'witch', 'hunter', 'villager'];
    const withTarget = nightState({
      roles,
      stepId: 'seedWolfInfect',
      overrides: {
        confirmStatus: { role: 'seedWolf', availability: 'available', targetSeat: 5 },
      },
    });
    const available = expectKind(resolve(viewAs(withTarget, 0)), 'confirmStatus');
    const infectUi = SCHEMAS.seedWolfInfect.ui!.confirmStatusUi!;
    if (infectUi.kind !== 'infection') throw new Error('seedWolfInfect is an infection status');
    expect(available.skipLabel).toBe(infectUi.skipButtonText);
    expect(available.dialog.text).toContain('6号');
    expect(buildNightCommand(available, { kind: 'skip' }, SCOPE)).toMatchObject({
      input: { kind: 'skip' },
    });

    const noTarget = nightState({
      roles,
      stepId: 'seedWolfInfect',
      overrides: {
        confirmStatus: { role: 'seedWolf', availability: 'unavailable', reason: 'noTarget' },
      },
    });
    const unavailable = expectKind(resolve(viewAs(noTarget, 0)), 'confirmStatus');
    expect(unavailable.isUnavailable).toBe(true);
    expect(unavailable.skipLabel).toBeNull();
  });
});

describe('wolf robot hunter gate', () => {
  const roles: readonly RoleId[] = ['wolfRobot', 'wolf', 'seer', 'witch', 'hunter', 'villager'];
  const learned = (learnedRoleId: RoleId, extra: Partial<GameState> = {}) =>
    nightState({
      roles,
      stepId: 'wolfRobotLearn',
      overrides: {
        actions: [{ schemaId: 'wolfRobotLearn', actorSeat: 0, targetSeat: 4, timestamp: 1 }],
        wolfRobotReveal: {
          targetSeat: 4,
          result: '猎人',
          learnedRoleId,
          canShootAsHunter: learnedRoleId === 'hunter' ? true : undefined,
        },
        wolfRobotHunterStatusViewed: learnedRoleId === 'hunter' ? false : undefined,
        ...extra,
      },
    });

  it('gates on the learned hunter status with the schema copy', () => {
    const model = expectKind(resolve(viewAs(learned('hunter'), 0)), 'ackHunterStatus');
    expect(model.canShoot).toBe(true);
    expect(model.buttonLabel).toBe(SCHEMAS.wolfRobotLearn.ui!.hunterGateButtonText);
    expect(model.dialog.text).toBe(SCHEMAS.wolfRobotLearn.ui!.hunterGateCanShootText);
    expect(buildNightCommand(model, { kind: 'ack' }, SCOPE)).toEqual({
      type: 'werewolf.wolfRobot.ackHunterStatus',
    });
  });

  it('renders the poisoned (cannot shoot) variant', () => {
    const state = learned('hunter', {
      wolfRobotReveal: {
        targetSeat: 4,
        result: '猎人',
        learnedRoleId: 'hunter',
        canShootAsHunter: false,
      },
    });
    const model = expectKind(resolve(viewAs(state, 0)), 'ackHunterStatus');
    expect(model.canShoot).toBe(false);
    expect(model.dialog.text).toBe(SCHEMAS.wolfRobotLearn.ui!.hunterGateCannotShootText);
  });

  it('is idle once viewed, and when a non-hunter role was learned', () => {
    expect(resolve(viewAs(learned('hunter', { wolfRobotHunterStatusViewed: true }), 0))).toEqual({
      kind: 'idle',
    });
    expect(resolve(viewAs(learned('seer'), 0))).toEqual({ kind: 'idle' });
  });

  it('before learning, the robot picks a seat like any check', () => {
    const state = nightState({ roles, stepId: 'wolfRobotLearn' });
    expectKind(resolve(viewAs(state, 0)), 'pickSeat');
  });
});

describe('skip availability follows schema.canSkip', () => {
  it('hides the skip when the chooseSeat schema cannot be skipped', () => {
    const roles: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'wildChild', 'hunter', 'villager'];
    const state = nightState({ roles, stepId: 'wildChildChooseIdol' });
    const model = expectKind(resolve(viewAs(state, 3)), 'pickSeat');
    expect(schemaOfKind('wildChildChooseIdol', 'chooseSeat').canSkip).toBe(false);
    expect(model.skipLabel).toBeNull();
  });
});

describe('multiSelect (multiChooseSeat)', () => {
  const roles: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'cupid', 'hunter', 'villager'];

  it('carries the draft set, the max and the count-templated confirm label', () => {
    const state = nightState({ roles, stepId: 'cupidChooseLovers' });
    const model = expectKind(
      resolve(viewAs(state, 3), { draft: { firstSwapSeat: null, multiSelectedSeats: [0, 5] } }),
      'multiSelect',
    );
    expect(model.selected).toEqual([0, 5]);
    expect(model.max).toBe(schemaOfKind('cupidChooseLovers', 'multiChooseSeat').maxTargets);
    expect(model.confirmButtonTemplate).toContain('{count}');
    expect(buildNightCommand(model, { kind: 'seats', seats: [0, 5] }, SCOPE)).toMatchObject({
      input: { kind: 'multiTarget', targets: [0, 5] },
    });
  });
});

describe('ackGroupReveal (groupConfirm)', () => {
  const roles: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'cupid', 'hunter', 'villager'];

  it('personalizes the lovers reveal and carries the step prompt for the auto dialog', () => {
    const state = nightState({
      roles,
      stepId: 'cupidLoversReveal',
      overrides: { loverSeats: [0, 5] },
    });
    const lover = expectKind(resolve(viewAs(state, 0)), 'ackGroupReveal');
    expect(lover.text.title).toBe('情侣信息');
    expect(lover.text.text).toContain('6号');
    expect(lover.prompt.text).toBe(SCHEMAS.cupidLoversReveal.ui!.prompt);
    expect(lover.hasAcked).toBe(false);
    expect(buildNightCommand(lover, { kind: 'ack' }, SCOPE)).toEqual({
      type: 'werewolf.groupConfirm.ack',
    });
    const bystander = expectKind(resolve(viewAs(state, 2)), 'ackGroupReveal');
    expect(bystander.text.text).toBe(
      schemaOfKind('cupidLoversReveal', 'groupConfirm').ui!.notLoverText,
    );
  });
});

describe('chooseCard', () => {
  it('exposes the engine legality per card and the open label', () => {
    const roles: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'thief', 'hunter', 'villager'];
    const state = nightState({
      roles,
      stepId: 'thiefChoose',
      overrides: { bottomCards: ['wolf', 'villager'] },
    });
    const model = expectKind(resolve(viewAs(state, 3)), 'chooseCard');
    expect(model.choice.cards.map((card) => card.isSelectable)).toEqual([true, false]);
    expect(model.openLabel).toBe(SCHEMAS.thiefChoose.ui!.bottomActionText);
    expect(buildNightCommand(model, { kind: 'card', cardIndex: 0 }, SCOPE)).toMatchObject({
      input: { kind: 'card', cardIndex: 0 },
    });
  });
});
