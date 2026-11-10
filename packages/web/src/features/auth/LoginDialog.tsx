import './LoginDialog.css';

import { type FormEvent, useState, useSyncExternalStore } from 'react';
import { useMatches, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { HAND_DRAWN_PORTRAITS } from '@/components/avatar/avatarSources';
import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  useForgotPassword,
  useResetPassword,
  useSignInAnonymously,
  useSignInWithEmail,
  useSignOut,
  useSignUpWithEmail,
} from '@/features/auth/authMutations';
import { GUEST_GROWTH_NOTICE } from '@/features/auth/guestPolicy';
import {
  type LoginOutcome,
  type LoginRequest,
  loginRequestStore,
} from '@/features/auth/loginRequests';
import { clearRecentRooms } from '@/features/room/services/recentRooms';
import { TESTIDS } from '@/testids';
import { showErrorAlert } from '@/utils/alertPresets';
import { getUserFacingMessage } from '@/utils/errorUtils';
import { authLog } from '@/utils/logger';
import { isMiniProgram } from '@/utils/miniProgram';
import IconEyeOffOutline from '~icons/ion/eye-off-outline';
import IconEyeOutline from '~icons/ion/eye-outline';
import IconLockClosed from '~icons/ion/lock-closed';
import IconMailOutline from '~icons/ion/mail-outline';
import IconPersonOutline from '~icons/ion/person-outline';
import IconSparklesOutline from '~icons/ion/sparkles-outline';

const STRIP_COUNT = 5;
const UNLOCKED_COUNT = 3;
const STRIP_STEP = Math.floor(HAND_DRAWN_PORTRAITS.length / STRIP_COUNT);
const STRIP_PORTRAITS = Array.from({ length: STRIP_COUNT }, (_, index) => {
  const url = HAND_DRAWN_PORTRAITS[index * STRIP_STEP];
  if (url === undefined) throw new Error(`No portrait at strip slot ${index}`);
  return url;
});
const EMAIL_DOMAINS = ['@qq.com', '@163.com', '@gmail.com', '@icloud.com', '@outlook.com'];
const MIN_PASSWORD_LENGTH = 6;

type Step =
  | { kind: 'options' }
  | { kind: 'email'; isSignUp: boolean; email: string }
  | { kind: 'forgot'; email: string }
  | { kind: 'reset'; email: string };

function initialStep(request: LoginRequest): Step {
  switch (request.startWith ?? 'options') {
    case 'options':
      return { kind: 'options' };
    case 'emailSignIn':
      return { kind: 'email', isSignUp: false, email: '' };
    case 'emailSignUp':
      return { kind: 'email', isSignUp: true, email: '' };
  }
}

/**
 * The app's login dialog, opened through `requestLogin`: method list (email sign-up / sign-in,
 * anonymous), email form, and forgot / reset password. Anonymous login is hidden for guests and
 * inside the mini-program (which logs in through WeChat).
 */
export function LoginDialog() {
  const pending = useSyncExternalStore(loginRequestStore.subscribe, loginRequestStore.getSnapshot);
  return (
    <CenterDialog
      open={pending !== null}
      onClose={() => pending?.settle('cancelled')}
      title={pending?.request.title ?? ''}
      subtitle={pending?.request.subtitle}
    >
      {pending && (
        <LoginFlow key={pending.request.title} request={pending.request} settle={pending.settle} />
      )}
    </CenterDialog>
  );
}

type SettleLogin = (outcome: LoginOutcome) => void;

