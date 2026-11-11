import './SettingsPage.css';

import {
  type FormEvent,
  Suspense,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

import { HAND_DRAWN_PORTRAITS } from '@/components/avatar/avatarSources';
import { Button } from '@/components/Button';
import { NameStyleText } from '@/components/nameStyles/NameStyleText';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Spinner } from '@/components/Spinner';
import { Switch } from '@/components/Switch';
import { DEVELOPER_WECHAT_ID } from '@/config/announcements';
import { APP_VERSION } from '@/config/version';
import { useAuthContext, type User } from '@/contexts/AuthContext';
import {
  refreshSavedProfile,
  useChangePassword,
  useUpdateProfile,
} from '@/features/account/accountMutations';
import { useUserStatsQuery } from '@/features/account/queries/useUserStatsQuery';
import { syncActiveRoomProfile } from '@/features/account/syncActiveRoomProfile';
import { useSignOut } from '@/features/auth/authMutations';
import { LoginOptions } from '@/features/auth/LoginDialog';
import { requestLogin } from '@/features/auth/loginRequests';
import { useGachaStatusQuery } from '@/features/gacha/queries/useGachaQuery';
import {
  ResidentAvatarTile,
  ResidentSceneLayer,
} from '@/features/product/components/ResidentPreview';
import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/link/roomCommandResult';
import type { RoomProfilePatch } from '@/features/room/model/RoomAccountCapability';
import { roomPath } from '@/features/room/navigation/roomFlowNavigation';
import { clearRecentRooms } from '@/features/room/services/recentRooms';
import { displaySettings } from '@/features/settings/displaySettings';
import { isExpectedStorageError } from '@/features/settings/services/userSettingsStorage';
import { GAME_ACCOUNT_STATS_SECTIONS } from '@/games/catalog';
import { useActiveRoomAccount } from '@/games/clientModules';
import { resolveResidentDecorations } from '@/scene/residentDecorations';
import type { SceneFrameRate } from '@/scene/stage';
import { TESTIDS } from '@/testids';
import { showPrompt } from '@/utils/alert';
import { showDestructiveAlert, showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { getUserFacingMessage, isExpectedError, translateReasonCode } from '@/utils/errorUtils';
import { createLogger } from '@/utils/logger';
import { isMiniProgram } from '@/utils/miniProgram';
import IconCameraOutline from '~icons/ion/camera-outline';
import IconChevronForward from '~icons/ion/chevron-forward';
import IconCopyOutline from '~icons/ion/copy-outline';
import IconGiftOutline from '~icons/ion/gift-outline';
import IconInformationCircleOutline from '~icons/ion/information-circle-outline';
import IconLockClosed from '~icons/ion/lock-closed';
import IconPencil from '~icons/ion/pencil';
import IconPersonOutline from '~icons/ion/person-outline';
import IconSparklesOutline from '~icons/ion/sparkles-outline';

import { GrowthSection } from './GrowthSection';

// Growth details pull in the engine growth and reward catalogs; keep them out of the page chunk.

const settingsLog = createLogger('Settings');
const MIN_PASSWORD_LENGTH = 6;
const FRAME_RATE_OPTIONS: readonly SceneFrameRate[] = [60, 30];

/** The appearance page, kept in the room when settings was opened from one. */
function useAppearancePath(): string {
  const { roomCode } = useParams();
  return roomCode === undefined ? '/appearance' : `/appearance/${roomCode}`;
}

/** Badge counts above this show as `99+`. */
const MAX_TICKET_BADGE_COUNT = 99;

/** Gacha entry with the unused-ticket badge, kept in the room when settings was opened from one. */
function GachaEntry() {
  const { roomCode } = useParams();
  const { data: gachaStatus } = useGachaStatusQuery();
  const ticketCount = gachaStatus ? gachaStatus.normalDraws + gachaStatus.goldenDraws : 0;
  return (
    <Link className="settings-entry" to={roomCode === undefined ? '/gacha' : `/gacha/${roomCode}`}>
      <span className="settings-entry-label">
        <IconGiftOutline aria-hidden />
        <span>扭蛋抽奖</span>
      </span>
      <span className="settings-entry-label">
        {ticketCount > 0 && (
          <span className="settings-entry-badge">
            {ticketCount > MAX_TICKET_BADGE_COUNT ? `${MAX_TICKET_BADGE_COUNT}+` : ticketCount}
          </span>
        )}
        <IconChevronForward className="settings-entry-chevron" aria-hidden />
      </span>
    </Link>
  );
}

/** Number of portraits shown in the anonymous-user preview strip. */
const PREVIEW_STRIP_COUNT = 4;
/** Evenly spaced portraits for the anonymous-user preview strip. */
const PREVIEW_STRIP_PORTRAITS = (() => {
  const step = Math.floor(HAND_DRAWN_PORTRAITS.length / PREVIEW_STRIP_COUNT);
  return Array.from({ length: PREVIEW_STRIP_COUNT }, (_, index) => {
    const portrait = HAND_DRAWN_PORTRAITS[index * step];
    if (portrait === undefined) {
      throw new Error(`[FAIL-FAST] Missing hand-drawn portrait at index ${index * step}`);
    }
    return portrait;
  });
})();

/** Anonymous-user teaser: what binding an email unlocks. */
function AvatarTeaser() {
  const appearancePath = useAppearancePath();
  return (
    <div className="settings-teaser">
      <div className="settings-teaser-strip">
        {PREVIEW_STRIP_PORTRAITS.map((portrait) => (
          <img key={portrait} className="settings-teaser-item" src={portrait} alt="" />
        ))}
        <span className="settings-teaser-lock">
          <IconLockClosed aria-hidden />
        </span>
      </div>
      <p className="settings-teaser-text">
        {`绑定邮箱，解锁 ${HAND_DRAWN_PORTRAITS.length} 款暗黑头像、自定义昵称和头像框`}
      </p>
      <Link className="settings-teaser-link" to={appearancePath}>
        浏览全部头像 ›
      </Link>
    </div>
  );
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const changePassword = useChangePassword();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!oldPassword) return setError('请输入旧密码');
    if (!newPassword) return setError('请输入新密码');
    if (newPassword.length < MIN_PASSWORD_LENGTH) return setError('新密码至少 6 个字符');
    if (newPassword !== confirmPassword) return setError('两次输入的新密码不一致');
    if (newPassword === oldPassword) return setError('新密码不能与旧密码相同');
    setError(null);
    try {
      await changePassword.mutateAsync({ oldPassword, newPassword });
      toast.success('密码已修改');
      onDone();
    } catch (caught: unknown) {
      setError(getUserFacingMessage(caught));
    }
  };

  return (
    <form className="settings-form" onSubmit={(event) => void submit(event)}>
      <input
        className="text-input"
        type="password"
        placeholder="旧密码"
        autoComplete="current-password"
        value={oldPassword}
        onChange={(event) => setOldPassword(event.target.value)}
      />
      <input
        className="text-input"
        type="password"
        placeholder="新密码（至少 6 位）"
        autoComplete="new-password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
      />
      <input
        className="text-input"
        type="password"
        placeholder="确认新密码"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
      />
      {error && <p className="settings-error">{error}</p>}
      <div className="settings-row-actions">
        <Button variant="secondary" onClick={onDone}>
          取消
        </Button>
        <Button type="submit" loading={changePassword.isPending}>
          确认修改
        </Button>
      </div>
    </form>
  );
}

