/** BoardCard — single board card (expand/collapse + faction stats + key role chips). */
import '@/games/werewolf/components/faction.css';
import './BoardCard.css';

import {
  getPlayerCount,
  type PresetTemplate,
  type RoleId,
} from '@game-judge/game-engine/games/werewolf/public';

import { Button } from '@/components/Button';
import { BOARD_STRATEGY } from '@/games/werewolf/components/BoardStrategy/boardStrategyData';
import { FactionRoleList, FactionStatBadges } from '@/games/werewolf/components/FactionRoleList';
import {
  FACTION_COLOR_MAP,
  getKeyRoles,
} from '@/games/werewolf/screens/ConfigScreen/configHelpers';
import { TESTIDS } from '@/testids';
import IconBookOutline from '~icons/ion/book-outline';
import IconChevronDown from '~icons/ion/chevron-down';
import IconChevronUp from '~icons/ion/chevron-up';
import IconInformationCircleOutline from '~icons/ion/information-circle-outline';

/** Card inner width lost to the screen and card side paddings (tokens.css screen-h 20, medium 16). */
const CARD_HORIZONTAL_INSET_PX = 20 * 2 + 16 * 2;
/** One three-character chip: small side padding 8, caption 12 per character, tight gap 4. */
const KEY_ROLE_CHIP_WIDTH_PX = 8 * 2 + 3 * 12 + 4;

/** Estimate how many key-role chips fit in a single row. */
export const estimateMaxChips = (viewportWidth: number): number =>
  Math.max(2, Math.floor((viewportWidth - CARD_HORIZONTAL_INSET_PX) / KEY_ROLE_CHIP_WIDTH_PX));

interface BoardCardProps {
  readonly template: PresetTemplate;
  readonly isExpanded: boolean;
  readonly onToggleExpand: (name: string) => void;
  /** Omitted in the guide, which only browses boards: no select button. */
  readonly onSelect?: (name: string) => void;
  readonly onRolePress: (roleId: RoleId) => void;
  readonly onStrategyPress: (name: string) => void;
  readonly maxChips: number;
}

/** Board card component. */
export function BoardCard({
  template,
  isExpanded,
  onToggleExpand,
  onSelect,
  onRolePress,
  onStrategyPress,
  maxChips,
}: BoardCardProps) {
  const keyRoles = getKeyRoles(template.roles, maxChips);
  const totalSpecial = template.roles.filter((r) => r !== 'wolf' && r !== 'villager').length;
  const remainingCount = Math.max(0, totalSpecial - keyRoles.length);
  const hasStrategy = template.name in BOARD_STRATEGY;

  return (
    <article className="board-card" data-expanded={isExpanded}>
      <button
        type="button"
        className="board-card-header"
        aria-expanded={isExpanded}
        data-testid={TESTIDS.boardCardHeader(template.name)}
        onClick={() => onToggleExpand(template.name)}
      >
        <span className="board-card-title-row">
          <span className="board-card-title">{template.name}</span>
          <span className="board-card-players">{getPlayerCount(template.roles)}人</span>
          {isExpanded ? (
            <IconChevronUp className="board-card-chevron" aria-hidden />
          ) : (
            <IconChevronDown className="board-card-chevron" aria-hidden />
          )}
        </span>
        <FactionStatBadges roles={template.roles} />
        {!isExpanded && keyRoles.length > 0 && (
          <span className="board-card-key-roles">
            {keyRoles.map((item) => (
              <span
                key={item.roleId}
                className="board-card-key-role"
                data-faction={FACTION_COLOR_MAP[item.faction]}
              >
                {item.displayName}
              </span>
            ))}
            {remainingCount > 0 && (
              <span className="board-card-key-role-more">+{remainingCount}</span>
            )}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="board-card-expanded">
          <hr className="board-card-divider" />
          <FactionRoleList roles={template.roles} showStats={false} onRolePress={onRolePress} />
          <p className="board-card-hint">
            <IconInformationCircleOutline aria-hidden /> 点击角色名查看能力说明
            {onSelect === undefined ? '' : ' · 选板后仍可增减角色'}
          </p>
          <div className="board-card-actions" data-centered={onSelect === undefined}>
            {hasStrategy && (
              <Button
                variant={onSelect === undefined ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => onStrategyPress(template.name)}
              >
                <IconBookOutline aria-hidden />
                查看攻略
              </Button>
            )}
            {onSelect !== undefined && (
              <Button
                variant="primary"
                size="sm"
                className="board-card-select"
                data-testid={TESTIDS.boardCardSelectButton(template.name)}
                onClick={() => onSelect(template.name)}
              >
                以此为基础
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
