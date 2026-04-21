/**
 * playerHelpers Unit Tests
 *
 * Covers: buildSeatRoleMap, findSeatByRole, forEachSeatedPlayer,
 *         getBottomCardEffectiveRole, isBottomCardWolfVoteExcluded
 */

import type { RoleId } from '../../models';
import type { GameStatePayload } from '../../protocol/types';
import {
  buildSeatRoleMap,
  findSeatByRole,
  forEachSeatedPlayer,
  getBottomCardEffectiveRole,
  isBottomCardWolfVoteExcluded,
} from '../playerHelpers';

type Players = GameStatePayload['players'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkPlayers(entries: Array<[number, RoleId | null]>): Players {
  const players: Players = {};
  for (const [seat, role] of entries) {
    players[seat] = role ? { userId: `p${seat}`, seat: seat, role, hasViewedRole: true } : null;
  }
  return players;
}

// =============================================================================
// buildSeatRoleMap
// =============================================================================

describe('buildSeatRoleMap', () => {
  it('should build a map from seat to roleId for seated players', () => {
    const players = mkPlayers([
      [0, 'seer'],
      [1, 'wolf'],
      [2, null],
    ]);
    const map = buildSeatRoleMap(players);
    expect(map.size).toBe(2);
    expect(map.get(0)).toBe('seer');
    expect(map.get(1)).toBe('wolf');
    expect(map.has(2)).toBe(false);
  });

  it('should return empty map for empty players', () => {
    const map = buildSeatRoleMap({});
    expect(map.size).toBe(0);
  });

  it('should skip players with null role', () => {
    const players: Players = {
      0: { userId: 'p0', seat: 0, role: null, hasViewedRole: false },
    };
    const map = buildSeatRoleMap(players);
    expect(map.size).toBe(0);
  });
});

// =============================================================================
// findSeatByRole
// =============================================================================

describe('findSeatByRole', () => {
  it('should return seat number when role found', () => {
    const players = mkPlayers([
      [0, 'villager'],
      [1, 'seer'],
      [2, 'wolf'],
    ]);
    expect(findSeatByRole(players, 'seer')).toBe(1);
  });

  it('should return null when role not found', () => {
    const players = mkPlayers([
      [0, 'villager'],
      [1, 'wolf'],
    ]);
    expect(findSeatByRole(players, 'witch')).toBeNull();
  });

  it('should return null for empty players', () => {
    expect(findSeatByRole({}, 'seer')).toBeNull();
  });
});

// =============================================================================
// forEachSeatedPlayer
// =============================================================================

describe('forEachSeatedPlayer', () => {
  it('should iterate over non-null players with correct seat numbers', () => {
    const players = mkPlayers([
      [0, 'seer'],
      [1, null],
      [2, 'wolf'],
    ]);
    const entries: Array<[number, string]> = [];
    forEachSeatedPlayer(players, (seat, player) => {
      entries.push([seat, player.userId]);
    });
    expect(entries).toEqual([
      [0, 'p0'],
      [2, 'p2'],
    ]);
  });

  it('should not call callback for empty players', () => {
    const cb = jest.fn();
    forEachSeatedPlayer({}, cb);
    expect(cb).not.toHaveBeenCalled();
  });
});

// =============================================================================
// getBottomCardEffectiveRole
// =============================================================================

describe('getBottomCardEffectiveRole', () => {
  it('should return thief chosen card when role is thief and card chosen', () => {
    expect(getBottomCardEffectiveRole('thief', 'seer')).toBe('seer');
  });

  it('should return treasureMaster chosen card when role is treasureMaster and card chosen', () => {
    expect(getBottomCardEffectiveRole('treasureMaster', null, 'wolf')).toBe('wolf');
  });

  it('should return original role when thief has not chosen', () => {
    expect(getBottomCardEffectiveRole('thief', null)).toBe('thief');
    expect(getBottomCardEffectiveRole('thief', undefined)).toBe('thief');
  });

  it('should return original role when treasureMaster has not chosen', () => {
    expect(getBottomCardEffectiveRole('treasureMaster', null, null)).toBe('treasureMaster');
  });

  it('should return original role for non-bottom-card roles', () => {
    expect(getBottomCardEffectiveRole('seer')).toBe('seer');
    expect(getBottomCardEffectiveRole('wolf', 'seer', 'witch')).toBe('wolf');
  });
});

// =============================================================================
// isBottomCardWolfVoteExcluded
// =============================================================================

describe('isBottomCardWolfVoteExcluded', () => {
  it('should return true for treasureMaster', () => {
    expect(isBottomCardWolfVoteExcluded('treasureMaster')).toBe(true);
  });

  it('should return false for thief', () => {
    expect(isBottomCardWolfVoteExcluded('thief')).toBe(false);
  });

  it('should return false for normal roles', () => {
    expect(isBottomCardWolfVoteExcluded('wolf')).toBe(false);
    expect(isBottomCardWolfVoteExcluded('seer')).toBe(false);
  });
});
