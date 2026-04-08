/**
 * revealPayload Unit Tests
 *
 * Covers: WOLF_ROBOT_GATE_ROLES, buildRevealPayload
 */

import type { ResolverResult } from '../../../resolvers/types';
import { buildRevealPayload, WOLF_ROBOT_GATE_ROLES } from '../revealPayload';

// =============================================================================
// WOLF_ROBOT_GATE_ROLES
// =============================================================================

describe('WOLF_ROBOT_GATE_ROLES', () => {
  it('should be a non-empty readonly array derived from wolfRobot spec', () => {
    expect(Array.isArray(WOLF_ROBOT_GATE_ROLES)).toBe(true);
    expect(WOLF_ROBOT_GATE_ROLES.length).toBeGreaterThan(0);
  });

  it('should include hunter (the primary gate-triggering role)', () => {
    expect(WOLF_ROBOT_GATE_ROLES).toContain('hunter');
  });
});

// =============================================================================
// buildRevealPayload
// =============================================================================

describe('buildRevealPayload', () => {
  it('should always include updates from resolver result', () => {
    const result: ResolverResult = {
      valid: true,
      updates: { blockedSeat: 3 },
    };
    const payload = buildRevealPayload(result, 'nightmareBlock', 3);
    expect(payload.updates).toEqual({ blockedSeat: 3 });
  });

  it('should return only updates when schema has no revealKind', () => {
    const result: ResolverResult = {
      valid: true,
      updates: { guardedSeat: 1 },
    };
    const payload = buildRevealPayload(result, 'guardProtect', 1);
    expect(payload.updates).toEqual({ guardedSeat: 1 });
    // No reveal fields should be set
    expect(payload.seerReveal).toBeUndefined();
    expect(payload.psychicReveal).toBeUndefined();
  });

  it('should set seerReveal when schema has seer revealKind and result has checkResult', () => {
    const result: ResolverResult = {
      valid: true,
      updates: {},
      result: { checkResult: '好人' },
    };
    const payload = buildRevealPayload(result, 'seerCheck', 2);
    expect(payload.seerReveal).toEqual({ targetSeat: 2, result: '好人' });
  });

  it('should not set seerReveal when result has no checkResult', () => {
    const result: ResolverResult = {
      valid: true,
      updates: {},
      result: {},
    };
    const payload = buildRevealPayload(result, 'seerCheck', 2);
    expect(payload.seerReveal).toBeUndefined();
  });

  it('should set psychicReveal when schema has psychic revealKind', () => {
    const result: ResolverResult = {
      valid: true,
      updates: {},
      result: { identityResult: 'wolf' },
    };
    const payload = buildRevealPayload(result, 'psychicCheck', 3);
    expect(payload.psychicReveal).toEqual({ targetSeat: 3, result: 'wolf' });
  });

  it('should set wolfRobotReveal with learnedRoleId and canShootAsHunter', () => {
    const result: ResolverResult = {
      valid: true,
      updates: {},
      result: {
        identityResult: 'hunter',
        learnedRoleId: 'hunter',
        canShootAsHunter: true,
        learnTarget: 5,
      },
    };
    const payload = buildRevealPayload(result, 'wolfRobotLearn', 5);
    expect(payload.wolfRobotReveal).toBeDefined();
    expect(payload.wolfRobotReveal!.learnedRoleId).toBe('hunter');
    expect(payload.wolfRobotReveal!.canShootAsHunter).toBe(true);
  });

  it('should set wolfRobotHunterStatusViewed=false when learned a gate-triggering role', () => {
    const result: ResolverResult = {
      valid: true,
      updates: {},
      result: {
        identityResult: 'hunter',
        learnedRoleId: 'hunter',
        canShootAsHunter: true,
        learnTarget: 5,
      },
    };
    const payload = buildRevealPayload(result, 'wolfRobotLearn', 5);
    expect(payload.wolfRobotHunterStatusViewed).toBe(false);
  });

  it('should set wolfRobotContext when learnTarget and learnedRoleId are present', () => {
    const result: ResolverResult = {
      valid: true,
      updates: {},
      result: {
        identityResult: 'seer',
        learnedRoleId: 'seer',
        learnTarget: 3,
      },
    };
    const payload = buildRevealPayload(result, 'wolfRobotLearn', 3);
    expect(payload.wolfRobotContext).toEqual({
      learnedSeat: 3,
      disguisedRole: 'seer',
    });
  });

  it('should throw when wolfRobot result has identityResult but no learnedRoleId', () => {
    const result: ResolverResult = {
      valid: true,
      updates: {},
      result: { identityResult: 'hunter' },
    };
    expect(() => buildRevealPayload(result, 'wolfRobotLearn', 5)).toThrow('learnedRoleId');
  });

  it('should not set wolfRobotReveal when result has no identityResult', () => {
    const result: ResolverResult = {
      valid: true,
      updates: {},
      result: {},
    };
    const payload = buildRevealPayload(result, 'wolfRobotLearn', 5);
    expect(payload.wolfRobotReveal).toBeUndefined();
  });
});
