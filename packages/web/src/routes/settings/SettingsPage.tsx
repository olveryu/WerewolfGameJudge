import './SettingsPage.css';

import {
  type FormEvent,
  type ReactNode,
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
import { COLLECTION_PREVIEW_NOTICE } from '@/features/auth/guestPolicy';
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
import IconColorPaletteOutline from '~icons/ion/color-palette-outline';
import IconCopyOutline from '~icons/ion/copy-outline';
import IconGiftOutline from '~icons/ion/gift-outline';
import IconInformationCircleOutline from '~icons/ion/information-circle-outline';
import IconKeyOutline from '~icons/ion/key-outline';
import IconLinkOutline from '~icons/ion/link-outline';
import IconLockClosed from '~icons/ion/lock-closed';
import IconLogOutOutline from '~icons/ion/log-out-outline';
import IconMailOutline from '~icons/ion/mail-outline';
import IconPencil from '~icons/ion/pencil';
import IconPersonOutline from '~icons/ion/person-outline';
import IconShirtOutline from '~icons/ion/shirt-outline';
import IconSparklesOutline from '~icons/ion/sparkles-outline';
import IconStatsChartOutline from '~icons/ion/stats-chart-outline';
import IconSwapHorizontalOutline from '~icons/ion/swap-horizontal-outline';

import { GrowthXpBar, UnlocksEntry } from './GrowthSection';

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

interface EntryBodyProps {
  readonly icon: ReactNode;
  readonly label: string;
  readonly hint?: string;
  /** Shown before the chevron (a badge). */
  readonly trailing?: ReactNode;
}

/** The content of a settings list row: icon, label with an optional hint, trailing, chevron. */
function EntryBody({ icon, label, hint, trailing }: EntryBodyProps) {
  return (
    <>
      <span className="settings-entry-icon">{icon}</span>
      <span className="settings-entry-text">
        <span>{label}</span>
        {hint !== undefined && <span className="settings-entry-hint">{hint}</span>}
      </span>
      {trailing}
      <IconChevronForward className="settings-entry-chevron" aria-hidden />
    </>
  );
}

/** A settings list row that opens another page. */
function LinkEntry({ to, ...body }: EntryBodyProps & { readonly to: string }) {
  return (
    <Link className="settings-entry" to={to}>
      <EntryBody {...body} />
    </Link>
  );
}

interface ActionEntryProps extends EntryBodyProps {
  readonly onClick: () => void;
  /** `danger` paints the row in the error colour (sign out). */
  readonly tone?: 'danger';
  /** Blocks presses while the action runs. */
  readonly busy?: boolean;
}

/** A settings list row that runs an action. */
function ActionEntry({ onClick, tone, busy = false, ...body }: ActionEntryProps) {
  return (
    <button
      type="button"
      className="settings-entry"
      data-tone={tone}
      disabled={busy}
      aria-busy={busy}
      onClick={onClick}
    >
      <EntryBody {...body} />
    </button>
  );
}

/** Gacha entry with the unused-ticket badge, kept in the room when settings was opened from one. */
function GachaEntry() {
  const { roomCode } = useParams();
  const { data: gachaStatus } = useGachaStatusQuery();
  const ticketCount = gachaStatus ? gachaStatus.normalDraws + gachaStatus.goldenDraws : 0;
  return (
    <LinkEntry
      to={roomCode === undefined ? '/gacha' : `/gacha/${roomCode}`}
      icon={<IconGiftOutline aria-hidden />}
      label="扭蛋抽奖"
      trailing={
        ticketCount > 0 && (
          <span className="settings-entry-badge">
            {ticketCount > MAX_TICKET_BADGE_COUNT ? `${MAX_TICKET_BADGE_COUNT}+` : ticketCount}
          </span>
        )
      }
    />
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

/** Anonymous-user collection preview. */
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
      <p className="settings-teaser-text">{COLLECTION_PREVIEW_NOTICE}</p>
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

  const hasCollectionEntries = !user.isAnonymous || growthStats !== undefined;
  const showBindEmail = canSwitchAccount && !user.email && !inMiniProgram;
  const showMiniProgramBind = canSwitchAccount && !user.email && inMiniProgram && !user.isAnonymous;
  const showSwitchAccount = canSwitchAccount && !isChangingPassword && !inMiniProgram;
  const showLogOut = !isInRoom && !isChangingPassword && !inMiniProgram;
  const hasAccountEntries =
    showBindEmail || showMiniProgramBind || !!user.email || showSwitchAccount || showLogOut;

  return (
    <>
      <section className="settings-card" aria-label="个人资料">
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
        {growthStats && <GrowthXpBar stats={growthStats} />}
      </section>

      {hasCollectionEntries && (
        <section className="settings-card">
          <h2 className="settings-card-title">
            <IconColorPaletteOutline aria-hidden /> 形象与收藏
          </h2>
          <div className="settings-list">
            {!user.isAnonymous && (
              <LinkEntry
                to={appearancePath}
                icon={<IconShirtOutline aria-hidden />}
                label="更换头像与装扮"
              />
            )}
            {growthStats && <UnlocksEntry stats={growthStats} />}
            {!user.isAnonymous && <GachaEntry />}
          </div>
        </section>
      )}

      {growthStats && (
        <section className="settings-card">
          <h2 className="settings-card-title">
            <IconStatsChartOutline aria-hidden /> 战绩
          </h2>
          <Suspense fallback={<Spinner label="加载战绩" />}>
            {GAME_ACCOUNT_STATS_SECTIONS.map((statsSection) => (
              <statsSection.Section key={statsSection.gameType} userId={user.id} />
            ))}
          </Suspense>
        </section>
      )}

      {hasAccountEntries && (
        <section className="settings-card">
          <h2 className="settings-card-title">
            <IconPersonOutline aria-hidden /> 账户
          </h2>
          <div className="settings-list">
            {showMiniProgramBind && (
              <>
                <ActionEntry
                  icon={<IconLinkOutline aria-hidden />}
                  label="绑定已有账号"
                  hint="输入之前注册的邮箱和密码，恢复昵称、头像等数据"
                  onClick={() => bindEmail('绑定已有账号', true)}
                />
                <ActionEntry
                  icon={<IconMailOutline aria-hidden />}
                  label="注册新邮箱"
                  hint="绑定后可在网页端登录，数据不丢失"
                  onClick={() => bindEmail('注册新邮箱')}
                />
              </>
            )}
            {showBindEmail && (
              <ActionEntry
                icon={<IconMailOutline aria-hidden />}
                label="绑定邮箱"
                onClick={() => bindEmail('绑定邮箱')}
              />
            )}
            {user.email &&
              (isChangingPassword ? (
                <ChangePasswordForm onDone={() => setIsChangingPassword(false)} />
              ) : (
                <ActionEntry
                  icon={<IconKeyOutline aria-hidden />}
                  label="修改密码"
                  onClick={() => setIsChangingPassword(true)}
                />
              ))}
            {showSwitchAccount && (
              <ActionEntry
                icon={<IconSwapHorizontalOutline aria-hidden />}
                label="切换账号"
                onClick={switchAccount}
              />
            )}
            {showLogOut && (
              <ActionEntry
                icon={<IconLogOutOutline aria-hidden />}
                label="登出"
                tone="danger"
                busy={signOut.isPending}
                onClick={() => void logOut()}
              />
            )}
          </div>
        </section>
      )}
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
 * Settings: a profile card, then grouped lists — appearance and collection entries, per-game
 * stats, account actions, display preferences (decorations, frame rate) and about. Opened from a
 * room (`/settings/:roomCode`), it returns to that room and applies account changes to the room.
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
        {user ? (
          <AccountSection user={user} />
        ) : (
          !loading && (
            <section className="settings-card">
              <h2 className="settings-card-title">
                <IconPersonOutline aria-hidden /> 账户
              </h2>
              <LoginOptions
                onEmail={(isSignUp) =>
                  void requestLogin({
                    title: isSignUp ? '邮箱注册' : '邮箱登录',
                    startWith: isSignUp ? 'emailSignUp' : 'emailSignIn',
                  })
                }
                onBrowseAvatars={() => void navigate(appearancePath)}
              />
            </section>
          )
        )}
        <DisplaySection />
        <AboutSection />
      </main>
    </div>
  );
}
