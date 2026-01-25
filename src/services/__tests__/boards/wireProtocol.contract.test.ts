/**
 * Wire Protocol Contract Tests
 *
 * 验证 wire protocol 正确性：
 * - magician swap: target=null + extra.targets
 * - witch: target=null + extra.stepResults
 *
 * 方案 A：运行态抓包 - 捕获 harness 真实发送的 payload
 */

import { SCHEMAS, NIGHT_STEPS } from '../../../models/roles/spec';
import { createHostGame, cleanupHostGame } from './hostGameFactory';
import { executeFullNight } from './stepByStepRunner';
import { RoleId } from '../../../models/roles';

// ACTION message 类型
interface ActionMessage {
  type: 'ACTION';
  seat: number;
  role: RoleId;
  target: number | null;
  extra?: { targets?: number[]; stepResults?: unknown; confirmed?: boolean };
}

describe('Wire Protocol Contract', () => {
  afterEach(() => {
    cleanupHostGame();
  });

  describe('Schema Kind Validation', () => {
    it('magicianSwap schema 应该是 swap 类型', () => {
      const schema = SCHEMAS['magicianSwap'];
      expect(schema).toBeDefined();
      expect(schema.kind).toBe('swap');
    });

    it('witchAction schema 应该是 compound 类型', () => {
      const schema = SCHEMAS['witchAction'];
      expect(schema).toBeDefined();
      expect(schema.kind).toBe('compound');
    });

    it('witchAction 应该有 save 和 poison 两个子步骤', () => {
      const schema = SCHEMAS['witchAction'];
      expect(schema.kind).toBe('compound');
      if (schema.kind === 'compound') {
        expect(schema.steps).toBeDefined();
        expect(schema.steps.length).toBe(2);
        
        const stepKeys = schema.steps.map((s) => s.key);
        expect(stepKeys).toContain('save');
        expect(stepKeys).toContain('poison');
      }
    });

    it('wolfKill schema 应该是 wolfVote 类型', () => {
      const schema = SCHEMAS['wolfKill'];
      expect(schema).toBeDefined();
      expect(schema.kind).toBe('wolfVote');
    });

    it('所有 NIGHT_STEPS 的 schemaId 都在 SCHEMAS 中存在', () => {
      for (const step of NIGHT_STEPS) {
        const schema = SCHEMAS[step.id];
        expect(schema).toBeDefined();
        expect(schema.kind).toBeDefined();
      }
    });

    it('所有 chooseSeat 类型 schema 应该有 constraints 数组', () => {
      const chooseSeatSchemas = Object.entries(SCHEMAS).filter(
        ([, schema]) => schema.kind === 'chooseSeat',
      );
      expect(chooseSeatSchemas.length).toBeGreaterThan(0);

      for (const [, schema] of chooseSeatSchemas) {
        expect(schema.kind).toBe('chooseSeat');
        if (schema.kind === 'chooseSeat') {
          expect(Array.isArray(schema.constraints)).toBe(true);
        }
      }
    });
  });

  describe('Runtime Payload Shape - Harness 运行态抓包', () => {
    // 12人狼王魔术师板子：含 magician(swap) + witch(compound)
    const TEMPLATE_ROLES: RoleId[] = [
      'villager', 'villager', 'villager', 'villager',
      'wolf', 'wolf', 'wolf', 'darkWolfKing',
      'seer', 'witch', 'hunter', 'magician',
    ];

    function createRoleAssignment(): Map<number, RoleId> {
      const map = new Map<number, RoleId>();
      TEMPLATE_ROLES.forEach((role, idx) => map.set(idx, role));
      return map;
    }

    function findActionMessage(
      captured: ReturnType<ReturnType<typeof createHostGame>['getCapturedMessages']>,
      stepId: string
    ): ActionMessage | undefined {
      const found = captured.find(
        (c) => c.stepId === stepId && c.message.type === 'ACTION'
      );
      if (found && found.message.type === 'ACTION') {
        return found.message as ActionMessage;
      }
      return undefined;
    }

    /**
     * 查找 WOLF_VOTE 消息
     * wolfVote 使用 WOLF_VOTE message type（不是 ACTION）
     */
    function findWolfVoteMessages(
      captured: ReturnType<ReturnType<typeof createHostGame>['getCapturedMessages']>,
      stepId: string
    ): Array<{ seat: number; target: number }> {
      return captured
        .filter((c) => c.stepId === stepId && c.message.type === 'WOLF_VOTE')
        .map((c) => ({
          seat: (c.message as { seat: number }).seat,
          target: (c.message as { target: number }).target,
        }));
    }

    it('magicianSwap payload: target === null, extra.targets 存在且为数组', () => {
      const ctx = createHostGame(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // 运行夜晚：magician 交换 seat 0 和 seat 1
      executeFullNight(ctx, {
        wolf: 2,
        seer: 4,
        witch: { save: null, poison: null },
        
        magician: { targets: [0, 1] },
      });

      const captured = ctx.getCapturedMessages();
      const magicianMsg = findActionMessage(captured, 'magicianSwap');

      expect(magicianMsg).toBeDefined();
      expect(magicianMsg!.target).toBeNull();
      expect(magicianMsg!.extra).toBeDefined();
      expect(magicianMsg!.extra!.targets).toEqual([0, 1]);
    });

    it('magicianSwap payload: 空交换时 extra.targets 可以是 undefined 或空', () => {
      const ctx = createHostGame(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // 运行夜晚：magician 不交换
      executeFullNight(ctx, {
        wolf: 2,
        seer: 4,
        witch: { save: null, poison: null },
        
        magician: { targets: [] },
      });

      const captured = ctx.getCapturedMessages();
      const magicianMsg = findActionMessage(captured, 'magicianSwap');

      expect(magicianMsg).toBeDefined();
      expect(magicianMsg!.target).toBeNull();
      // 空 targets 时 extra 可以是 undefined 或 { targets: [] }
      if (magicianMsg!.extra !== undefined) {
        expect(
          magicianMsg!.extra.targets === undefined ||
          (Array.isArray(magicianMsg!.extra.targets) && 
           magicianMsg!.extra.targets.length === 0)
        ).toBe(true);
      }
    });

    it('witchAction payload: target === null, extra.stepResults 含 save 和 poison', () => {
      const ctx = createHostGame(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // 运行夜晚：witch 救人
      executeFullNight(ctx, {
        wolf: 0,
        seer: 4,
        witch: { save: 0, poison: null },
        
        magician: { targets: [] },
      });

      const captured = ctx.getCapturedMessages();
      const witchMsg = findActionMessage(captured, 'witchAction');

      expect(witchMsg).toBeDefined();
      expect(witchMsg!.target).toBeNull();
      expect(witchMsg!.extra).toBeDefined();
      
      const stepResults = witchMsg!.extra!.stepResults as { save: number | null; poison: number | null };
      expect(stepResults).toBeDefined();
      // 必须有 save 和 poison 两个 key（即使值为 null）
      expect('save' in stepResults).toBe(true);
      expect('poison' in stepResults).toBe(true);
      expect(stepResults.save).toBe(0);
      expect(stepResults.poison).toBeNull();
    });

    it('witchAction payload: poison 场景', () => {
      const ctx = createHostGame(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // 运行夜晚：witch 毒人
      executeFullNight(ctx, {
        wolf: 0,
        seer: 4,
        witch: { save: null, poison: 2 },
        
        magician: { targets: [] },
      });

      const captured = ctx.getCapturedMessages();
      const witchMsg = findActionMessage(captured, 'witchAction');

      expect(witchMsg).toBeDefined();
      expect(witchMsg!.target).toBeNull();
      expect(witchMsg!.extra).toBeDefined();
      
      const stepResults = witchMsg!.extra!.stepResults as { save: number | null; poison: number | null };
      expect(stepResults).toBeDefined();
      expect('save' in stepResults).toBe(true);
      expect('poison' in stepResults).toBe(true);
      expect(stepResults.save).toBeNull();
      expect(stepResults.poison).toBe(2);
    });

    it('witchAction payload: 不使用技能时 stepResults 仍需包含 save 和 poison', () => {
      const ctx = createHostGame(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // 运行夜晚：witch 不使用技能
      executeFullNight(ctx, {
        wolf: 0,
        seer: 4,
        witch: { save: null, poison: null },
        
        magician: { targets: [] },
      });

      const captured = ctx.getCapturedMessages();
      const witchMsg = findActionMessage(captured, 'witchAction');

      expect(witchMsg).toBeDefined();
      expect(witchMsg!.target).toBeNull();
      expect(witchMsg!.extra).toBeDefined();
      
      const stepResults = witchMsg!.extra!.stepResults as { save: number | null; poison: number | null };
      expect(stepResults).toBeDefined();
      // 即使不使用技能，也必须有 save 和 poison 两个 key
      expect('save' in stepResults).toBe(true);
      expect('poison' in stepResults).toBe(true);
    });

    it('hunterConfirm payload: target === null, extra.confirmed === true', () => {
      const ctx = createHostGame(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      executeFullNight(ctx, {
        wolf: 0,
        seer: 4,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        magician: { targets: [] },
      });

      const captured = ctx.getCapturedMessages();
      const hunterMsg = findActionMessage(captured, 'hunterConfirm');

      expect(hunterMsg).toBeDefined();
      expect(hunterMsg!.target).toBeNull();
      expect(hunterMsg!.extra).toBeDefined();
      expect(hunterMsg!.extra!.confirmed).toBe(true);
    });

    // NOTE: 由于系统不允许未被 block 时 skip hunterConfirm，
    // 此处不再测试 "skip 时 confirmed === false" 场景。
    // 如需测试 "被 block 时的 skip"，需要配置 nightmare block hunter 的模板。

    it('darkWolfKingConfirm payload: target === null, extra.confirmed', () => {
      const ctx = createHostGame(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      executeFullNight(ctx, {
        wolf: 0,
        darkWolfKing: { confirmed: true },
        seer: 4,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        magician: { targets: [] },
      });

      const captured = ctx.getCapturedMessages();
      const darkWolfKingMsg = findActionMessage(captured, 'darkWolfKingConfirm');

      expect(darkWolfKingMsg).toBeDefined();
      expect(darkWolfKingMsg!.target).toBeNull();
      expect(darkWolfKingMsg!.extra).toBeDefined();
      expect(darkWolfKingMsg!.extra!.confirmed).toBe(true);
    });

    it('wolfKill 步骤：所有参与狼发送 WOLF_VOTE 消息，target 是单一座位号', () => {
      const ctx = createHostGame(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // 运行夜晚：狼刀座位 2
      executeFullNight(ctx, {
        wolf: 2,
        seer: 4,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        magician: { targets: [] },
      });

      const captured = ctx.getCapturedMessages();
      const wolfVotes = findWolfVoteMessages(captured, 'wolfKill');

      // 应该有 4 个狼（wolf x3 + darkWolfKing）发送 WOLF_VOTE
      expect(wolfVotes.length).toBe(4);

      // 所有 WOLF_VOTE 的 target 都应该是 2
      for (const vote of wolfVotes) {
        expect(vote.target).toBe(2);
        // target 是单一座位号，不是 encoded 值
        expect(vote.target).toBeLessThan(100);
        expect(vote.target).toBeGreaterThanOrEqual(-1);
      }

      // wolfKill 步骤结束后还会发送一个 ACTION 消息（lead wolf 提交）
      const wolfKillAction = findActionMessage(captured, 'wolfKill');
      expect(wolfKillAction).toBeDefined();
      expect(wolfKillAction!.target).toBe(2);
    });

    it('wolfKill 步骤：空刀时 target === null（或不发 WOLF_VOTE）', () => {
      const ctx = createHostGame(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // 运行夜晚：狼空刀（target 为 null）
      executeFullNight(ctx, {
        wolf: null, // 空刀
        seer: 4,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        magician: { targets: [] },
      });

      const captured = ctx.getCapturedMessages();
      const wolfVotes = findWolfVoteMessages(captured, 'wolfKill');

      // 空刀时不应该发送 WOLF_VOTE（或者发送 target=-1）
      // 当前实现是不发送 WOLF_VOTE
      expect(wolfVotes.length).toBe(0);

      // 但 ACTION 消息应该存在，target 为 null
      const wolfKillAction = findActionMessage(captured, 'wolfKill');
      expect(wolfKillAction).toBeDefined();
      expect(wolfKillAction!.target).toBeNull();
    });
  });

  describe('Anti-Regression: 禁止 encoded-target 协议', () => {
    it('所有 ACTION 消息的 target 不得使用 encoded-target (firstSeat + secondSeat * 100)', () => {
      const TEMPLATE_ROLES: RoleId[] = [
        'villager', 'villager', 'villager', 'villager',
        'wolf', 'wolf', 'wolf', 'darkWolfKing',
        'seer', 'witch', 'hunter', 'magician',
      ];
      const assignment = new Map<number, RoleId>();
      TEMPLATE_ROLES.forEach((role, idx) => assignment.set(idx, role));

      const ctx = createHostGame(TEMPLATE_ROLES, assignment);
      ctx.clearCapturedMessages();

      executeFullNight(ctx, {
        wolf: 0,
        seer: 4,
        witch: { save: null, poison: null },
        
        magician: { targets: [0, 1] },
      });

      const captured = ctx.getCapturedMessages();
      const actionMessages = captured.filter((c) => c.message.type === 'ACTION');

      for (const msg of actionMessages) {
        const actionMsg = msg.message as ActionMessage;
        const target = actionMsg.target;
        // target 要么是 null，要么是单一座位号（0-11），不能是 encoded 值（如 100+）
        if (target !== null && target !== undefined) {
          expect(target).toBeLessThan(100);
          expect(target).toBeGreaterThanOrEqual(-1); // -1 表示放弃
        }
      }
    });
  });

  describe('chooseSeat Wire Protocol Contract', () => {
    /**
     * chooseSeat 类 schema 的 wire protocol 合约：
     * - target: number | null（单一座位号或 null 表示跳过）
     * - 不使用 extra 字段（extra 仅用于 compound/swap/confirm）
     */

    // 简化模板：只包含 seer 和 wolf
    const SEER_TEMPLATE: RoleId[] = ['seer', 'wolf', 'villager', 'villager'];

    /** 辅助函数：推进到 seerCheck 步骤 */
    function advanceToSeerCheck(ctx: ReturnType<typeof createHostGame>): void {
      // 第一步是 wolfKill
      if (ctx.getBroadcastState().currentStepId === 'wolfKill') {
        // 狼空刀
        ctx.sendPlayerMessage({
          type: 'WOLF_VOTE',
          seat: 1,
          target: -1,
        });
        ctx.sendPlayerMessage({
          type: 'ACTION',
          seat: 1,
          role: 'wolf',
          target: null,
        });
        ctx.advanceNight();
      }
    }

    it('seerCheck: target 是单一座位号', () => {
      const assignment = new Map<number, RoleId>();
      SEER_TEMPLATE.forEach((role, idx) => assignment.set(idx, role));

      const ctx = createHostGame(SEER_TEMPLATE, assignment);
      
      // 推进到 seerCheck
      advanceToSeerCheck(ctx);
      expect(ctx.getBroadcastState().currentStepId).toBe('seerCheck');
      
      ctx.clearCapturedMessages();

      // seer 查验 seat 1
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'seer',
        target: 1,
      });

      const captured = ctx.getCapturedMessages();
      const seerMsg = captured.find(
        (c) => c.stepId === 'seerCheck' && c.message.type === 'ACTION',
      );

      expect(seerMsg).toBeDefined();
      const msg = seerMsg!.message as ActionMessage;
      expect(msg.target).toBe(1);
      // 不使用 extra
      expect(msg.extra?.targets).toBeUndefined();
      expect(msg.extra?.stepResults).toBeUndefined();
    });

    it('seerCheck skip: target=null', () => {
      const assignment = new Map<number, RoleId>();
      SEER_TEMPLATE.forEach((role, idx) => assignment.set(idx, role));

      const ctx = createHostGame(SEER_TEMPLATE, assignment);
      
      // 推进到 seerCheck
      advanceToSeerCheck(ctx);
      
      ctx.clearCapturedMessages();

      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'seer',
        target: null,
      });

      const captured = ctx.getCapturedMessages();
      const seerMsg = captured.find(
        (c) => c.stepId === 'seerCheck' && c.message.type === 'ACTION',
      );

      expect(seerMsg).toBeDefined();
      const msg = seerMsg!.message as ActionMessage;
      expect(msg.target).toBeNull();
    });

    it('guardProtect: target 是单一座位号', () => {
      // 需要包含 guard 的模板
      const GUARD_TEMPLATE: RoleId[] = ['guard', 'wolf', 'villager', 'villager'];
      const assignment = new Map<number, RoleId>();
      GUARD_TEMPLATE.forEach((role, idx) => assignment.set(idx, role));

      const ctx = createHostGame(GUARD_TEMPLATE, assignment);

      // 找到 guardProtect 步骤
      while (ctx.getBroadcastState().currentStepId !== 'guardProtect') {
        const result = ctx.advanceNight();
        if (!result.success) break;
      }

      if (ctx.getBroadcastState().currentStepId === 'guardProtect') {
        ctx.clearCapturedMessages();

        ctx.sendPlayerMessage({
          type: 'ACTION',
          seat: 0,
          role: 'guard',
          target: 1,
        });

        const captured = ctx.getCapturedMessages();
        const guardMsg = captured.find(
          (c) => c.stepId === 'guardProtect' && c.message.type === 'ACTION',
        );

        expect(guardMsg).toBeDefined();
        const msg = guardMsg!.message as ActionMessage;
        expect(msg.target).toBe(1);
        expect(msg.extra?.targets).toBeUndefined();
        expect(msg.extra?.stepResults).toBeUndefined();
      }
    });

    it('chooseSeat payload 禁止使用 encoded-target', () => {
      const assignment = new Map<number, RoleId>();
      SEER_TEMPLATE.forEach((role, idx) => assignment.set(idx, role));

      const ctx = createHostGame(SEER_TEMPLATE, assignment);
      ctx.clearCapturedMessages();

      executeFullNight(ctx, { seer: 2, wolf: null });

      const captured = ctx.getCapturedMessages();
      const chooseSeatMessages = captured.filter(
        (c) =>
          c.message.type === 'ACTION' &&
          c.stepId &&
          SCHEMAS[c.stepId]?.kind === 'chooseSeat',
      );

      for (const msg of chooseSeatMessages) {
        const actionMsg = msg.message as ActionMessage;
        if (actionMsg.target !== null) {
          // target 必须是单一座位号，不是 encoded 值
          expect(actionMsg.target).toBeLessThan(100);
          expect(actionMsg.target).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });
});
