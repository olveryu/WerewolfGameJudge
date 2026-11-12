import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import {
  clearAdminReturnTo,
  readAdminReturnTo,
  rememberAdminReturnTo,
} from '../services/adminNavigationStore';

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

function readReturnTo(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('adminReturnTo' in state)) return null;
  const value = state.adminReturnTo;
  if (typeof value !== 'string' || !value.startsWith('/')) {
    throw new Error('Admin return destination must be a local path');
  }
  const url = new URL(value, window.location.origin);
  if (url.origin !== window.location.origin || isAdminPath(url.pathname)) {
    throw new Error('Admin return destination must be outside the admin workspace');
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function referrerReturnTo(): string {
  if (document.referrer === '') return '/';
  const url = new URL(document.referrer);
  return url.origin === window.location.origin && !isAdminPath(url.pathname)
    ? `${url.pathname}${url.search}${url.hash}`
    : '/';
}

/** Enter the admin workspace with the complete player-page return destination. */
export function useAdminEntry(): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    rememberAdminReturnTo(returnTo);
    void navigate('/admin', {
      state: { adminReturnTo: returnTo },
    });
  };
}

/** Exit the whole workspace, preserving its entry destination through navigation and reloads. */
export function useAdminExit(): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  const [returnTo] = useState(() => {
    const state: unknown = location.state;
    const stored = readAdminReturnTo();
    return (
      readReturnTo(state) ??
      (stored === null ? null : readReturnTo({ adminReturnTo: stored })) ??
      referrerReturnTo()
    );
  });

  useEffect(() => {
    rememberAdminReturnTo(returnTo);
    return clearAdminReturnTo;
  }, [returnTo]);

  return () => void navigate(returnTo, { replace: true });
}
