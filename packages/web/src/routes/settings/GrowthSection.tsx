/**
 * Settings growth details: a full-width XP progress bar and the games-played / unlock summary,
 * which opens the unlocks page. Loaded lazily by the settings page so the growth and reward
 * catalogs stay out of its chunk.
 */
import './GrowthSection.css';

import { getLevelProgress, getLevelThreshold } from '@game-judge/game-engine/product/growth';
import {
  FREE_AVATAR_IDS,
  FREE_FLAIR_IDS,
  FREE_FRAME_IDS,
  TOTAL_UNLOCKABLE_COUNT,
} from '@game-judge/game-engine/product/rewards';
import { Link, useParams } from 'react-router';

import type { UserStats } from '@/features/account/services/accountApi';
import IconChevronForward from '~icons/ion/chevron-forward';
import IconTrophyOutline from '~icons/ion/trophy-outline';

/** Level / XP section of the account card. */
export function GrowthSection({ stats }: { stats: UserStats }) {
  const { roomCode } = useParams();
  const progress = getLevelProgress(stats.xp);
  const nextThreshold = getLevelThreshold(stats.level + 1);
  const unlockCount = new Set([
    ...stats.unlockedItems,
    ...FREE_AVATAR_IDS,
    ...FREE_FRAME_IDS,
    ...FREE_FLAIR_IDS,
  ]).size;

  return (
    <>
      <div className="growth-xp">
        <span className="growth-xp-label">XP</span>
        <progress className="growth-progress" aria-label="经验进度" max={1} value={progress} />
        <span className="growth-xp-value">{`${stats.xp}/${nextThreshold}`}</span>
      </div>
      <Link
        className="growth-unlocks"
        to={roomCode === undefined ? '/unlocks' : `/unlocks/${roomCode}`}
      >
        <IconTrophyOutline aria-hidden className="growth-unlocks-icon" />
        <div className="growth-unlocks-content">
          <span>{`${stats.gamesPlayed} 局 · 已解锁 ${unlockCount}/${TOTAL_UNLOCKABLE_COUNT}`}</span>
          <progress
            className="growth-progress growth-progress-mini"
            aria-label="解锁进度"
            max={TOTAL_UNLOCKABLE_COUNT}
            value={unlockCount}
          />
        </div>
        <IconChevronForward aria-hidden className="growth-unlocks-chevron" />
      </Link>
    </>
  );
}
