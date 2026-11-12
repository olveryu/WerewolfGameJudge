/** URL-backed ranges use stable cache keys; moving "now" is resolved only on an actual fetch. */
import { useSearchParams } from 'react-router';

import type { TimePreset } from '@/features/admin/model/adminContracts';
import { getTimeRange } from '@/features/admin/services/adminApi';

const PRESETS = [
  { value: 'today', label: '今日' },
  { value: '7d', label: '7 天' },
  { value: '30d', label: '30 天' },
  { value: 'custom', label: '自定义' },
] as const;
const TRAFFIC_PRESETS = [
  { value: '1h', label: '1 小时' },
  { value: '24h', label: '24 小时' },
  { value: '7d', label: '7 天' },
  { value: '30d', label: '30 天' },
] as const;

/** Read the selected range without creating a new time-dependent query key on each mount. */
export function useReportRange(traffic = false) {
  const [parameters] = useSearchParams();
  const rawPreset = parameters.get('range') ?? (traffic ? '24h' : 'today');
  const choices = traffic ? TRAFFIC_PRESETS : PRESETS;
  const preset = choices.find((item) => item.value === rawPreset)?.value;
  const from = parameters.get('from') ?? '';
  const to = parameters.get('to') ?? '';
  const valid =
    preset !== undefined &&
    (preset !== 'custom' ||
      (/^\d{4}-\d{2}-\d{2}$/.test(from) &&
        /^\d{4}-\d{2}-\d{2}$/.test(to) &&
        Number.isFinite(Date.parse(from)) &&
        Number.isFinite(Date.parse(to)) &&
        from <= to &&
        Date.parse(to) - Date.parse(from) < 31 * 86400000));
  return {
    key: { preset: rawPreset, ...(preset === 'custom' ? { from, to } : {}) },
    valid,
    resolve() {
      if (!valid || preset === undefined) throw new Error('请选择有效的时间范围（最多 31 天）');
      if (preset !== 'custom') return getTimeRange(preset);
      return {
        from: `${from}T00:00:00.000Z`,
        to: new Date(Date.parse(to) + 86400000).toISOString(),
      };
    },
  };
}

/** Compact toolbar controls; selected dates survive refresh and browser history. */
export function ReportRange({ traffic = false }: { traffic?: boolean }) {
  const [parameters, setParameters] = useSearchParams();
  const selected = parameters.get('range') ?? (traffic ? '24h' : 'today');
  function update(key: string, value: string) {
    const next = new URLSearchParams(parameters);
    next.set(key, value);
    setParameters(next);
  }
  return (
    <div className="admin-report-range">
      <div className="admin-segmented" role="group" aria-label="时间范围">
        {(traffic ? TRAFFIC_PRESETS : PRESETS).map((item: { value: TimePreset; label: string }) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={selected === item.value}
            onClick={() => update('range', item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <span className="admin-range-timezone">UTC 时间</span>
      {selected === 'custom' && (
        <div className="admin-custom-range">
          <label>
            开始日期
            <input
              type="date"
              value={parameters.get('from') ?? ''}
              onChange={(event) => update('from', event.target.value)}
            />
          </label>
          <label>
            结束日期
            <input
              type="date"
              value={parameters.get('to') ?? ''}
              onChange={(event) => update('to', event.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  );
}
