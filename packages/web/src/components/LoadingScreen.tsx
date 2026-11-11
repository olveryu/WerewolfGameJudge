import './LoadingScreen.css';

import { Button } from '@/components/Button';
import { IndeterminateProgressBar } from '@/components/IndeterminateProgressBar';

import appIconUrl from '../../../../assets/pwa/icon-192.png';

/**
 * Full-screen loading state under the pulsing app icon: the message (default 加载中) over a
 * sweeping bar; with `error` it shows the error and the recovery actions the caller provides
 * (重试 / 返回首页).
 */
export function LoadingScreen({
  message = '加载中',
  error,
  onRetry,
  onBack,
}: {
  readonly message?: string;
  readonly error?: string;
  readonly onRetry?: () => void;
  readonly onBack?: () => void;
}) {
  return (
    <main className="loading-screen" aria-busy={error === undefined}>
      {/* CORS mode like the share logo: the CDN omits `Vary: Origin`, so cached copies must match. */}
      <img className="loading-screen-icon" src={appIconUrl} alt="" crossOrigin="anonymous" />
      {error === undefined ? (
        <>
          <p className="loading-screen-message" role="status">
            {message}
          </p>
          <IndeterminateProgressBar className="loading-screen-progress" />
        </>
      ) : (
        <>
          <p className="loading-screen-error" role="alert">
            {error}
          </p>
          <div className="loading-screen-actions">
            {onRetry !== undefined && <Button onClick={onRetry}>重试</Button>}
            {onBack !== undefined && (
              <Button variant="outline" onClick={onBack}>
                返回首页
              </Button>
            )}
          </div>
        </>
      )}
    </main>
  );
}
