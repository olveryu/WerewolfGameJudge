/**
 * Session gate for pages that act as a signed-in user (room entry, room config). A direct link
 * without a session asks for a login and leaves for Home on cancel; inside the mini program a
 * missing session means the WeChat login failed, so the user re-enters the mini program.
 */
import { type ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/Button';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuthContext, type User } from '@/contexts/AuthContext';
import { requestLogin } from '@/features/auth/loginRequests';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import { isMiniProgram, wxReLaunch } from '@/utils/miniProgram';

function LoginPrompt({ subtitle }: { readonly subtitle: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    const controller = new AbortController();
    void requestLogin({ title: '登录', subtitle }, controller.signal).then((outcome) => {
      if (outcome === 'cancelled' && !controller.signal.aborted) exitRoomFlow(navigate);
    });
    return () => controller.abort();
  }, [navigate, subtitle]);
  return <LoadingScreen message="请先登录" />;
}

function MiniProgramAuthFailure() {
  const navigate = useNavigate();
  return (
    <main className="loading-screen">
      <p className="loading-screen-error">微信登录失败</p>
      <p className="loading-screen-message">请重新进入小程序以获取新的登录凭证</p>
      <div className="loading-screen-actions">
        <Button onClick={wxReLaunch}>重新进入</Button>
        <Button variant="ghost" onClick={() => exitRoomFlow(navigate)}>
          返回首页
        </Button>
      </div>
    </main>
  );
}

interface RequireUserProps {
  /** Shown while the session restores. */
  readonly loadingMessage?: string;
  /** Login dialog subtitle naming what the login is for. */
  readonly loginSubtitle: string;
  readonly children: (user: User) => ReactNode;
}

/** Renders `children` with the signed-in user, or the login prompt when there is none. */
export function RequireUser({ loadingMessage, loginSubtitle, children }: RequireUserProps) {
  const { user, loading: isAuthLoading } = useAuthContext();
  if (isAuthLoading) return <LoadingScreen message={loadingMessage} />;
  if (user === null) {
    return isMiniProgram() ? <MiniProgramAuthFailure /> : <LoginPrompt subtitle={loginSubtitle} />;
  }
  return children(user);
}
