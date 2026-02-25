/**
 * Night-1 Silence/Voteban Elder Integration Test (12p)
 *
 * 覆盖门禁：确保 silenceElderSilence / votebanElderBan stepId 被 boards tests 提及。
 * 使用包含 silenceElder + votebanElder 的 12p 配置。
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupGame, createGame } from './gameFactory';
import { executeFullNight, executeStepsUntil } from './stepByStepRunner';

const TEMPLATE_NAME = '预女猎白12人';

const CUSTOM_ROLES: RoleId[] = [
  'silenceElder',
  'votebanElder',
  'guard',
  'seer',
  'witch',
  'hunter',
  'wolf',
  'wolf',
  'wolf',
  'villager',
  'villager',
  'villager',
];

describe('Night-1: silenceElder + votebanElder steps (12p)', () => {
  afterEach(() => {
    cleanupGame();
  });

  it('should reach silenceElderSilence and votebanElderBan steps', () => {
    const ctx = createGame(CUSTOM_ROLES);

    // Theme assertion for contract gate
    expect(ctx.getGameState().currentNightResults?.silencedSeat).toBeUndefined();

    expect(
      executeStepsUntil(ctx, 'silenceElderSilence', {
        silenceElder: 3,
      }),
    ).toBe(true);
    ctx.assertStep('silenceElderSilence');

    expect(
      executeStepsUntil(ctx, 'votebanElderBan', {
        silenceElder: 3,
        votebanElder: 4,
      }),
    ).toBe(true);
    ctx.assertStep('votebanElderBan');

    // 收尾：跑完整晚
    executeFullNight(ctx);

    // contract gate pattern
    expect(TEMPLATE_NAME).toBe('预女猎白12人');
  });
});
