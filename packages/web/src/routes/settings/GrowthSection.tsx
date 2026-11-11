/**
 * Settings growth details: the XP progress bar of the profile card, and the games-played /
 * unlock summary row that opens the unlocks page.
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

/** The XP progress bar of the profile card. */
export function GrowthXpBar({ stats }: { stats: UserStats }) {
  const progress = getLevelProgress(stats.xp);
  const nextThreshold = getLevelThreshold(stats.level + 1);
  return (
    <div className="growth-xp">
      <span className="growth-xp-label">XP</span>
      <progress className="growth-progress" aria-label="经验进度" max={1} value={progress} />
      <span className="growth-xp-value">{`${stats.xp}/${nextThreshold}`}</span>
    </div>
  );
}

/** The unlocks row: games played, the unlocked count and its progress; opens the unlocks page. */
export function UnlocksEntry({ stats }: { stats: UserStats }) {
  const { roomCode } = useParams();
  const unlockCount = new Set([
    ...stats.unlockedItems,
    ...FREE_AVATAR_IDS,
    ...FREE_FRAME_IDS,
    ...FREE_FLAIR_IDS,
  ]).size;

  return (
    <Link
      className="settings-entry"
      to={roomCode === undefined ? '/unlocks' : `/unlocks/${roomCode}`}
    >
      <IconTrophyOutline aria-hidden className="settings-entry-icon" />
      <span className="settings-entry-text">
        <span>{`${stats.gamesPlayed} 局 · 已解锁 ${unlockCount}/${TOTAL_UNLOCKABLE_COUNT}`}</span>
        <progress
          className="growth-progress growth-progress-mini"
          aria-label="解锁进度"
          max={TOTAL_UNLOCKABLE_COUNT}
          value={unlockCount}
        />
      </span>
      <IconChevronForward aria-hidden className="settings-entry-chevron" />
    </Link>
  );
}
