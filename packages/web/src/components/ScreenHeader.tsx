import './ScreenHeader.css';

import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';

import IconChevronBack from '~icons/ion/chevron-back';

interface ScreenHeaderProps {
  title: string;
  /** Where Back goes when the page was opened directly and has no history entry to return to. */
  parentPath?: string;
  backTestId?: string;
  /** Trailing actions. */
  children?: ReactNode;
}

/**
 * Page header with a back button: returns in history, or goes up to `parentPath` when the page
 * was opened directly (React Router's `default` location key has no entry of this app behind it).
 */
export function ScreenHeader({ title, parentPath = '/', backTestId, children }: ScreenHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = () => {
    if (location.key === 'default') void navigate(parentPath, { replace: true });
    else void navigate(-1);
  };
  return (
    <header className="screen-header">
      <button
        type="button"
        className="screen-header-back"
        aria-label="返回"
        onClick={goBack}
        data-testid={backTestId}
      >
        <IconChevronBack aria-hidden />
      </button>
      <h1 className="screen-header-title">{title}</h1>
      <div className="screen-header-actions">{children}</div>
    </header>
  );
}
