/**
 * BoardTray — sticky board summary above the config editor's role list.
 *
 * Faction stat badges, one token per selected slot (tap a token to remove one copy) and the
 * selected count. When the board started from a preset, the preset's player count is shown
 * as a reference target; going over it only warns, it never blocks continuing — the engine
 * has no fixed player-count cap (`validateTemplateRoles` requires at least one player).
 */
import { FactionChip } from '@/components/FactionChip';
import { FactionStatBadges } from '@/games/werewolf/components/FactionRoleList';
import {
  buildBoardTrayTokens,
  selectionToRoles,
  type VariantOverrides,
} from '@/games/werewolf/screens/ConfigScreen/configHelpers';
import { TESTIDS } from '@/testids';

interface BoardTrayProps {
  readonly selection: Readonly<Record<string, boolean>>;
  readonly variantOverrides: VariantOverrides;
  readonly totalCount: number;
  /** Player count of the preset this board started from; null for a blank custom board. */
  readonly targetPlayerCount: number | null;
  /** Remove one copy of the slot behind the tapped token. */
  readonly onRemoveToken: (key: string) => void;
}

/** Board summary: faction counts, selected tokens, total and target. */
export function BoardTray({
  selection,
  variantOverrides,
  totalCount,
  targetPlayerCount,
  onRemoveToken,
}: BoardTrayProps) {
  const tokens = buildBoardTrayTokens(selection, variantOverrides);
  const overTarget =
    targetPlayerCount !== null && totalCount > targetPlayerCount
      ? totalCount - targetPlayerCount
      : 0;
  return (
    <div className="config-board-tray" data-testid={TESTIDS.configBoardTray}>
      <FactionStatBadges roles={selectionToRoles(selection, variantOverrides)} />
      <div className="config-board-tray-tokens">
        {tokens.map((token) => (
          <FactionChip
            key={token.key}
            label={token.label}
            color={`var(--color-${token.faction})`}
            size="sm"
            onPress={() => onRemoveToken(token.key)}
          />
        ))}
      </div>
      <p className="config-board-tray-count">
        已选 {totalCount} 人{targetPlayerCount !== null && ` / 目标 ${targetPlayerCount} 人`}
      </p>
      {overTarget > 0 && (
        <p role="status" className="config-board-tray-warning">
          多出 {overTarget} 人
        </p>
      )}
    </div>
  );
}
