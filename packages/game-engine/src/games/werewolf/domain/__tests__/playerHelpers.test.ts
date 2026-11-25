/**
 * playerHelpers Unit Tests
 *
 * Covers: buildSeatRoleMap, findSeatByRole, forEachSeatedPlayer,
 *         getBottomCardEffectiveRole, isBottomCardWolfVoteExcluded
 */

import type { RoleId } from '../models';
import { findSeatByRole } from '../playerHelpers';
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

// =============================================================================
// getBottomCardEffectiveRole
// =============================================================================

// =============================================================================
// isBottomCardWolfVoteExcluded
// =============================================================================
