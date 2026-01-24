/**
 * V2 Wire Protocol Contract Tests
 *
 * 验证 v2 wire protocol 正确性：
 * - magician swap: target=null + extra.targets
 * - witch: target=null + extra.stepResults
 *
 * 方案 A：运行态抓包 - 捕获 harness 真实发送的 payload
 */

import { SCHEMAS, NIGHT_STEPS } from '../../../../models/roles/spec';
import { createHostGameV2 } from './hostGameFactory.v2';
import { RoleId } from '../../../../models/roles';

// ACTION message 类型
interface ActionMessage {
  type: 'ACTION';
  seat: number;
  role: RoleId;
  target: number | null;
  extra?: { targets?: number[]; stepResults?: unknown; confirmed?: boolean };
}

describe('V2 Wire Protocol Contract', () => {
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
      captured: ReturnType<ReturnType<typeof createHostGameV2>['getCapturedMessages']>,
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

    it('magicianSwap payload: target === null, extra.targets 存在且为数组', () => {
      const ctx = createHostGameV2(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // 运行夜晚：magician 交换 seat 0 和 seat 1
      ctx.runNight({
        wolf: 2,
        seer: 4,
        witch: { stepResults: { save: null, poison: null } },
        hunter: null,
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
      const ctx = createHostGameV2(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // 运行夜晚：magician 不交换
      ctx.runNight({
        wolf: 2,
        seer: 4,
        witch: { stepResults: { save: null, poison: null } },
        hunter: null,
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
      const ctx = createHostGameV2(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // 运行夜晚：witch 救人
      ctx.runNight({
        wolf: 0,
        seer: 4,
        witch: { stepResults: { save: 0, poison: null } },
        hunter: null,
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
      const ctx = createHostGameV2(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // 运行夜晚：witch 毒人
      ctx.runNight({
        wolf: 0,
        seer: 4,
        witch: { stepResults: { save: null, poison: 2 } },
        hunter: null,
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
      const ctx = createHostGameV2(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // 运行夜晚：witch 不使用技能
      ctx.runNight({
        wolf: 0,
        seer: 4,
        witch: { stepResults: { save: null, poison: null } },
        hunter: null,
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
      const ctx = createHostGameV2(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      ctx.runNight({
        wolf: 0,
        seer: 4,
        witch: { stepResults: { save: null, poison: null } },
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

    it('hunterConfirm payload: skip 时 confirmed === false', () => {
      const ctx = createHostGameV2(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      ctx.runNight({
        wolf: 0,
        seer: 4,
        witch: { stepResults: { save: null, poison: null } },
        hunter: { confirmed: false },
        magician: { targets: [] },
      });

      const captured = ctx.getCapturedMessages();
      const hunterMsg = findActionMessage(captured, 'hunterConfirm');

      expect(hunterMsg).toBeDefined();
      expect(hunterMsg!.target).toBeNull();
      // skip 时 extra.confirmed 应该是 false
      expect(hunterMsg!.extra?.confirmed).toBe(false);
    });

    it('darkWolfKingConfirm payload: target === null, extra.confirmed', () => {
      const ctx = createHostGameV2(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      ctx.runNight({
        wolf: 0,
        darkWolfKing: { confirmed: true },
        seer: 4,
        witch: { stepResults: { save: null, poison: null } },
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

      const ctx = createHostGameV2(TEMPLATE_ROLES, assignment);
      ctx.clearCapturedMessages();

      ctx.runNight({
        wolf: 0,
        seer: 4,
        witch: { stepResults: { save: null, poison: null } },
        hunter: null,
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
});
