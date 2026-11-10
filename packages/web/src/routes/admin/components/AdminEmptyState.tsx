import './AdminComponents.css';

import { Spinner } from '@/components/Spinner';

interface AdminEmptyStateProps {
  loading: boolean;
  error: string | null;
  empty: boolean;
}

/** Admin tab loading / error / empty placeholder; renders nothing when no state is active. */
export function AdminEmptyState({ loading, error, empty }: AdminEmptyStateProps) {
  if (loading) {
    return (
      <div className="admin-empty-state">
        <Spinner label="加载中" size="lg" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="admin-empty-state">
        <p className="admin-empty-error" role="alert">
          {error}
        </p>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="admin-empty-state">
        <p className="admin-empty-text">无数据</p>
      </div>
    );
  }
  return null;
}
