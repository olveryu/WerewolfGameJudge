import './MaintenancePage.css';

import { Button } from '@/components/Button';
import { useAdminShortcut } from '@/features/admin/hooks/useAdminShortcut';
import { formatMaintenanceEnd, type MaintenanceConfig } from '@/features/maintenance/maintenance';
import IconMoonOutline from '~icons/ion/moon-outline';
import IconTimeOutline from '~icons/ion/time-outline';

interface MaintenancePageProps {
  configuration: MaintenanceConfig;
  onRefresh?: () => void;
  refreshing?: boolean;
  error?: string;
  preview?: boolean;
  onOpenAdmin?: () => void;
}

function openAdmin(): void {
  window.location.assign('/admin');
}

/** Standalone maintenance notice; also used as the administrator's live preview. */
export function MaintenancePage({
  configuration,
  onRefresh,
  refreshing = false,
  error,
  preview = false,
  onOpenAdmin = openAdmin,
}: MaintenancePageProps) {
  const { onPress } = useAdminShortcut(onOpenAdmin);
  return (
    <section className={`maintenance-page${preview ? ' maintenance-page-preview' : ''}`}>
      <div className="maintenance-orbit">
        <button
          type="button"
          className="maintenance-moon"
          aria-label="进入管理后台（连续点击四次）"
          onClick={onPress}
          disabled={preview}
        >
          <IconMoonOutline aria-hidden />
        </button>
        <span className="maintenance-star maintenance-star-one" aria-hidden />
        <span className="maintenance-star maintenance-star-two" aria-hidden />
        <span className="maintenance-star maintenance-star-three" aria-hidden />
      </div>
      <div className="maintenance-card">
        <span className="maintenance-eyebrow">中场休息 · 很快再见</span>
        <h1>系统维护中</h1>
        <p className="maintenance-description">{configuration.message}</p>
        <div className="maintenance-return">
          <IconTimeOutline aria-hidden />
          <div>
            <span>预计恢复时间</span>
            <strong>{formatMaintenanceEnd(configuration.endsAt)}</strong>
          </div>
        </div>
        <p className="maintenance-note">让每一次相聚，都有更好的游戏体验。</p>
        {onRefresh !== undefined && (
          <Button onClick={onRefresh} disabled={refreshing}>
            {refreshing ? '正在检查…' : '检查是否恢复'}
          </Button>
        )}
        {error !== undefined && <p role="alert">{error}</p>}
      </div>
      <p className="maintenance-footer">
        {preview ? '维护页预览 · 保存后生效' : '恢复后将自动返回，无需反复刷新'}
      </p>
    </section>
  );
}
