import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';
import {
  fetchMaintenance,
  MAINTENANCE_POLL_MS,
  MAINTENANCE_QUERY_KEY,
} from '@/features/maintenance/maintenance';
import { MaintenancePage } from '@/features/maintenance/MaintenancePage';
import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';

const maintenanceLog = log.extend('Maintenance');
const MAINTENANCE_RETRY_MS = 5_000;
const MAINTENANCE_WARNING_ID = 'maintenance-status-unavailable';

/** Check maintenance before mounting any database-backed player providers. */
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const status = useQuery({
    queryKey: MAINTENANCE_QUERY_KEY,
    queryFn: ({ signal }) => fetchMaintenance(signal),
    meta: { authScope: 'application' },
    refetchInterval: (query) =>
      query.state.status === 'error' && query.state.data?.enabled === false
        ? MAINTENANCE_RETRY_MS
        : MAINTENANCE_POLL_MS,
    refetchOnWindowFocus: 'always',
    staleTime: 0,
    retry: false,
  });
  const endsAt = status.data?.enabled ? status.data.endsAt : null;
  const { refetch } = status;
  const hasBackgroundError = status.isError && status.data?.enabled === false;

  useEffect(() => {
    if (endsAt === null) return;
    const deadline = Date.parse(endsAt);
    let timer: number | undefined;
    const scheduleCheck = () => {
      const remaining = deadline - Date.now();
      timer = window.setTimeout(
        () => {
          if (Date.now() < deadline) scheduleCheck();
          else void refetch();
        },
        Math.min(Math.max(0, remaining), 2_147_483_647),
      );
    };
    scheduleCheck();
    return () => window.clearTimeout(timer);
  }, [endsAt, refetch]);

  useEffect(() => {
    if (status.error === null) return;
    handleError(status.error, {
      label: '读取维护状态',
      logger: maintenanceLog,
      feedback: false,
    });
  }, [status.error]);

  useEffect(() => {
    if (hasBackgroundError) {
      toast.warning('暂时无法确认维护状态，正在重试', {
        id: MAINTENANCE_WARNING_ID,
        duration: Infinity,
        closeButton: true,
      });
    } else {
      toast.dismiss(MAINTENANCE_WARNING_ID);
    }
    return () => {
      toast.dismiss(MAINTENANCE_WARNING_ID);
    };
  }, [hasBackgroundError]);

  if (status.data?.enabled) {
    return (
      <MaintenancePage
        configuration={status.data}
        onRefresh={() => void status.refetch()}
        refreshing={status.isFetching}
        error={status.isError ? '暂时无法检查恢复状态，请稍后重试。' : undefined}
      />
    );
  }

  if (status.isError && status.data === undefined) {
    return (
      <section className="maintenance-page">
        <h1>暂时无法连接服务</h1>
        <p role="alert">无法读取系统状态，请稍后重试。</p>
        <Button onClick={() => void status.refetch()} disabled={status.isFetching}>
          重试
        </Button>
      </section>
    );
  }

  if (status.isPending) {
    return (
      <div className="maintenance-page">
        <Spinner label="正在检查系统状态" size="lg" />
      </div>
    );
  }

  return children;
}
