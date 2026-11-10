/**
 * FactionRoleList — faction stat badges + per-faction FactionChip rows
 *
 * Shared presentation component, used by the board picker (expanded card) and board nomination.
 * Receives roles array, internally calls computeFactionStats / groupRolesByFaction,
 * renders the "狼N 神N 民N 特N" badge row + per-faction FactionChip rows.
 */
import './faction.css';
import './FactionRoleList.css';

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import { FactionChip } from '@/components/FactionChip';
import {
  computeFactionStats,
  groupRolesByFaction,
} from '@/games/werewolf/screens/ConfigScreen/configHelpers';

interface FactionRoleListProps {
  readonly roles: readonly RoleId[];
  /** Callback when a role chip is pressed (e.g. show role detail). Omit to make chips non-interactive. */
  readonly onRolePress?: (roleId: RoleId) => void;
  /** Whether to show faction stat badges row. Default: true */
  readonly showStats?: boolean;
}

/** The "狼N 神N 民N 特N" badge row; the third-party badge only when the board has one. */
export function FactionStatBadges({ roles }: { readonly roles: readonly RoleId[] }) {
  const stats = computeFactionStats(roles);
  return (
    <div className="faction-stat-row">
      <span className="faction-stat-badge" data-faction="wolf">
        狼{stats.wolfCount}
      </span>
      <span className="faction-stat-badge" data-faction="god">
        神{stats.godCount}
      </span>
      <span className="faction-stat-badge" data-faction="villager">
        民{stats.villagerCount}
      </span>
      {stats.thirdCount > 0 && (
        <span className="faction-stat-badge" data-faction="third">
          特{stats.thirdCount}
        </span>
      )}
    </div>
  );
}

export function FactionRoleList({ roles, onRolePress, showStats = true }: FactionRoleListProps) {
  const { wolfItems, godItems, villagerItems, thirdItems } = groupRolesByFaction(roles);
  const rows = [
    { label: '狼人', color: 'var(--color-wolf)', items: wolfItems },
    { label: '神职', color: 'var(--color-god)', items: godItems },
    { label: '村民', color: 'var(--color-villager)', items: villagerItems },
    { label: '特殊', color: 'var(--color-third)', items: thirdItems },
  ];

  return (
    <div>
      {showStats && <FactionStatBadges roles={roles} />}
      <div className="faction-role-list">
        {rows.map(
          (row) =>
            row.items.length > 0 && (
              <div key={row.label} className="faction-role-row">
                <span className="faction-role-row-label">{row.label}</span>
                <div className="faction-role-row-chips">
                  {row.items.map((item) => (
                    <FactionChip
                      key={item.roleId}
                      label={
                        item.count > 1 ? `${item.displayName}×${item.count}` : item.displayName
                      }
                      color={row.color}
                      size="sm"
                      onPress={
                        onRolePress === undefined ? undefined : () => onRolePress(item.roleId)
                      }
                    />
                  ))}
                </div>
              </div>
            ),
        )}
      </div>
    </div>
  );
}
