import './HomePage.css';

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Avatar } from '@/components/avatar/Avatar';
import { APP_VERSION } from '@/config/version';
import { useAuthContext, type User } from '@/contexts/AuthContext';
import { requestLogin } from '@/features/auth/loginRequests';
import {
  hasSeenAnnouncement,
  markAnnouncementSeen,
} from '@/features/home/services/announcementReceiptStore';
import { gameGuidePath } from '@/features/navigation/model/gamePaths';
import { getRecentRooms } from '@/features/room/services/recentRooms';
import { GAME_ANNOUNCEMENT_TABS, GAME_HOME_SPOTLIGHTS, GAME_MODE_OPTIONS } from '@/games/catalog';
import { TESTIDS } from '@/testids';
import { handleError } from '@/utils/errorPipeline';
import { homeLog } from '@/utils/logger';
import { isMiniProgram, wxReLaunch } from '@/utils/miniProgram';
import IconBookOutline from '~icons/ion/book-outline';
import IconChevronForward from '~icons/ion/chevron-forward';
import IconCloudOfflineOutline from '~icons/ion/cloud-offline-outline';
import IconLogInOutline from '~icons/ion/log-in-outline';
import IconMegaphoneOutline from '~icons/ion/megaphone-outline';
import IconPersonCircleOutline from '~icons/ion/person-circle-outline';
import IconTimeOutline from '~icons/ion/time-outline';

import { AnnouncementCardText } from './AnnouncementCardText';
// The dialogs (and Ark UI's dialog machinery) load on first open, outside the start-up budget.
const JoinRoomDialog = lazy(async () => ({
  default: (await import('./JoinRoomDialog')).JoinRoomDialog,
}));
const RecentRoomsDialog = lazy(async () => ({
  default: (await import('./RecentRoomsDialog')).RecentRoomsDialog,
}));
const AnnouncementCardStatus = lazy(async () => ({
  default: (await import('./AnnouncementCardStatus')).AnnouncementCardStatus,
}));
const AnnouncementModal = lazy(async () => ({
  default: (await import('./AnnouncementModal')).AnnouncementModal,
}));
const TicketBadge = lazy(async () => ({
  default: (await import('./TicketBadge')).TicketBadge,
}));
// The install prompt is captured at boot, so the footer entry can load after Home is interactive.
const InstallMenuItem = lazy(async () => ({
  default: (await import('./InstallMenuItem')).InstallMenuItem,
}));

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

/**
 * Home: create or join a room, recent rooms, game guide, gacha entry, game spotlights,
 * announcements and feedback, PWA install, and account.
 */
export function HomePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, error: authError } = useAuthContext();
  const [dialog, setDialog] = useState<'join' | 'recent' | null>(null);
  // Like the announcement modal: mounted on first open, then kept for the exit motion.
  const [dialogsMounted, setDialogsMounted] = useState(false);
  const openDialog = (kind: 'join' | 'recent') => {
    setDialogsMounted(true);
    setDialog(kind);
  };
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  // The lazy modal mounts on first open and stays mounted so its exit motion can finish.
  const [announcementMounted, setAnnouncementMounted] = useState(false);
  const adminTaps = useRef({ count: 0, lastTapMs: 0 });
  const recentRooms = user === null ? [] : getRecentRooms(user.id);

  const openAnnouncement = () => {
    setAnnouncementMounted(true);
    setAnnouncementOpen(true);
  };

  const closeAnnouncement = () => {
    setAnnouncementOpen(false);
    markAnnouncementSeen(APP_VERSION);
  };

  // Auto-shows this version's announcement once auth settles; the content loads on demand so
  // the changelog stays out of the Home chunk.
  useEffect(() => {
    if (authLoading || hasSeenAnnouncement(APP_VERSION)) return;
    let cancelled = false;
    import('@/config/announcements').then(
      (announcements) => {
        if (cancelled) return;
        if (announcements.ANNOUNCEMENTS[APP_VERSION]) {
          setAnnouncementMounted(true);
          setAnnouncementOpen(true);
        } else {
          markAnnouncementSeen(APP_VERSION);
        }
      },
      (error: unknown) => {
        handleError(error, { label: '加载公告', logger: homeLog });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [authLoading]);

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

  const openGuide = () => {
    const [soleOption] = GAME_MODE_OPTIONS;
    if (GAME_MODE_OPTIONS.length === 1 && soleOption) {
      void navigate(gameGuidePath(soleOption.gameType, null));
      return;
    }
    void navigate('/games?purpose=guide');
  };

  const retryAuth = () => {
    if (isMiniProgram()) wxReLaunch();
    else window.location.reload();
  };

  return (
    <main data-testid={TESTIDS.homeScreenRoot}>
      <header className="home-top-bar">
        <h1 className="home-title">
          <button type="button" onClick={tapTitle}>
            狼人面杀电子裁判助手
          </button>
        </h1>
        <div className="home-top-actions">
          <button
            type="button"
            className="home-guide"
            aria-label="游戏图鉴"
            data-testid={TESTIDS.homeGuideButton}
            onClick={openGuide}
          >
            <IconBookOutline aria-hidden />
          </button>
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
            {user && (
              <Suspense fallback={null}>
                <TicketBadge />
              </Suspense>
            )}
          </Link>
        </div>
      </header>

      {user && (
        <p className="visually-hidden" data-testid={TESTIDS.homeUserName}>
          {displayNameOf(user)}
        </p>
      )}

      <div className="home-body">
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
                onClick={() => void requireAuth(() => openDialog('join'))}
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
                onClick={() => void requireAuth(() => openDialog('recent'))}
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

            <button
              type="button"
              className="home-card"
              data-accent="primary"
              onClick={openAnnouncement}
            >
              <IconMegaphoneOutline className="home-card-icon" aria-hidden />
              <Suspense fallback={<AnnouncementCardText />}>
                <AnnouncementCardStatus />
              </Suspense>
              <IconChevronForward aria-hidden />
            </button>
          </section>
        </div>

        <footer className="home-footer">
          <span>{`${APP_VERSION} · 作者：严振宇`}</span>
          <Suspense fallback={null}>
            <InstallMenuItem />
          </Suspense>
        </footer>
      </div>

      {announcementMounted && (
        <Suspense fallback={null}>
          <AnnouncementModal
            open={announcementOpen}
            gameTabs={GAME_ANNOUNCEMENT_TABS}
            onClose={closeAnnouncement}
          />
        </Suspense>
      )}

      {dialogsMounted && (
        <Suspense fallback={null}>
          <JoinRoomDialog
            open={dialog === 'join'}
            onClose={() => setDialog(null)}
            onJoin={joinRoom}
          />
          {user && (
            <RecentRoomsDialog
              open={dialog === 'recent'}
              ownerUserId={user.id}
              rooms={recentRooms}
              onClose={() => setDialog(null)}
              onJoin={joinRoom}
            />
          )}
        </Suspense>
      )}
    </main>
  );
}
