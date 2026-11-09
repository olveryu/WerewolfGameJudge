import './SettingsPage.css';

import {
  type FormEvent,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';

import { Avatar } from '@/components/avatar/Avatar';
import { Button } from '@/components/Button';
import { NameStyleText } from '@/components/nameStyles/NameStyleText';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Switch } from '@/components/Switch';
import { APP_VERSION } from '@/config/version';
import { useAuthContext, type User } from '@/contexts/AuthContext';
import {
  refreshSavedProfile,
  useChangePassword,
  useUpdateProfile,
} from '@/features/account/accountMutations';
import { useSignOut } from '@/features/auth/authMutations';
import { LoginOptions } from '@/features/auth/LoginDialog';
import { requestLogin } from '@/features/auth/loginRequests';
import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/link/roomCommandResult';
import type { RoomProfilePatch } from '@/features/room/model/RoomAccountCapability';
import { roomPath } from '@/features/room/navigation/roomFlowNavigation';
import { clearRecentRooms } from '@/features/room/services/recentRooms';
import { displaySettings } from '@/features/settings/displaySettings';
import { isExpectedStorageError } from '@/features/settings/services/userSettingsStorage';
import { useActiveRoomAccount } from '@/games/clientModules';
import type { SceneFrameRate } from '@/scene/stage';
import { TESTIDS } from '@/testids';
import { showPrompt } from '@/utils/alert';
import { showDestructiveAlert, showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { getUserFacingMessage, isExpectedError, translateReasonCode } from '@/utils/errorUtils';
import { createLogger } from '@/utils/logger';
import { isMiniProgram } from '@/utils/miniProgram';
import IconChevronForward from '~icons/ion/chevron-forward';
import IconCopyOutline from '~icons/ion/copy-outline';
import IconGiftOutline from '~icons/ion/gift-outline';
import IconInformationCircleOutline from '~icons/ion/information-circle-outline';
import IconPencil from '~icons/ion/pencil';
import IconPersonOutline from '~icons/ion/person-outline';
import IconSparklesOutline from '~icons/ion/sparkles-outline';

const settingsLog = createLogger('Settings');
const DEVELOPER_WECHAT_ID = 'olveryu';
const MIN_PASSWORD_LENGTH = 6;
const FRAME_RATE_OPTIONS: readonly SceneFrameRate[] = [60, 30];

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
  const signOut = useSignOut();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const inMiniProgram = isMiniProgram();
  const activeRoom = useActiveRoomAccount();
  const isInRoom = activeRoom.phase !== 'idle';
  const { canSwitchAccount } = activeRoom;

  /** Pushes a saved profile change into the active room; false when the room rejected it. */
  const syncActiveRoomProfile = async (patch: RoomProfilePatch): Promise<boolean> => {
    if (activeRoom.phase === 'idle' || !activeRoom.canSyncProfile) return true;
    try {
      const result = await activeRoom.updateProfile(patch);
      if (isSuccessfulRoomCommand(result)) return true;
      settingsLog.warn('Profile sync to active room rejected', {
        reason: getRoomCommandFailureReason(result),
      });
    } catch (error: unknown) {
      settingsLog.warn('Profile sync to active room failed', error);
    }
    toast.warning('资料已保存，房间内同步失败');
    return false;
  };

  // Binding an email upgrades the guest in place; the room still shows the guest profile.
  const wasAnonymous = useRef(user.isAnonymous);
  const syncUpgradedProfile = useEffectEvent(() => {
    settingsLog.info('Anonymous→email upgrade detected, syncing profile to the room');
    void syncActiveRoomProfile({
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
            const roomSynced = await syncActiveRoomProfile({ displayName });
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
      <div className="settings-profile">
        <Link to="/appearance" className="settings-avatar" aria-label="更换头像与装扮">
          <Avatar userId={user.id} avatarUrl={user.avatarUrl} size={72} />
        </Link>
        <div className="settings-profile-text">
          {user.isAnonymous ? (
            <span className="settings-name">匿名用户</span>
          ) : (
            <button type="button" className="settings-name" onClick={editName}>
              {user.displayName === null ? (
                '设置昵称'
              ) : (
                <NameStyleText styleId={user.nameStyle}>{user.displayName}</NameStyleText>
              )}
              <IconPencil aria-hidden />
            </button>
          )}
          <span className="settings-status">
            <span className="settings-status-dot" />
            {user.isAnonymous ? '匿名登录' : user.email ? '邮箱登录' : '微信登录'}
          </span>
          {user.email && <span className="settings-email">{user.email}</span>}
        </div>
      </div>

      {!user.isAnonymous && (
        <>
          <Link to="/appearance" className="settings-entry">
            <span>更换头像与装扮</span>
            <IconChevronForward aria-hidden />
          </Link>
          <Link to="/gacha" className="settings-entry">
            <span className="settings-entry-label">
              <IconGiftOutline aria-hidden />
              扭蛋抽奖
            </span>
            <IconChevronForward aria-hidden />
          </Link>
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
 * Settings: account, display preferences (decorations, frame rate) and about. Opened from a room
 * (`/settings/:roomCode`), it returns to that room and applies account changes to the room.
 */
export function SettingsPage() {
  const { user, loading } = useAuthContext();
  const { roomCode } = useParams();
  return (
    <div className="settings-page">
      <ScreenHeader title="设置" parentPath={roomCode === undefined ? '/' : roomPath(roomCode)} />
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
