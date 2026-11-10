import './AdminComponents.css';

import { useEffect, useState } from 'react';

import type { TimePreset } from '@/features/admin/model/adminContracts';
import { getTimeRange } from '@/features/admin/services/adminApi';

import { AdminPill } from './AdminPill';

const PRESET_LABELS: Record<TimePreset, string> = {
  '1h': '1小时',
  '24h': '24小时',
  today: '今天',
  '7d': '近7天',
  '30d': '近30天',
  custom: '自定义',
};

const DEFAULT_PRESETS: readonly TimePreset[] = ['today', '7d', '30d', 'custom'] as const;

interface TimeRangeSelectorProps {
  /** Called with each selected range; must be stable, since it re-runs the preset effect. */
  onRangeChange: (range: { from: string; to: string }) => void;
  presets?: readonly TimePreset[];
  initialPreset?: TimePreset;
}

/** Time preset pills plus a custom date range; reports every valid selection. */
export function TimeRangeSelector({
  onRangeChange,
  presets = DEFAULT_PRESETS,
  initialPreset = 'today',
}: TimeRangeSelectorProps) {
  const [preset, setPreset] = useState<TimePreset>(initialPreset);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    if (preset !== 'custom') {
      onRangeChange(getTimeRange(preset));
    }
  }, [preset, onRangeChange]);

  const handleCustomSearch = () => {
    if (customFrom && customTo) {
      onRangeChange({
        from: `${customFrom}T00:00:00Z`,
        to: `${customTo}T23:59:59Z`,
      });
    }
  };

  return (
    <div>
      <div className="admin-pill-row">
        {presets.map((option) => (
          <AdminPill
            key={option}
            label={PRESET_LABELS[option]}
            isActive={preset === option}
            onPress={() => setPreset(option)}
          />
        ))}
      </div>
      {preset === 'custom' && (
        <div className="admin-range-custom">
          <input
            className="admin-range-input"
            type="date"
            aria-label="开始日期"
            value={customFrom}
            onChange={(event) => setCustomFrom(event.target.value)}
          />
          <span className="admin-range-separator" aria-hidden>
            ~
          </span>
          <input
            className="admin-range-input"
            type="date"
            aria-label="结束日期"
            value={customTo}
            onChange={(event) => setCustomTo(event.target.value)}
          />
          <button type="button" className="admin-range-search" onClick={handleCustomSearch}>
            查
          </button>
        </div>
      )}
    </div>
  );
}
