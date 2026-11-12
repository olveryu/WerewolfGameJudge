import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import { fetchUserCountries } from '@/features/admin/services/adminApi';
import IconChevronDown from '~icons/ion/chevron-down';

import { DetailDrawer } from './Overlays';
import { AsyncBoundary } from './Primitives';

const countryNames = new Intl.DisplayNames(['zh-CN'], { type: 'region' });

function countryLabel(country: string): string {
  if (country === '') return '全部国家';
  return /^[A-Z]{2}$/.test(country)
    ? `${countryNames.of(country) ?? country} · ${country}`
    : country;
}

/** Fetch country choices only on opening; retain the shared five-minute admin cache policy. */
export function CountryFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (country: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    ...adminQueryOptions('user-countries', null, fetchUserCountries),
    enabled: open,
  });
  function choose(country: string) {
    setOpen(false);
    onChange(country);
  }
  function option(country: string) {
    return (
      <button
        type="button"
        key={country}
        className="admin-choice"
        aria-pressed={value === country}
        onClick={() => choose(country)}
      >
        {countryLabel(country)}
        <span className="admin-choice-mark" aria-hidden />
      </button>
    );
  }
  return (
    <>
      <button
        type="button"
        className="admin-filter-trigger"
        aria-label={`国家：${countryLabel(value)}`}
        title={countryLabel(value)}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span>{countryLabel(value)}</span>
        <IconChevronDown aria-hidden />
      </button>
      {open && (
        <DetailDrawer variant="sheet" title="选择国家" onClose={() => setOpen(false)}>
          <p className="admin-muted">按用户最近一次接入地区筛选。</p>
          <div className="admin-choice-list">
            {option('')}
            <AsyncBoundary query={query}>{(data) => data.countries.map(option)}</AsyncBoundary>
          </div>
        </DetailDrawer>
      )}
    </>
  );
}
