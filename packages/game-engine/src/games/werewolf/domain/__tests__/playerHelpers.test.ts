/**
 * playerHelpers Unit Tests
 *
 * Covers: buildSeatRoleMap, findSeatByRole, forEachSeatedPlayer,
 *         getBottomCardEffectiveRole, isBottomCardWolfVoteExcluded
 */

import { vi } from 'vitest';

import type { RoleId } from '../models';
import { buildSeatRoleMap, findSeatByRole, forEachSeatedPlayer } from '../playerHelpers';
import type { GameState } from '../protocol/types';

type Players = GameState['players'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkPlayers(entries: Array<[number, RoleId | null]>): Players {
  const players: Players = {};
  for (const [seat, role] of entries) {
    players[seat] = role ? { seat: seat, role } : null;
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
      0: { seat: 0, role: null },
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
      entries.push([seat, player.role ?? '']);
    });
    expect(entries).toEqual([
      [0, 'seer'],
      [2, 'wolf'],
    ]);
  });

  it('should not call callback for empty players', () => {
    const cb = vi.fn();
    forEachSeatedPlayer({}, cb);
    expect(cb).not.toHaveBeenCalled();
  });
});

// =============================================================================
// getBottomCardEffectiveRole
// =============================================================================

// =============================================================================
// isBottomCardWolfVoteExcluded
// =============================================================================