function LoginFlow({ request, settle }: { request: LoginRequest; settle: SettleLogin }) {
  const [step, setStep] = useState<Step>(() => initialStep(request));
  const navigate = useNavigate();
  // The dialog sits outside the page routes; a room page's code keeps the wardrobe in that room.
  const roomCode = useMatches().at(-1)?.params.roomCode;
  const browseAvatars = () => {
    settle('cancelled');
    void navigate(roomCode === undefined ? '/appearance' : `/appearance/${roomCode}`);
  };
  switch (step.kind) {
    case 'options':
      return (
        <LoginOptions
          onEmail={(isSignUp) => setStep({ kind: 'email', isSignUp, email: '' })}
          onBrowseAvatars={browseAvatars}
          onSignedIn={() => settle('signedIn')}
          onCancel={() => settle('cancelled')}
        />
      );
    case 'email':
      return (
        <EmailForm
          key={String(step.isSignUp)}
          request={request}
          step={step}
          onStep={setStep}
          settle={settle}
        />
      );
    case 'forgot':
      return <ForgotPasswordForm initialEmail={step.email} onStep={setStep} />;
    case 'reset':
      return <ResetPasswordForm email={step.email} onStep={setStep} />;
  }
}

interface LoginOptionsProps {
  /** Opens the email form: sign-up when true, sign-in otherwise. */
  readonly onEmail: (isSignUp: boolean) => void;
  /** Opens the appearance page from the portrait strip. */
  readonly onBrowseAvatars: () => void;
  /** The dialog settles its request; the inline Settings list re-renders from the session. */
  readonly onSignedIn?: () => void;
  /** Renders a cancel button when set (the dialog); the inline Settings list has none. */
  readonly onCancel?: () => void;
}

/** Login method list: email sign-up / sign-in, and anonymous login outside the mini-program. */
export function LoginOptions({
  onEmail,
  onBrowseAvatars,
  onSignedIn,
  onCancel,
}: LoginOptionsProps) {
  const { user, loading } = useAuthContext();
  const signInAnonymously = useSignInAnonymously();
  const isGuest = user?.isAnonymous === true;

  const loginAnonymously = async () => {
    try {
      await signInAnonymously.mutateAsync();
      toast.success('登录成功');
      onSignedIn?.();
    } catch (error: unknown) {
      const message = getUserFacingMessage(error);
      authLog.warn('Anonymous login failed', { message });
      showErrorAlert('登录失败', message);
    }
  };

  return (
    <div className="login-options">
      <div className="login-strip">
        <div className="login-strip-row">
          {STRIP_PORTRAITS.map((url, index) => (
            <span key={url} className="login-strip-portrait">
              <img src={url} alt="" decoding="async" />
              {index >= UNLOCKED_COUNT && (
                <span className="login-strip-lock">
                  <IconLockClosed aria-hidden />
                </span>
              )}
            </span>
          ))}
        </div>
        <p className="login-strip-text">
          {`绑定邮箱，解锁 ${HAND_DRAWN_PORTRAITS.length} 款暗黑头像、自定义昵称和头像框`}
        </p>
        <button type="button" className="login-strip-link" onClick={onBrowseAvatars}>
          浏览全部头像 ›
        </button>
      </div>

      <button
        type="button"
        className="login-method login-method-primary"
        onClick={() => onEmail(true)}
      >
        <span className="login-method-title">
          <IconMailOutline aria-hidden />
          {isGuest ? '绑定邮箱' : '邮箱注册'}
        </span>
        <span className="login-method-caption">
          {isGuest ? '保留游戏数据，解锁完整功能' : '选头像起昵称，解锁绚丽头像框'}
        </span>
        <span className="login-method-caption login-method-caption-muted">
          <IconSparklesOutline aria-hidden /> 免验证，输入即注册
        </span>
      </button>

      <button type="button" className="login-method" onClick={() => onEmail(false)}>
        <span className="login-method-title">
          <IconMailOutline aria-hidden />
          邮箱登录
        </span>
        <span className="login-method-caption">已有账号，回到你的专属形象</span>
      </button>

      {!isGuest && !isMiniProgram() && (
        <button
          type="button"
          className="login-method"
          disabled={loading || signInAnonymously.isPending}
          data-testid={TESTIDS.homeAnonLoginButton}
          onClick={() => void loginAnonymously()}
        >
          {signInAnonymously.isPending ? (
            <span className="login-method-title">处理中</span>
          ) : (
            <>
              <span className="login-method-title">
                <IconPersonOutline aria-hidden />
                匿名登录
              </span>
              <span className="login-method-caption">{GUEST_GROWTH_NOTICE}</span>
            </>
          )}
        </button>
      )}

      {onCancel && (
        <Button variant="secondary" onClick={onCancel}>
          取消
        </Button>
      )}
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: 'current-password' | 'new-password';
  disabled: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-field">
      <input
        className="text-input"
        type={visible ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? '隐藏密码' : '显示密码'}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <IconEyeOffOutline aria-hidden /> : <IconEyeOutline aria-hidden />}
      </button>
    </span>
  );
}

