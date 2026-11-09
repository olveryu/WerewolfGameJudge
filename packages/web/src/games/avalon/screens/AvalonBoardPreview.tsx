/** Read-only board for the selected player count: roles grouped as shipped, quest sizes, Lady note. */
import './AvalonBoardPreview.css';

import {
  AVALON_BOARDS,
  AVALON_LADY_MIN_PLAYERS,
  AVALON_QUEST_SIZES,
  type AvalonConfig,
  type AvalonRoleId,
  isAvalonPlayerCount,
} from '@game-judge/game-engine/games/avalon/public';

import { getAvalonRoleDisplayName } from '../model/avalonRoleDisplay';

/** Renders nothing while the typed count is outside the supported boards (inline issue covers it). */
export function AvalonBoardPreview({ config }: { readonly config: AvalonConfig }) {
  const playerCount: number = config.numberOfPlayers;
  if (!isAvalonPlayerCount(playerCount)) return null;
  const roles: readonly AvalonRoleId[] = AVALON_BOARDS[playerCount];
  const questSizes = AVALON_QUEST_SIZES[playerCount];
  return (
    <section className="avalon-board-preview" aria-labelledby="avalon-board-preview-title">
      <h3 id="avalon-board-preview-title" className="avalon-board-preview-title">
        本局板子（{playerCount} 人）
      </h3>
      <ul className="avalon-board-preview-roles">
        {roles.map((role, index) => (
          <li key={`${role}-${index}`} className="avalon-board-preview-role">
            {getAvalonRoleDisplayName(role)}
          </li>
        ))}
      </ul>
      <p className="avalon-board-preview-hint">
        任务人数：{questSizes.join('-')}
        {playerCount >= AVALON_LADY_MIN_PLAYERS ? ' · 含湖中仙女' : ''}
      </p>
    </section>
  );
}
