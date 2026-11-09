/**
 * Player profile card for a seat: public profile (level, title, XP, stats) for a human, the
 * roster name for a bot, plus the seat actions the model offers (leave seat, kick).
 * Equipped cosmetics are shown by the product layer (P4) and are not rendered here yet.
 */
import './PlayerProfileCard.css';

import {
  getLevelProgress,
  getLevelThreshold,
  getLevelTitle,
} from '@game-judge/game-engine/product/growth';
import type { ReactNode } from 'react';

import { Avatar } from '@/components/avatar/Avatar';
import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import { Spinner } from '@/components/Spinner';
import { useUserProfileQuery } from '@/features/account/queries/useUserProfileQuery';
import {
  getRoomOccupantAvatarSeed,
  getRoomOccupantUserId,
} from '@/features/room/model/RoomOccupant';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';

const AVATAR_SIZE = 80;

/** Title tier per level band; colors live in the stylesheet. */
function levelTier(level: number): string {
  if (level >= 41) return 'legend';
  if (level >= 31) return 'elder';
  if (level >= 21) return 'veteran';
  if (level >= 11) return 'regular';
  if (level >= 6) return 'beginner';
  return 'newbie';
}

function SeatActions({ model }: { readonly model: RoomProfileCardModel }) {
  return (
    <>
      {model.isSelf && model.onLeaveSeat !== null && (
        <Button variant="secondary" onClick={model.onLeaveSeat}>
          离座
        </Button>
      )}
      {!model.isSelf && model.onKick !== null && (
        <Button variant="danger" onClick={model.onKick}>
          移出座位
        </Button>
      )}
    </>
  );
}

export function PlayerProfileCard({
  model,
  profileDetailsRenderer,
}: {
  readonly model: RoomProfileCardModel;
  /** Renders the game-specific stats section when the model carries `gameDetails`. */
  readonly profileDetailsRenderer?: (statsUserId: string) => ReactNode;
}) {
  const { target } = model;
  const isBot = target.occupant.kind === 'bot';
  const humanUserId = getRoomOccupantUserId(target.occupant);
  const avatarSeed = getRoomOccupantAvatarSeed(target.occupant);
  const { data: profile, isLoading, isError } = useUserProfileQuery(humanUserId);
  const seatName = `${target.seat + 1}号座位`;

  let body: ReactNode;
  if (isBot) {
    body = (
      <>
        <div className="profile-avatar">
          <span className="profile-avatar-clip">
            <Avatar userId={avatarSeed} avatarUrl={null} size={AVATAR_SIZE} />
          </span>
        </div>
        <p className="profile-name">{target.rosterName}</p>
        <span className="profile-title" data-tier="newbie">
          机器人
        </span>
        <SeatActions model={model} />
      </>
    );
  } else if (isLoading) {
    body = (
      <div className="profile-status">
        <Spinner label="加载中" size="lg" />
        <p>加载中</p>
      </div>
    );
  } else if (isError || profile === undefined) {
    body = (
      <div className="profile-status">
        <p className="profile-error">加载失败</p>
        <p>请稍后重试</p>
      </div>
    );
  } else {
    const tier = levelTier(profile.level);
    const nextThreshold = getLevelThreshold(profile.level + 1);
    const progress = getLevelProgress(profile.xp);
    body = (
      <>
        <div className="profile-avatar">
          <span className="profile-avatar-clip">
            <Avatar userId={avatarSeed} avatarUrl={profile.avatarUrl ?? null} size={AVATAR_SIZE} />
          </span>
          <span className="profile-level" data-tier={tier}>
            Lv.{profile.level}
          </span>
        </div>
        <p className="profile-name">{profile.displayName || seatName}</p>
        <span className="profile-title" data-tier={tier}>
          {profile.title ?? getLevelTitle(profile.level)}
        </span>
        <div className="profile-xp">
          <div className="profile-xp-row">
            <span>经验值</span>
            <span className="profile-xp-value">
              {profile.xp} / {nextThreshold}
            </span>
          </div>
          <progress className="profile-xp-bar" value={progress} max={1} />
        </div>
        <dl className="profile-stats">
          <div className="profile-stat">
            <dd>{profile.gamesPlayed}</dd>
            <dt>总局数</dt>
          </div>
          <div className="profile-stat">
            <dd>{profile.unlockedItemCount}</dd>
            <dt>已解锁</dt>
          </div>
        </dl>
        {model.gameDetails !== null && (
          <section className="profile-game-details">
            <h3 className="profile-section-title">{model.gameDetails.title}</h3>
            {profileDetailsRenderer?.(model.gameDetails.statsUserId)}
          </section>
        )}
        <SeatActions model={model} />
      </>
    );
  }

  return (
    <CenterDialog open onClose={model.onClose} title={seatName} testId="player-profile-card">
      <div className="profile-card">{body}</div>
    </CenterDialog>
  );
}
