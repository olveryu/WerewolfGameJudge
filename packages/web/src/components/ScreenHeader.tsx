import './ScreenHeader.css';

import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';

import IconChevronBack from '~icons/ion/chevron-back';

interface ScreenHeaderProps {
  title: string;
  /** Trailing actions. */
  children?: ReactNode;
}

/** Page header with a back button: returns in history, or to Home when the page was opened directly. */
export function ScreenHeader({ title, children }: ScreenHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = () => {
    if (location.key === 'default') void navigate('/');
    else void navigate(-1);
  };
  return (
    <header className="screen-header">
      <button type="button" className="screen-header-back" aria-label="返回" onClick={goBack}>
        <IconChevronBack aria-hidden />
      </button>
      <h1 className="screen-header-title">{title}</h1>
      <div className="screen-header-actions">{children}</div>
    </header>
  );
}
