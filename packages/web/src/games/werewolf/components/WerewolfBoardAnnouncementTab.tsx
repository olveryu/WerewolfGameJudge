/** Werewolf board release tab contributed to the product announcement modal. */
import './WerewolfBoardAnnouncementTab.css';

import {
  PRESET_TEMPLATES,
  TEMPLATE_CATEGORY_LABELS,
} from '@game-judge/game-engine/games/werewolf/public';
import { useState } from 'react';

import IconChevronDown from '~icons/ion/chevron-down';
import IconChevronUp from '~icons/ion/chevron-up';

import {
  getWerewolfBoardsByVersion,
  WEREWOLF_BOARD_VERSIONS_DESC,
} from '../model/boardAnnouncements';

const COLLAPSE_THRESHOLD = 6;
const BOARDS_BY_VERSION = getWerewolfBoardsByVersion(PRESET_TEMPLATES);
const LATEST_VERSION = WEREWOLF_BOARD_VERSIONS_DESC[0];

/** Preset boards grouped by the release that added them, latest first. */
export function WerewolfBoardAnnouncementTab() {
  const [expandedVersions, setExpandedVersions] = useState<ReadonlySet<string>>(new Set());

  const setExpanded = (version: string, expanded: boolean) => {
    setExpandedVersions((previous) => {
      const next = new Set(previous);
      if (expanded) next.add(version);
      else next.delete(version);
      return next;
    });
  };

  return (
    <div className="board-announcements">
      {BOARDS_BY_VERSION.map(({ version, boards }) => {
        const isLatest = version === LATEST_VERSION;
        const shouldCollapse = boards.length >= COLLAPSE_THRESHOLD;
        const isExpanded = expandedVersions.has(version);

        return (
          <section
            key={version}
            className="board-announcements-group"
            data-latest={isLatest}
            aria-label={version}
          >
            <div className="board-announcements-header">
              <h3 className="board-announcements-title">
                {version === 'v1.0.0' ? 'v1.0.0 首发' : `${version} 新增`}
              </h3>
              {isLatest && <span className="board-announcements-new">NEW</span>}
            </div>

            {shouldCollapse && !isExpanded ? (
              <button
                type="button"
                className="board-announcements-toggle"
                aria-expanded={false}
                onClick={() => setExpanded(version, true)}
              >
                展开 {boards.length} 套板子
                <IconChevronDown aria-hidden />
              </button>
            ) : (
              <ul className="board-announcements-chips">
                {boards.map((board) => (
                  <li key={board.name} className="board-announcements-chip-row">
                    <span className="board-announcements-chip">{board.name}</span>
                    <span className="board-announcements-category" data-category={board.category}>
                      {TEMPLATE_CATEGORY_LABELS[board.category]}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {shouldCollapse && isExpanded && (
              <button
                type="button"
                className="board-announcements-toggle"
                aria-expanded
                onClick={() => setExpanded(version, false)}
              >
                收起
                <IconChevronUp aria-hidden />
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
