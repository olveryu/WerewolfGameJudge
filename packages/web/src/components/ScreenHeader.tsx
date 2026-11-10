import './ScreenHeader.css';

import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';

import IconChevronBack from '~icons/ion/chevron-back';

interface ScreenHeaderProps {
  /** Heading content: usually text; a page may put its own controls in the heading. */
  title: ReactNode;
  /** Where Back goes when the page was opened directly and has no history entry to return to. */
  parentPath?: string;
  backTestId?: string;
  /** Trailing actions. */
  children?: ReactNode;
}

/**
 * The page's back action: returns in history, or goes up to `parentPath` when the page was
 * opened directly (React Router's `default` location key has no entry of this app behind it).
 */
export function useScreenBack(parentPath: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (location.key === 'default') void navigate(parentPath, { replace: true });
    else void navigate(-1);
  };
}

/** Page header with a back button that runs {@link useScreenBack}. */
export function ScreenHeader({ title, parentPath = '/', backTestId, children }: ScreenHeaderProps) {
  const goBack = useScreenBack(parentPath);
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