function AccountSection({ user }: { user: User }) {
  const { refreshUser } = useAuthContext();
  const updateProfile = useUpdateProfile();
  const { data: growthStats } = useUserStatsQuery();
  const appearancePath = useAppearancePath();
  const signOut = useSignOut();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const sceneHostRef = useRef<HTMLDivElement>(null);
  const inMiniProgram = isMiniProgram();
  const activeRoom = useActiveRoomAccount();
  const isInRoom = activeRoom.phase !== 'idle';
  const { canSwitchAccount } = activeRoom;

  /** Pushes a saved profile change into the active room; warns and returns false on failure. */
  const syncRoomProfile = async (patch: RoomProfilePatch) => {
    const synced = await syncActiveRoomProfile(activeRoom, patch);
    if (!synced) toast.warning('资料已保存，房间内同步失败');
    return synced;
  };

  // Binding an email upgrades the guest in place; the room still shows the guest profile.
  const wasAnonymous = useRef(user.isAnonymous);
  const syncUpgradedProfile = useEffectEvent(() => {
    settingsLog.info('Anonymous→email upgrade detected, syncing profile to the room');
    void syncRoomProfile({
      displayName: user.displayName ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
    });
  });
  useEffect(() => {
    if (wasAnonymous.current && !user.isAnonymous) syncUpgradedProfile();
    wasAnonymous.current = user.isAnonymous;
  }, [user.isAnonymous]);

  const editName = () => {
    showPrompt('修改昵称', {
      placeholder: '请输入昵称',
      defaultValue: user.displayName ?? '',
      onConfirm: (value) => {
        void (async () => {
          const displayName = value.trim();
          if (!displayName) {
            toast.warning('请输入名字');
            return;
          }
          try {
            await updateProfile.mutateAsync({ displayName });
            const refreshed = await refreshSavedProfile(refreshUser);
            const roomSynced = await syncRoomProfile({ displayName });
            if (!refreshed) toast.warning('昵称已保存，资料刷新失败');
            else if (roomSynced) toast.success('昵称已更新');
          } catch (error: unknown) {
            settingsLog.error('Update name failed', error);
            showErrorAlert('更新失败', getUserFacingMessage(error));
          }
        })();
      },
    });
  };

  const bindEmail = (formTitle: string, hideDisplayName = false) => {
    void requestLogin({
      title: formTitle,
      startWith: 'emailSignUp',
      formTitle,
      showToggleMode: false,
      showSuccessOnLogin: true,
      hideDisplayName,
    });
  };

  /** Switching while seated leaves the seat first, so the room never keeps the old account seated. */
  const switchAccount = () => {
    const open = async () => {
      try {
        if (activeRoom.phase !== 'idle' && activeRoom.isSeated) {
          const result = await activeRoom.leaveSeat();
          if (!isSuccessfulRoomCommand(result)) {
            showErrorAlert('离座失败', translateReasonCode(getRoomCommandFailureReason(result)));
            return;
          }
        }
        await requestLogin({
          title: '切换账号',
          startWith: 'emailSignIn',
          signOutFirst: true,
          showSuccessOnLogin: true,
        });
      } catch (error: unknown) {
        handleError(error, {
          label: '切换账号',
          logger: settingsLog,
          feedback: false,
          isExpected: isExpectedError,
        });
        showErrorAlert('切换失败', getUserFacingMessage(error));
      }
    };
    if (user.isAnonymous) {
      showDestructiveAlert(
        '切换账号',
        '匿名数据将无法恢复，确定切换账号？',
        '切换',
        () => void open(),
      );
    } else {
      void open();
    }
  };

  const logOut = async () => {
    try {
      await signOut.mutateAsync();
      clearRecentRooms(user.id);
    } catch (error: unknown) {
      settingsLog.error('Sign out failed', error);
      showErrorAlert('退出失败', getUserFacingMessage(error));
    }
  };

  return (
    <>
      <ResidentSceneLayer hostRef={sceneHostRef} />
      <div className="settings-profile">
        <Link className="settings-avatar" to={appearancePath} aria-label="更换头像">
          <ResidentAvatarTile
            userId={user.id}
            avatarUrl={user.avatarUrl}
            residents={resolveResidentDecorations({
              avatarFrame: user.avatarFrame ?? undefined,
              seatFlair: user.seatFlair ?? undefined,
            })}
            sceneHostRef={sceneHostRef}
          />
          {!user.isAnonymous && (
            <span className="settings-avatar-badge">
              <IconCameraOutline aria-hidden />
            </span>
          )}
        </Link>
        <div className="settings-profile-text">
          {user.isAnonymous ? (
            <span className="settings-name">匿名用户</span>
          ) : (
            <span className="settings-name-row">
              <button type="button" className="settings-name" onClick={editName}>
                {user.displayName === null ? (
                  '点击设置名字'
                ) : (
                  <NameStyleText styleId={user.nameStyle}>{user.displayName}</NameStyleText>
                )}
                <IconPencil aria-hidden />
              </button>
              {growthStats && <span className="settings-level">{`Lv.${growthStats.level}`}</span>}
            </span>
          )}
          <span className="settings-status">
            <span className="settings-status-dot" />
            {user.isAnonymous ? '匿名登录' : user.email ? '邮箱登录' : '微信登录'}
          </span>
          {user.email && <span className="settings-email">{user.email}</span>}
        </div>
      </div>

      {user.isAnonymous && <AvatarTeaser />}

      {growthStats && (
        <Suspense fallback={<Spinner label="加载成长数据" />}>
          <GrowthSection stats={growthStats} />
          {GAME_ACCOUNT_STATS_SECTIONS.map((statsSection) => (
            <statsSection.Section key={statsSection.gameType} userId={user.id} />
          ))}
        </Suspense>
      )}

      {!user.isAnonymous && (
        <>
          <Link className="settings-entry" to={appearancePath}>
            <span>更换头像与装扮</span>
            <IconChevronForward aria-hidden />
          </Link>
          <GachaEntry />
        </>
      )}

      {canSwitchAccount && !user.email && inMiniProgram && !user.isAnonymous && (
        <>
          <button
            type="button"
            className="settings-entry"
            onClick={() => bindEmail('绑定已有账号', true)}
          >
            <span className="settings-entry-text">
              <span>绑定已有账号</span>
              <span className="settings-entry-hint">
                输入之前注册的邮箱和密码，恢复昵称、头像等数据
              </span>
            </span>
            <IconChevronForward aria-hidden />
          </button>
          <button type="button" className="settings-entry" onClick={() => bindEmail('注册新邮箱')}>
            <span className="settings-entry-text">
              <span>注册新邮箱</span>
              <span className="settings-entry-hint">绑定后可在网页端登录，数据不丢失</span>
            </span>
            <IconChevronForward aria-hidden />
          </button>
        </>
      )}

      <div className="settings-actions">
        {canSwitchAccount && !user.email && !inMiniProgram && (
          <Button variant="secondary" onClick={() => bindEmail('绑定邮箱')}>
            绑定邮箱
          </Button>
        )}
        {user.email &&
          (isChangingPassword ? (
            <ChangePasswordForm onDone={() => setIsChangingPassword(false)} />
          ) : (
            <Button variant="secondary" onClick={() => setIsChangingPassword(true)}>
              修改密码
            </Button>
          ))}
        {canSwitchAccount && !isChangingPassword && !inMiniProgram && (
          <Button variant="secondary" onClick={switchAccount}>
            切换账号
          </Button>
        )}
        {!isInRoom && !isChangingPassword && !inMiniProgram && (
          <Button
            variant="secondary"
            className="settings-logout"
            loading={signOut.isPending}
            onClick={() => void logOut()}
          >
            登出
          </Button>
        )}
      </div>
    </>
  );
}

