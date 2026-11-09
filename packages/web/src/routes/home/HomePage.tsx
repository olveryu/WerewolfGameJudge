import './HomePage.css';

import { Suspense, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Avatar } from '@/components/avatar/Avatar';
import { APP_VERSION } from '@/config/version';
import { useAuthContext, type User } from '@/contexts/AuthContext';
import { requestLogin } from '@/features/auth/loginRequests';
import { getRecentRooms } from '@/features/room/services/recentRooms';
import { GAME_HOME_SPOTLIGHTS, GAME_MODE_OPTIONS } from '@/games/catalog';
import { TESTIDS } from '@/testids';
import { homeLog } from '@/utils/logger';
import { isMiniProgram, wxReLaunch } from '@/utils/miniProgram';
import IconChevronForward from '~icons/ion/chevron-forward';
import IconCloudOfflineOutline from '~icons/ion/cloud-offline-outline';
import IconLogInOutline from '~icons/ion/log-in-outline';
import IconPersonCircleOutline from '~icons/ion/person-circle-outline';
import IconTimeOutline from '~icons/ion/time-outline';

import { JoinRoomDialog } from './JoinRoomDialog';
import { RecentRoomsDialog } from './RecentRoomsDialog';

/** Max icon chips on the create-room card; past this the tail folds into a +N chip. */
const HERO_ICON_LIMIT = 8;
const HERO_ICONS =
  GAME_MODE_OPTIONS.length > HERO_ICON_LIMIT
    ? GAME_MODE_OPTIONS.slice(0, HERO_ICON_LIMIT - 1)
    : GAME_MODE_OPTIONS;
const HERO_OVERFLOW = GAME_MODE_OPTIONS.length - HERO_ICONS.length;
const ADMIN_TAP_COUNT = 5;
const ADMIN_TAP_WINDOW_MS = 3000;

function displayNameOf(user: User): string {
  if (user.isAnonymous) return '匿名用户';
  if (user.displayName) return user.displayName;
  if (user.email) return user.email.replace(/@.*$/, '');
  return '用户';
}

