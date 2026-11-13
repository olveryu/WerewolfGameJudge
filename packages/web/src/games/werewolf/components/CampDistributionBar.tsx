/**
 * CampDistributionBar — per-user camp distribution (狼人 / 神 / 平民 / 第三方).
 *
 * One bar per camp bucket, filled to its share of the visible games, with a trailing percentage,
 * or an empty-state line when no games are visible (total === 0).
 */
import './CampDistributionBar.css';
import './faction.css';

import {
  WEREWOLF_CAMP_ORDER,
  type WerewolfCampStats,
} from '@game-judge/game-engine/games/werewolf/public';

import IconInformationCircleOutline from '~icons/ion/information-circle-outline';

const CAMP_LABEL: Readonly<Record<keyof WerewolfCampStats['counts'], string>> = {
  wolf: '狼人',
  god: '神',
  villager: '平民',
  third: '第三方',
};

/** Integer percentage of a camp count within the visible total. */
function toPercent(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

export function CampDistributionBar({
  campStats,
  compact = false,
}: {
  readonly campStats: WerewolfCampStats;
  /** Narrow label column for the room profile card. */
  readonly compact?: boolean;
}) {
  return (
    <div className="camp-distribution" data-compact={compact}>
      {campStats.total === 0 ? (
        <p className="camp-distribution-empty">暂无阵营数据</p>
      ) : (
        WEREWOLF_CAMP_ORDER.map((bucket) => {
          const percent = toPercent(campStats.counts[bucket], campStats.total);
          return (
            <div key={bucket} className="camp-distribution-row" data-faction={bucket}>
              <span className="camp-distribution-label">{CAMP_LABEL[bucket]}</span>
              <span className="camp-distribution-track" aria-hidden>
                <span className="camp-distribution-fill" style={{ width: `${percent}%` }} />
              </span>
              <span className="camp-distribution-percent">{percent}%</span>
            </div>
          );
        })
      )}
      <p className="camp-distribution-hint">
        <IconInformationCircleOutline aria-hidden /> 仅统计两小时前结束的对局
      </p>
    </div>
  );
}
