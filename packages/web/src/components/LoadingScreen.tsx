import './LoadingScreen.css';

import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';

/**
 * Full-screen loading state with an optional message; with `error` it shows the error and
 * the recovery actions the caller provides (重试 / 返回首页).
 */
export function LoadingScreen({
  message,
  error,
  onRetry,
  onBack,
}: {
  readonly message?: string;
  readonly error?: string;
  readonly onRetry?: () => void;
  readonly onBack?: () => void;
}) {
  if (error !== undefined) {
    return (
      <main className="loading-screen">
        <p className="loading-screen-error" role="alert">
          {error}
        </p>
        <div className="loading-screen-actions">
          {onRetry !== undefined && <Button onClick={onRetry}>重试</Button>}
          {onBack !== undefined && (
            <Button variant="ghost" onClick={onBack}>
              返回首页
            </Button>
          )}
        </div>
      </main>
    );
  }
  return (
    <main className="loading-screen" aria-busy>
      <Spinner label={message ?? '加载中'} size="lg" />
      {message !== undefined && <p className="loading-screen-message">{message}</p>}
    </main>
  );
}