/** Home: create or join a room, recent rooms, gacha entry, game spotlights and account. */
export function HomePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, error: authError } = useAuthContext();
  const [dialog, setDialog] = useState<'join' | 'recent' | null>(null);
  const adminTaps = useRef({ count: 0, lastTapMs: 0 });
  const recentRooms = user === null ? [] : getRecentRooms(user.id);

  /** Runs `action` once signed in; a fresh email sign-up goes to settings to pick a profile. */
  const requireAuth = async (action: () => void) => {
    if (user !== null) {
      action();
      return;
    }
    const outcome = await requestLogin({ title: '登录', subtitle: '选择登录方式继续' });
    if (outcome === 'signedUp') void navigate('/settings');
    else if (outcome === 'signedIn') action();
  };

  const joinRoom = (roomCode: string) => {
    homeLog.info('Join room', { roomCode });
    setDialog(null);
    void navigate(`/room/${roomCode}`);
  };

  const tapTitle = () => {
    const now = Date.now();
    const taps = adminTaps.current;
    taps.count = now - taps.lastTapMs > ADMIN_TAP_WINDOW_MS ? 1 : taps.count + 1;
    taps.lastTapMs = now;
    if (taps.count >= ADMIN_TAP_COUNT) {
      taps.count = 0;
      void navigate('/admin');
    }
  };

  const retryAuth = () => {
    if (isMiniProgram()) wxReLaunch();
    else window.location.reload();
  };

  return (
    <main className="home" data-testid={TESTIDS.homeScreenRoot}>
      <header className="home-top-bar">
        <h1 className="home-title">
          <button type="button" onClick={tapTitle}>
            狼人面杀电子裁判助手
          </button>
        </h1>
        <Link
          to="/settings"
          className="home-account"
          aria-label="设置"
          data-testid={TESTIDS.homeSettingsButton}
        >
          {user ? (
            <Avatar userId={user.id} avatarUrl={user.avatarUrl} size={36} />
          ) : (
            <IconPersonCircleOutline className="home-account-placeholder" aria-hidden />
          )}
        </Link>
      </header>

      {user && (
        <p className="visually-hidden" data-testid={TESTIDS.homeUserName}>
          {displayNameOf(user)}
        </p>
      )}

      {!authLoading && !user && authError && (
        <div className="home-auth-error" role="alert">
          <IconCloudOfflineOutline aria-hidden />
          <span className="home-auth-error-text">
            <strong>网络异常</strong>
            <span>登录失败，请检查网络后重试</span>
          </span>
          <button type="button" className="home-auth-error-retry" onClick={retryAuth}>
            重试
          </button>
        </div>
      )}

      <div className="home-tasks">
        <section className="home-column">
          <button
            type="button"
            className="home-hero"
            disabled={authLoading}
            data-testid={TESTIDS.homeCreateRoomButton}
            onClick={() => void requireAuth(() => void navigate('/games?purpose=create'))}
          >
            <span className="home-hero-main">
              <span>
                <span className="home-hero-title">创建房间</span>
                <span className="home-hero-subtitle">
                  {`${GAME_MODE_OPTIONS.length} 款游戏 · 点开挑一款`}
                </span>
              </span>
              <IconChevronForward className="home-hero-arrow" aria-hidden />
            </span>
            <span className="home-hero-icons" aria-hidden>
              {HERO_ICONS.map((option) => (
                <span key={option.gameType} className="home-hero-icon">
                  {option.artUrl ? (
                    <img src={option.artUrl} alt="" decoding="async" />
                  ) : (
                    <option.Icon />
                  )}
                </span>
              ))}
              {HERO_OVERFLOW > 0 && <span className="home-hero-icon">{`+${HERO_OVERFLOW}`}</span>}
            </span>
          </button>

          <div className="home-actions">
            <button
              type="button"
              className="home-action"
              disabled={authLoading}
              data-testid={TESTIDS.homeEnterRoomButton}
              onClick={() => void requireAuth(() => setDialog('join'))}
            >
              <IconLogInOutline className="home-action-icon" aria-hidden />
              <span className="home-action-title">进入房间</span>
              <span className="home-action-subtitle">输入房间号</span>
            </button>
            <button
              type="button"
              className="home-action"
              disabled={authLoading || recentRooms.length === 0}
              data-testid={TESTIDS.homeReturnLastGameButton}
              onClick={() => void requireAuth(() => setDialog('recent'))}
            >
              <IconTimeOutline className="home-action-icon" aria-hidden />
              <span className="home-action-title">最近房间</span>
              <span className="home-action-subtitle">
                {recentRooms.length > 0 ? `${recentRooms.length} 个房间` : '无记录'}
              </span>
            </button>
          </div>
        </section>

        <section className="home-column">
          <Link to="/gacha" className="home-card">
            <span className="home-card-emoji" aria-hidden>
              🎰
            </span>
            <span className="home-card-text">
              <span className="home-card-title">扭蛋抽奖</span>
              <span className="home-card-subtitle">用抽奖券解锁头像、头像框、装饰</span>
            </span>
            <IconChevronForward aria-hidden />
          </Link>

          {GAME_HOME_SPOTLIGHTS.map((spotlight) => (
            <Suspense key={spotlight.gameType} fallback={null}>
              <spotlight.Spotlight />
            </Suspense>
          ))}
        </section>
      </div>

      <footer className="home-footer">{`${APP_VERSION} · 作者：严振宇`}</footer>

      <JoinRoomDialog open={dialog === 'join'} onClose={() => setDialog(null)} onJoin={joinRoom} />
      {user && (
        <RecentRoomsDialog
          open={dialog === 'recent'}
          ownerUserId={user.id}
          rooms={recentRooms}
          onClose={() => setDialog(null)}
          onJoin={joinRoom}
        />
      )}
    </main>
  );
}
