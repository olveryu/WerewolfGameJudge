import './MaintenanceTab.css';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';

import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';
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

import { loadErrorMessage } from './loadErrorMessage';

const ADMIN_MAINTENANCE_KEY = ['admin-maintenance'] as const;
const maintenanceLog = log.extend('AdminMaintenance');

/** D1-independent maintenance controls and an exact live preview of the public page. */
export function MaintenanceTab() {
  const settings = useQuery({
    queryKey: ADMIN_MAINTENANCE_KEY,
    queryFn: ({ signal }) => fetchAdminMaintenance(signal),
    retry: false,
  });

  if (settings.isPending) return <Spinner label="正在读取维护设置" />;
  if (settings.isError) {
    return (
      <div className="maintenance-editor">
        <p role="alert">读取维护设置失败：{loadErrorMessage(settings.error)}</p>
        <Button onClick={() => void settings.refetch()}>重试</Button>
      </div>
    );
  }
  return <MaintenanceEditor initialConfiguration={settings.data} />;
}

function MaintenanceEditor({ initialConfiguration }: { initialConfiguration: MaintenanceConfig }) {
  const [configuration, setConfiguration] = useState(initialConfiguration);
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
      queryClient.setQueryData(ADMIN_MAINTENANCE_KEY, saved);
      queryClient.setQueryData(MAINTENANCE_QUERY_KEY, saved);
      setFeedback({
        error: false,
        message: saved.enabled
          ? '维护已开启。新访客立即看到维护页，已打开且可见的页面将在一分钟内检查更新。'
          : '维护已关闭。访客将在下一次状态检查时恢复访问。',
      });
    } catch (cause: unknown) {
      handleError(cause, { label: '保存维护设置', logger: maintenanceLog, feedback: false });
      setFeedback({ error: true, message: `保存失败：${loadErrorMessage(cause)}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="maintenance-editor">
      <form className="maintenance-editor-form" onSubmit={(event) => void save(event)}>
        <div>
          <h2>网站维护</h2>
          <p>
            设置独立保存在 R2，不依赖 D1。到指定时间自动结束维护。时间按当前设备时区 （
            {Intl.DateTimeFormat().resolvedOptions().timeZone}）设置。
          </p>
        </div>
        <label className="maintenance-editor-switch">
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
        <Button type="submit" disabled={saving}>
          {saving ? '正在保存…' : '保存维护设置'}
        </Button>
        {feedback !== null && <p role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
      </form>
      <MaintenancePage configuration={configuration} preview />
    </div>
  );
}