function DisplaySection() {
  const settings = useSyncExternalStore(displaySettings.subscribe, displaySettings.getSnapshot);

  const save = (write: () => void) => {
    try {
      write();
    } catch (error: unknown) {
      handleError(error, {
        label: '保存显示设置',
        logger: settingsLog,
        alertMessage: '设置未保存，请检查浏览器存储权限后重试',
        isExpected: isExpectedStorageError,
      });
    }
  };

  return (
    <section className="settings-card">
      <h2 className="settings-card-title">
        <IconSparklesOutline aria-hidden /> 显示
      </h2>
      <label className="settings-row">
        <span className="settings-row-text">
          <span>座位装饰</span>
          <span className="settings-row-hint">房间内的座位光效、宠物与入座动画；关闭可省电</span>
        </span>
        <Switch
          checked={settings.seatDecorationsEnabled}
          data-testid={TESTIDS.settingsSeatDecorationsSwitch}
          onChange={(event) =>
            save(() => displaySettings.setSeatDecorationsEnabled(event.target.checked))
          }
        />
      </label>
      <fieldset className="settings-row settings-fieldset">
        <legend className="settings-row-text">
          <span>动画帧率</span>
          <span className="settings-row-hint">座位装饰和特效的帧率；30 帧更省电</span>
        </legend>
        <span className="segmented">
          {FRAME_RATE_OPTIONS.map((frameRate) => (
            <label key={frameRate} className="segmented-option">
              <input
                type="radio"
                name="scene-frame-rate"
                checked={settings.sceneFrameRate === frameRate}
                onChange={() => save(() => displaySettings.setSceneFrameRate(frameRate))}
              />
              <span>{`${frameRate} 帧`}</span>
            </label>
          ))}
        </span>
      </fieldset>
    </section>
  );
}

