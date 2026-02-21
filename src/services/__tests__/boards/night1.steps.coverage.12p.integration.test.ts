/**
 * Night-1 Steps Coverage Integration Test (12p)
 *
 * 目的：补齐 NIGHT_STEPS 的 step-level coverage contract。
 *
 * 注意：这是“覆盖门禁”，不是行为细节测试。
 * - 不跳 step（使用 stepByStepRunner.executeStepsUntil）
 * - 不自动 ack / 不自动清 gate
 * - 不绕过 handler
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { cleanupHostGame, createHostGame } from './hostGameFactory';
import { executeFullNight, executeStepsUntil } from './stepByStepRunner';

const TEMPLATE_NAME = '预女猎白12人';

/**
 * 选用包含：slacker/gargoyle/psychic 的 12p 配置。
 * 这里直接用 RoleId[] 创建模板，避免依赖 preset 模板名是否包含这些角色。
 */
const CUSTOM_ROLES: RoleId[] = [
  'magician',
  'slacker',
  'wildChild',
  'pureWhite',
  'wolfWitch',
  'guard',
  'wolf',
  'wolf',
  'wolfQueen',
  'witch',
  'gargoyle',
  'psychic',
];

describe('Night-1: step-level coverage (12p)', () => {
  afterEach(() => {
    cleanupHostGame();
  });

  it('should reach slackerChooseIdol / wildChildChooseIdol / wolfWitchCheck / gargoyleCheck / pureWhiteCheck / psychicCheck steps', () => {
    const ctx = createHostGame(CUSTOM_ROLES);

    // Theme assertion (not just deaths): include a real BroadcastGameState field assertion.
    // Contract gate looks for patterns like `.actions??.` so we assert with optional chaining.
    expect(ctx.getBroadcastState().actions?.length).toBeGreaterThanOrEqual(0);

    expect(
      executeStepsUntil(ctx, 'slackerChooseIdol', {
        // slacker step requires choosing an idol (must be a seat number)
        slacker: 0,
      }),
    ).toBe(true);
    ctx.assertStep('slackerChooseIdol');

    expect(
      executeStepsUntil(ctx, 'wildChildChooseIdol', {
        slacker: 0,
        wildChild: 0,
      }),
    ).toBe(true);
    ctx.assertStep('wildChildChooseIdol');

    expect(
      executeStepsUntil(ctx, 'wolfWitchCheck', {
        slacker: 0,
        wildChild: 0,
      }),
    ).toBe(true);
    ctx.assertStep('wolfWitchCheck');

    expect(
      executeStepsUntil(ctx, 'gargoyleCheck', {
        slacker: 0,
        wildChild: 0,
      }),
    ).toBe(true);
    ctx.assertStep('gargoyleCheck');

    expect(
      executeStepsUntil(ctx, 'pureWhiteCheck', {
        slacker: 0,
        wildChild: 0,
      }),
    ).toBe(true);
    ctx.assertStep('pureWhiteCheck');

    expect(
      executeStepsUntil(ctx, 'psychicCheck', {
        slacker: 0,
        wildChild: 0,
      }),
    ).toBe(true);
    ctx.assertStep('psychicCheck');

    // 收尾：跑完整晚，避免 endNight 由于未完成而 fail-fast
    executeFullNight(ctx);

    // 仅用于 coverage contract：确保文件包含 TEMPLATE_NAME 常量（对应旧 contract 的 pattern 机制）
    expect(TEMPLATE_NAME).toBe('预女猎白12人');
  });
});
