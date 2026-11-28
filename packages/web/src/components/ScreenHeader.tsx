import './ScreenHeader.css';
import './HeaderSurface.css';

import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { IconButton } from '@/components/IconButton';
import { TESTIDS } from '@/testids';
import IconChevronBack from '~icons/ion/chevron-back';

interface ScreenHeaderProps {
  /** Heading content: usually text; a page may put its own controls in the heading. */
  title: ReactNode;
  /** Where Back goes when the page was opened directly and has no history entry to return to. */
  parentPath?: string;
  /** Override the default history-or-parent navigation. */
  onBack?: () => void;
  backTestId?: string;
  /** Trailing actions. */
  children?: ReactNode;
  /** `admin`: the console's plain, untextured header that stays above its sticky toolbars. */
  tone?: 'default' | 'admin';
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
export function ScreenHeader({
  title,
  parentPath = '/',
  onBack,
  backTestId,
  children,
  tone = 'default',
}: ScreenHeaderProps) {
  const goBack = useScreenBack(parentPath);
  return (
    <header className="screen-header page-header-surface" data-tone={tone}>
      <IconButton
        size="lg"
        label="返回"
        icon={<IconChevronBack aria-hidden />}
        onClick={onBack ?? goBack}
        data-testid={backTestId}
      />
      <h1 className="screen-header-title" data-testid={TESTIDS.screenHeaderTitle}>
        {title}
      </h1>
      <div className="screen-header-actions">{children}</div>
    </header>
  );
}