function EmailForm({
  request,
  step,
  onStep,
  settle,
}: {
  request: LoginRequest;
  step: Extract<Step, { kind: 'email' }>;
  onStep: (step: Step) => void;
  settle: SettleLogin;
}) {
  const { user, error: authError } = useAuthContext();
  const signIn = useSignInWithEmail();
  const signUp = useSignUpWithEmail();
  const signOut = useSignOut();
  const [email, setEmail] = useState(step.email);
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const { isSignUp } = step;
  const busy = signIn.isPending || signUp.isPending || signOut.isPending;
  const localPart = email.split('@')[0] ?? '';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      toast.warning('请输入邮箱和密码');
      return;
    }
    if (request.signOutFirst) {
      if (user === null) throw new Error('Account switching requires a current user');
      try {
        await signOut.mutateAsync();
        clearRecentRooms(user.id);
      } catch (error: unknown) {
        authLog.warn('Sign-out before switching account failed', { error });
        showErrorAlert('切换失败', getUserFacingMessage(error));
        return;
      }
    }
    try {
      if (isSignUp) {
        const wasGuest = user?.isAnonymous === true;
        await signUp.mutateAsync({ email, password, displayName: displayName || undefined });
        toast.success(wasGuest ? '绑定成功' : '注册成功');
        settle('signedUp');
      } else {
        await signIn.mutateAsync({ email, password });
        if (request.showSuccessOnLogin) toast.success('登录成功');
        settle('signedIn');
      }
    } catch (error: unknown) {
      const message = getUserFacingMessage(error);
      authLog.warn('Email auth failed', { message });
      showErrorAlert(isSignUp ? '注册失败' : '登录失败', message);
    }
  };

  return (
    <form className="login-form" onSubmit={(event) => void submit(event)}>
      <h3 className="login-form-title">
        {request.formTitle ?? (isSignUp ? '注册账号' : '邮箱登录')}
      </h3>
      <input
        className="text-input"
        type="email"
        value={email}
        placeholder="邮箱"
        autoComplete="email"
        list="login-email-domains"
        disabled={busy}
        onChange={(event) => setEmail(event.target.value)}
      />
      <datalist id="login-email-domains">
        {localPart !== '' &&
          !email.includes('@') &&
          EMAIL_DOMAINS.map((domain) => <option key={domain} value={`${localPart}${domain}`} />)}
      </datalist>
      <PasswordField
        value={password}
        onChange={setPassword}
        placeholder="密码"
        autoComplete={isSignUp ? 'new-password' : 'current-password'}
        disabled={busy}
      />
      {isSignUp && request.hideDisplayName !== true && (
        <input
          className="text-input"
          value={displayName}
          placeholder="昵称（可选）"
          autoComplete="nickname"
          disabled={busy}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      )}
      {authError && <p className="login-error">{authError}</p>}
      <Button type="submit" loading={busy}>
        {busy ? '处理中' : isSignUp ? '注册' : '登录'}
      </Button>
      {request.showToggleMode !== false && (
        <Button
          variant="ghost"
          onClick={() => onStep({ kind: 'email', isSignUp: !isSignUp, email })}
        >
          {isSignUp ? '已有账号？去登录' : '没有账号？去注册'}
        </Button>
      )}
      {!isSignUp && (
        <Button variant="ghost" onClick={() => onStep({ kind: 'forgot', email })}>
          忘记密码？
        </Button>
      )}
      <Button
        variant="secondary"
        onClick={() =>
          (request.startWith ?? 'options') === 'options'
            ? onStep({ kind: 'options' })
            : settle('cancelled')
        }
      >
        返回
      </Button>
    </form>
  );
}

