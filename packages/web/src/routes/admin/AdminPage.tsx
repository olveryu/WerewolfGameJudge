/** Password-gated layout for the independent admin workspace. */
import './admin.css';

import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { verifyAdminPassword } from '@/features/admin/services/adminAuth';
import {
  ADMIN_SESSION_EXPIRED_EVENT,
  clearAdminCredential,
  readAdminCredential,
  writeAdminCredential,
} from '@/features/admin/services/adminCredentialStore';
import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';
import IconLockClosedOutline from '~icons/ion/lock-closed-outline';

import { ScreenHeader } from '../../components/ScreenHeader';
import { AdminShell } from './AdminShell';

const adminLog = log.extend('Admin');

/** Verify cached credentials before mounting any data-bearing child route. */
export function AdminPage() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasEntryHistory] = useState(() => location.key !== 'default');
  const goBack = () => {
    if (hasEntryHistory) void navigate(-1);
    else void navigate('/', { replace: true });
  };
  const [cached] = useState(readAdminCredential);
  const [authenticated, setAuthenticated] = useState(false);
  const [verifying, setVerifying] = useState(cached !== null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (cached === null) return;
    void verifyAdminPassword(cached)
      .then((valid) => {
        if (!active) return;
        if (valid) setAuthenticated(true);
        else clearAdminCredential();
      })
      .catch((cause: unknown) => {
        if (!active) return;
        handleError(cause, { label: '验证管理员身份', logger: adminLog, feedback: false });
        setError('验证失败，请重新输入密码重试');
      })
      .finally(() => {
        if (active) setVerifying(false);
      });
    return () => {
      active = false;
    };
  }, [cached]);

  useEffect(() => {
    function expired() {
      setAuthenticated(false);
      setPassword('');
      setError('管理员身份已失效，请重新登录');
      void client.cancelQueries({ queryKey: ['admin'] });
      client.removeQueries({ queryKey: ['admin'] });
    }
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, expired);
    return () => window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, expired);
  }, [client]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifying(true);
    setError(null);
    try {
      const credential = password.trim();
      if (await verifyAdminPassword(credential)) {
        writeAdminCredential(credential);
        setAuthenticated(true);
        setPassword('');
      } else setError('密码错误，请重试');
    } catch (cause: unknown) {
      handleError(cause, { label: '验证管理员身份', logger: adminLog, feedback: false });
      setError('无法验证管理员身份，请重试');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="admin-console">
      {authenticated ? (
        <AdminShell onBack={goBack} />
      ) : (
        <>
          <ScreenHeader title="管理后台" onBack={goBack} />
          <main className="admin-login">
            <form className="admin-login-panel" onSubmit={(event) => void submit(event)}>
              <div className="admin-brand-mark">
                <IconLockClosedOutline aria-hidden />
              </div>
              <h2>进入管理后台</h2>
              <p className="admin-muted">数据、运营与运行状况，尽在一个工作台。</p>
              <label htmlFor="admin-password">管理密码</label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={verifying}
              />
              {error !== null && (
                <p role="alert" className="admin-error">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="admin-primary"
                disabled={verifying || !password.trim()}
              >
                {verifying ? '正在验证…' : '进入工作台'}
              </button>
            </form>
          </main>
        </>
      )}
    </div>
  );
}
