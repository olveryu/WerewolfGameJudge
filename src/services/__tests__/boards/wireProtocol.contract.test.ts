/**
 * Wire Protocol Contract Tests
 *
 * Verify wire protocol correctness:
 * - magician swap: target=null + extra.targets
 * - witch: target=null + extra.stepResults
 *
 * Approach A: runtime capture - capture the payload actually sent by the harness
 */

import { type RoleId } from '@werewolf/game-engine/models/roles';
import { NIGHT_STEPS, SCHEMAS } from '@werewolf/game-engine/models/roles/spec';

import { cleanupGame, createGame } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';

// ACTION message type
interface ActionMessage {
  type: 'ACTION';
  seat: number;
  role: RoleId;
  target: number | null;
  extra?: { targets?: number[]; stepResults?: unknown; confirmed?: boolean };
}

describe('Wire Protocol Contract', () => {
  afterEach(() => {
    cleanupGame();
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
    // 12-player Wolf King + Magician board: includes magician(swap) + witch(compound)
    const TEMPLATE_ROLES: RoleId[] = [
      'villager',
      'villager',
      'villager',
      'villager',
      'wolf',
      'wolf',
      'wolf',
      'darkWolfKing',
      'seer',
      'witch',
      'hunter',
      'magician',
    ];

    function createRoleAssignment(): Map<number, RoleId> {
      const map = new Map<number, RoleId>();
      TEMPLATE_ROLES.forEach((role, idx) => map.set(idx, role));
      return map;
    }

    function findActionMessage(
      captured: ReturnType<ReturnType<typeof createGame>['getCapturedMessages']>,
      stepId: string,
    ): ActionMessage | undefined {
      const found = captured.find((c) => c.stepId === stepId && c.message.type === 'ACTION');
      if (found && found.message.type === 'ACTION') {
        return found.message as ActionMessage;
      }
      return undefined;
    }

    /**
     * Find WOLF_VOTE messages
     * wolfVote uses WOLF_VOTE message type (not ACTION)
     */
    function findWolfVoteMessages(
      captured: ReturnType<ReturnType<typeof createGame>['getCapturedMessages']>,
      stepId: string,
    ): Array<{ seat: number; target: number }> {
      return captured
        .filter((c) => c.stepId === stepId && c.message.type === 'WOLF_VOTE')
        .map((c) => ({
          seat: (c.message as { seat: number }).seat,
          target: (c.message as { target: number }).target,
        }));
    }

    it('magicianSwap payload: target === null, extra.targets 存在且为数组', () => {
      const ctx = createGame(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // Run night: magician swaps seat 0 and seat 1
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
      const ctx = createGame(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // Run night: magician does not swap
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
      // With empty targets, extra may be undefined or { targets: [] }
      if (magicianMsg!.extra !== undefined) {
        expect(
          magicianMsg!.extra.targets === undefined ||
            (Array.isArray(magicianMsg!.extra.targets) && magicianMsg!.extra.targets.length === 0),
        ).toBe(true);
      }
    });

    it('witchAction payload: target === null, extra.stepResults 含 save 和 poison', () => {
      const ctx = createGame(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // Run night: witch saves
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

      const stepResults = witchMsg!.extra!.stepResults as {
        save: number | null;
        poison: number | null;
      };
      expect(stepResults).toBeDefined();
      // Must contain both save and poison keys (even if values are null)
      expect('save' in stepResults).toBe(true);
      expect('poison' in stepResults).toBe(true);
      expect(stepResults.save).toBe(0);
      expect(stepResults.poison).toBeNull();
    });

    it('witchAction payload: poison 场景', () => {
      const ctx = createGame(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // Run night: witch poisons
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

      const stepResults = witchMsg!.extra!.stepResults as {
        save: number | null;
        poison: number | null;
      };
      expect(stepResults).toBeDefined();
      expect('save' in stepResults).toBe(true);
      expect('poison' in stepResults).toBe(true);
      expect(stepResults.save).toBeNull();
      expect(stepResults.poison).toBe(2);
    });

    it('witchAction payload: 不使用技能时 stepResults 仍需包含 save 和 poison', () => {
      const ctx = createGame(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // Run night: witch uses no skill
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

      const stepResults = witchMsg!.extra!.stepResults as {
        save: number | null;
        poison: number | null;
      };
      expect(stepResults).toBeDefined();
      // Even when no skill is used, both save and poison keys must be present
      expect('save' in stepResults).toBe(true);
      expect('poison' in stepResults).toBe(true);
    });

    it('hunterConfirm payload: target === null, extra.confirmed === true', () => {
      const ctx = createGame(TEMPLATE_ROLES, createRoleAssignment());
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

    // NOTE: Since the system does not allow skipping hunterConfirm when not blocked,
    // the "skip when confirmed === false" scenario is no longer tested here.
    // To test "skip when blocked", configure a template with nightmare blocking hunter.

    it('darkWolfKingConfirm payload: target === null, extra.confirmed', () => {
      const ctx = createGame(TEMPLATE_ROLES, createRoleAssignment());
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
      const ctx = createGame(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // Run night: attack seat 2
      executeFullNight(ctx, {
        wolf: 2,
        seer: 4,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        magician: { targets: [] },
      });

      const captured = ctx.getCapturedMessages();
      const wolfVotes = findWolfVoteMessages(captured, 'wolfKill');

      // Should have 4 wolves (wolf x3 + darkWolfKing) sending WOLF_VOTE
      expect(wolfVotes.length).toBe(4);

      // All WOLF_VOTE targets should be 2
      for (const vote of wolfVotes) {
        expect(vote.target).toBe(2);
        // target is a single seat number, not an encoded value
        expect(vote.target).toBeLessThan(100);
        expect(vote.target).toBeGreaterThanOrEqual(-1);
      }

      // After wolfKill step ends, an ACTION message is also sent (lead wolf submission)
      const wolfKillAction = findActionMessage(captured, 'wolfKill');
      expect(wolfKillAction).toBeDefined();
      expect(wolfKillAction!.target).toBe(2);
    });

    it('wolfKill 步骤：放弃袭击时 target === null（或不发 WOLF_VOTE）', () => {
      const ctx = createGame(TEMPLATE_ROLES, createRoleAssignment());
      ctx.clearCapturedMessages();

      // Run night: wolves skip attack (target is null)
      executeFullNight(ctx, {
        wolf: null, // skip attack
        seer: 4,
        witch: { save: null, poison: null },
        hunter: { confirmed: true },
        magician: { targets: [] },
      });

      const captured = ctx.getCapturedMessages();
      const wolfVotes = findWolfVoteMessages(captured, 'wolfKill');

      // Skipping attack should not send WOLF_VOTE (or send target=-1)
      // Current implementation does not send WOLF_VOTE
      expect(wolfVotes.length).toBe(0);

      // But ACTION message should exist with target = null
      const wolfKillAction = findActionMessage(captured, 'wolfKill');
      expect(wolfKillAction).toBeDefined();
      expect(wolfKillAction!.target).toBeNull();
    });
  });

  describe('Anti-Regression: 禁止 encoded-target 协议', () => {
    it('所有 ACTION 消息的 target 不得使用 encoded-target (firstSeat + secondSeat * 100)', () => {
      const TEMPLATE_ROLES: RoleId[] = [
        'villager',
        'villager',
        'villager',
        'villager',
        'wolf',
        'wolf',
        'wolf',
        'darkWolfKing',
        'seer',
        'witch',
        'hunter',
        'magician',
      ];
      const assignment = new Map<number, RoleId>();
      TEMPLATE_ROLES.forEach((role, idx) => assignment.set(idx, role));

      const ctx = createGame(TEMPLATE_ROLES, assignment);
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
        // target must be either null or a single seat number (0-11), not an encoded value (e.g. 100+)
        if (target !== null && target !== undefined) {
          expect(target).toBeLessThan(100);
          expect(target).toBeGreaterThanOrEqual(-1); // -1 means skip
        }
      }
    });
  });

  describe('chooseSeat Wire Protocol Contract', () => {
    /**
     * Wire protocol contract for chooseSeat-kind schemas:
     * - target: number | null (single seat number or null to skip)
     * - extra field not used (extra is only for compound/swap/confirm)
     */

    // Simplified template: only includes seer and wolf
    const SEER_TEMPLATE: RoleId[] = ['seer', 'wolf', 'villager', 'villager'];

    /** Helper: advance to seerCheck step */
    function advanceToSeerCheck(ctx: ReturnType<typeof createGame>): void {
      // First step is wolfKill
      if (ctx.getGameState().currentStepId === 'wolfKill') {
        // Wolves skip attack
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

      const ctx = createGame(SEER_TEMPLATE, assignment);

      // Advance to seerCheck
      advanceToSeerCheck(ctx);
      expect(ctx.getGameState().currentStepId).toBe('seerCheck');

      ctx.clearCapturedMessages();

      // Seer checks seat 1
      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'seer',
        target: 1,
      });

      const captured = ctx.getCapturedMessages();
      const seerMsg = captured.find((c) => c.stepId === 'seerCheck' && c.message.type === 'ACTION');

      expect(seerMsg).toBeDefined();
      const msg = seerMsg!.message as ActionMessage;
      expect(msg.target).toBe(1);
      // No extra fields used
      expect(msg.extra?.targets).toBeUndefined();
      expect(msg.extra?.stepResults).toBeUndefined();
    });

    it('seerCheck skip: target=null', () => {
      const assignment = new Map<number, RoleId>();
      SEER_TEMPLATE.forEach((role, idx) => assignment.set(idx, role));

      const ctx = createGame(SEER_TEMPLATE, assignment);

      // Advance to seerCheck
      advanceToSeerCheck(ctx);

      ctx.clearCapturedMessages();

      ctx.sendPlayerMessage({
        type: 'ACTION',
        seat: 0,
        role: 'seer',
        target: null,
      });

      const captured = ctx.getCapturedMessages();
      const seerMsg = captured.find((c) => c.stepId === 'seerCheck' && c.message.type === 'ACTION');

      expect(seerMsg).toBeDefined();
      const msg = seerMsg!.message as ActionMessage;
      expect(msg.target).toBeNull();
    });

    it('guardProtect: target 是单一座位号', () => {
      // Template must include guard
      const GUARD_TEMPLATE: RoleId[] = ['guard', 'wolf', 'villager', 'villager'];
      const assignment = new Map<number, RoleId>();
      GUARD_TEMPLATE.forEach((role, idx) => assignment.set(idx, role));

      const ctx = createGame(GUARD_TEMPLATE, assignment);

      // Advance to guardProtect step
      while (ctx.getGameState().currentStepId !== 'guardProtect') {
        const result = ctx.advanceNight();
        if (!result.success) break;
      }

      if (ctx.getGameState().currentStepId === 'guardProtect') {
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

      const ctx = createGame(SEER_TEMPLATE, assignment);
      ctx.clearCapturedMessages();

      executeFullNight(ctx, { seer: 2, wolf: null });

      const captured = ctx.getCapturedMessages();
      const chooseSeatMessages = captured.filter(
        (c) => c.message.type === 'ACTION' && c.stepId && SCHEMAS[c.stepId]?.kind === 'chooseSeat',
      );

      for (const msg of chooseSeatMessages) {
        const actionMsg = msg.message as ActionMessage;
        if (actionMsg.target !== null) {
          // target must be a single seat number, not an encoded value
          expect(actionMsg.target).toBeLessThan(100);
          expect(actionMsg.target).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });
});
