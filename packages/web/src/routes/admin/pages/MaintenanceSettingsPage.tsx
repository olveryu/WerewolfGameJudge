import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';

import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import { fetchAdminMaintenance, saveAdminMaintenance } from '@/features/admin/services/adminApi';
import {
  MAINTENANCE_QUERY_KEY,
  type MaintenanceConfig,
  maintenanceEndInputValue,
  maintenanceSchema,
} from '@/features/maintenance/maintenance';
import { MaintenancePage } from '@/features/maintenance/MaintenancePage';
import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';

import { AsyncBoundary, PageHeading, Panel, StatusBadge } from '../components/Primitives';

const maintenanceQuery = adminQueryOptions('maintenance', null, fetchAdminMaintenance);
const maintenanceLog = log.extend('AdminMaintenance');

/** D1-independent maintenance controls and an exact live preview of the public page. */
export function MaintenanceSettingsPage() {
  const settings = useQuery({
    ...maintenanceQuery,
    staleTime: 30_000,
    refetchInterval: (query) => (query.state.data?.enabled ? 30_000 : false),
  });
  return (
    <>
      <PageHeading
        title="维护"
        description="独立保存在 R2，D1 不可用时仍可管理。"
        query={settings}
      />
      <div className="admin-content">
        <AsyncBoundary query={settings}>
          {(configuration) => <MaintenanceEditor initialConfiguration={configuration} />}
        </AsyncBoundary>
      </div>
    </>
  );
}

function MaintenanceEditor({ initialConfiguration }: { initialConfiguration: MaintenanceConfig }) {
  const [configuration, setConfiguration] = useState(initialConfiguration);
  const [previousConfiguration, setPreviousConfiguration] = useState(initialConfiguration);
  if (previousConfiguration !== initialConfiguration) {
    setPreviousConfiguration(initialConfiguration);
    setConfiguration(initialConfiguration);
  }
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const queryClient = useQueryClient();

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    const validated = maintenanceSchema.safeParse(configuration);
    if (!validated.success) {
      setFeedback({ error: true, message: '请填写维护说明，并选择自动恢复时间。' });
      return;
    }
    if (
      validated.data.enabled &&
      (validated.data.endsAt === null || Date.parse(validated.data.endsAt) <= Date.now())
    ) {
      setFeedback({ error: true, message: '自动恢复时间必须晚于当前时间。' });
      return;
    }
    setSaving(true);
    try {
      const saved = await saveAdminMaintenance(validated.data);
      setConfiguration(saved);
      queryClient.setQueryData(maintenanceQuery.queryKey, saved);
      queryClient.setQueryData(MAINTENANCE_QUERY_KEY, saved);
      setFeedback({
        error: false,
        message: saved.enabled
          ? '维护已开启。新访客立即看到维护页，已打开且可见的页面将在一分钟内检查更新。'
          : '维护已关闭。访客将在下一次状态检查时恢复访问。',
      });
    } catch (cause: unknown) {
      handleError(cause, { label: '保存维护设置', logger: maintenanceLog, feedback: false });
      setFeedback({
        error: true,
        message: `保存失败：${cause instanceof Error ? cause.message : '请求失败'}`,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-grid">
      <Panel
        title="网站维护"
        className="admin-span-6"
        action={
          <StatusBadge tone={initialConfiguration.enabled ? 'warning' : 'success'}>
            {initialConfiguration.enabled ? '维护已开启' : '正常服务'}
          </StatusBadge>
        }
      >
        <form className="admin-maintenance-form" onSubmit={(event) => void save(event)}>
          <p>
            到指定时间自动结束维护。时间按当前设备时区 （
            {Intl.DateTimeFormat().resolvedOptions().timeZone}）设置。
          </p>
          <label className="admin-maintenance-switch">
            <input
              type="checkbox"
              checked={configuration.enabled}
              disabled={saving}
              onChange={(event) =>
                setConfiguration({ ...configuration, enabled: event.target.checked })
              }
            />
            开启维护模式
          </label>
          <label>
            自动恢复时间
            <input
              type="datetime-local"
              value={maintenanceEndInputValue(configuration.endsAt)}
              required={configuration.enabled}
              disabled={saving}
              onChange={(event) =>
                setConfiguration({
                  ...configuration,
                  endsAt:
                    event.target.value === '' ? null : new Date(event.target.value).toISOString(),
                })
              }
            />
          </label>
          <label>
            维护说明
            <textarea
              value={configuration.message}
              maxLength={500}
              required
              rows={4}
              disabled={saving}
              onChange={(event) =>
                setConfiguration({ ...configuration, message: event.target.value })
              }
            />
          </label>
          <button type="submit" className="admin-primary" disabled={saving}>
            {saving ? '正在保存…' : '保存维护设置'}
          </button>
          {feedback !== null && (
            <p
              className={feedback.error ? 'admin-error' : 'admin-notice'}
              role={feedback.error ? 'alert' : 'status'}
            >
              {feedback.message}
            </p>
          )}
        </form>
      </Panel>
      <Panel
        title="访客页面预览"
        description="保留游戏端外观；表单保存后生效。"
        className="admin-span-6"
      >
        <MaintenancePage configuration={configuration} preview />
      </Panel>
    </div>
  );
}