function AboutSection() {
  const copyWechat = async () => {
    await navigator.clipboard.writeText(DEVELOPER_WECHAT_ID);
    toast.success('已复制微信号');
  };
  return (
    <section className="settings-card">
      <h2 className="settings-card-title">
        <IconInformationCircleOutline aria-hidden /> 关于
      </h2>
      <div className="settings-row">
        <span className="settings-row-hint">版本</span>
        <span>{APP_VERSION}</span>
      </div>
      <div className="settings-row">
        <span className="settings-row-hint">联系微信</span>
        <span className="settings-copy">
          {DEVELOPER_WECHAT_ID}
          <button type="button" aria-label="复制微信号" onClick={() => void copyWechat()}>
            <IconCopyOutline aria-hidden />
          </button>
        </span>
      </div>
    </section>
  );
}

/**
 * Settings: account (profile, appearance and unlocks entries, growth and per-game stats), display preferences
 * (decorations, frame rate) and about. Opened from a room (`/settings/:roomCode`), it returns to
 * that room and applies account changes to the room.
 */
export function SettingsPage() {
  const { user, loading } = useAuthContext();
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const appearancePath = useAppearancePath();
  return (
    <div className="settings-page">
      <ScreenHeader
        title="设置"
        parentPath={roomCode === undefined ? '/' : roomPath(roomCode)}
        backTestId={TESTIDS.settingsBackButton}
      />
      <main className="settings-content">
        <section className="settings-card">
          <h2 className="settings-card-title">
            <IconPersonOutline aria-hidden /> 账户
          </h2>
          {user ? (
            <AccountSection user={user} />
          ) : (
            !loading && (
              <LoginOptions
                onEmail={(isSignUp) =>
                  void requestLogin({
                    title: isSignUp ? '邮箱注册' : '邮箱登录',
                    startWith: isSignUp ? 'emailSignUp' : 'emailSignIn',
                  })
                }
                onBrowseAvatars={() => void navigate(appearancePath)}
              />
            )
          )}
        </section>
        <DisplaySection />
        <AboutSection />
      </main>
    </div>
  );
}
