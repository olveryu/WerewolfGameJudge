import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { GameWordGame } from '@/features/admin/model/adminContracts';
import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import {
  fetchAutomaticSupplySettings,
  saveAutomaticSupplySettings,
} from '@/features/admin/services/adminApi';
import { CANCEL_BUTTON, showAlert } from '@/utils/alert';
import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';

import { AsyncBoundary } from './Primitives';

const supplyLog = log.extend('AdminAutomaticSupply');

/** Persist confirmed scheduling changes without automatically rereading D1 inventory. */
export function AutomaticSupplyControl({
  game,
  available,
}: {
  game: GameWordGame;
  available: boolean;
}) {
  const client = useQueryClient();
  const options = adminQueryOptions('automatic-supply', game, (signal) =>
    fetchAutomaticSupplySettings(game, signal),
  );
  const query = useQuery(options);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(enabled: boolean) {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveAutomaticSupplySettings(game, enabled);
      client.setQueryData(options.queryKey, saved);
    } catch (cause: unknown) {
      handleError(cause, { label: '保存自动供给设置', logger: supplyLog, feedback: false });
      setError(`保存失败：${cause instanceof Error ? cause.message : '请求失败'}`);
    } finally {
      setSaving(false);
    }
  }

  function confirm(enabled: boolean) {
    showAlert(
      enabled ? '启用自动供给' : '暂停自动供给',
      enabled
        ? '将恢复此词库每天的自动补词任务，仍受部署开关和配额限制。'
        : '暂停后不再创建新的自动任务；已启动的任务会继续，手动补词仍可使用。',
      [CANCEL_BUTTON, { text: enabled ? '启用' : '暂停', onPress: () => void save(enabled) }],
    );
  }

  return (
    <div className="admin-automatic-supply">
      <AsyncBoundary query={query}>
        {(data) => (
          <label className="admin-automatic-supply-row">
            <span>
              自动供给
              <small>
                {!available
                  ? '部署尚未开启供给'
                  : saving
                    ? '正在保存…'
                    : data.enabled
                      ? '已启用，每天自动创建补词任务'
                      : '已暂停，仍可手动补词'}
              </small>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="admin-switch"
              aria-label="自动供给"
              checked={available && data.enabled}
              disabled={!available || saving}
              onChange={(event) => confirm(event.target.checked)}
            />
          </label>
        )}
      </AsyncBoundary>
      {error !== null && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
    </div>
  );
}