function ForgotPasswordForm({
  initialEmail,
  onStep,
}: {
  initialEmail: string;
  onStep: (step: Step) => void;
}) {
  const forgotPassword = useForgotPassword();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email) {
      toast.warning('请输入邮箱');
      return;
    }
    setError(null);
    try {
      await forgotPassword.mutateAsync(email);
      toast.success('验证码已发送，请查看邮箱');
      onStep({ kind: 'reset', email });
    } catch (caught: unknown) {
      const message = getUserFacingMessage(caught);
      authLog.warn('Forgot password failed', { message });
      setError(message);
    }
  };

  return (
    <form className="login-form" onSubmit={(event) => void submit(event)}>
      <h3 className="login-form-title">忘记密码</h3>
      <p className="login-form-subtitle">输入注册邮箱，我们将发送验证码</p>
      <input
        className="text-input"
        type="email"
        value={email}
        placeholder="邮箱"
        autoComplete="email"
        disabled={forgotPassword.isPending}
        onChange={(event) => setEmail(event.target.value)}
      />
      {error && <p className="login-error">{error}</p>}
      <Button type="submit" loading={forgotPassword.isPending}>
        {forgotPassword.isPending ? '发送中…' : '发送验证码'}
      </Button>
      <Button variant="secondary" onClick={() => onStep({ kind: 'email', isSignUp: false, email })}>
        返回登录
      </Button>
    </form>
  );
}

function ResetPasswordForm({ email, onStep }: { email: string; onStep: (step: Step) => void }) {
  const resetPassword = useResetPassword();
  const forgotPassword = useForgotPassword();
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busy = resetPassword.isPending || forgotPassword.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!code || !newPassword) {
      toast.warning('请输入验证码和新密码');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.warning('密码至少6位');
      return;
    }
    setError(null);
    try {
      await resetPassword.mutateAsync({ email, code, newPassword });
      toast.success('密码重置成功');
      onStep({ kind: 'email', isSignUp: false, email });
    } catch (caught: unknown) {
      const message = getUserFacingMessage(caught);
      authLog.warn('Reset password failed', { message });
      setError(message);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      await forgotPassword.mutateAsync(email);
      toast.success('验证码已重新发送');
    } catch (caught: unknown) {
      setError(getUserFacingMessage(caught));
    }
  };

  return (
    <form className="login-form" onSubmit={(event) => void submit(event)}>
      <h3 className="login-form-title">重置密码</h3>
      <p className="login-form-subtitle">{`验证码已发送至 ${email}`}</p>
      <input
        className="text-input"
        value={code}
        placeholder="6位验证码"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        disabled={busy}
        onChange={(event) => setCode(event.target.value)}
      />
      <PasswordField
        value={newPassword}
        onChange={setNewPassword}
        placeholder="新密码（至少6位）"
        autoComplete="new-password"
        disabled={busy}
      />
      {error && <p className="login-error">{error}</p>}
      <Button type="submit" loading={resetPassword.isPending}>
        {resetPassword.isPending ? '重置中…' : '重置密码'}
      </Button>
      <Button variant="ghost" disabled={busy} onClick={() => void resend()}>
        没收到？重新发送
      </Button>
      <Button variant="secondary" onClick={() => onStep({ kind: 'email', isSignUp: false, email })}>
        返回登录
      </Button>
    </form>
  );
}
