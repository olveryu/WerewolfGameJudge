import './RouteErrorPage.css';

import { captureException } from '@sentry/react';
import { useEffect } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

/**
 * Error element for the route tree. Unknown paths render a not-found page; any other error is a
 * failure, reported to Sentry and shown with a reload action.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;

  useEffect(() => {
    if (!isNotFound) {
      captureException(error);
    }
  }, [error, isNotFound]);

  if (isNotFound) {
    return (
      <main className="route-error">
        <h1>页面不存在</h1>
        <Link className="route-error-home" to="/">
          返回首页
        </Link>
      </main>
    );
  }

  return (
    <main className="route-error" role="alert">
      <h1>出错了</h1>
      <p>页面遇到问题，已自动上报。</p>
      <button type="button" onClick={() => window.location.reload()}>
        重新加载
      </button>
      <Link className="route-error-home" to="/">
        返回首页
      </Link>
    </main>
  );
}
