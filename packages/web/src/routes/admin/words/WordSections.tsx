/** The approved word workspace uses the existing segmented navigation and choice sheets. */
import type { GameWordGame, WordSubmissionItem } from '@game-judge/game-engine/product/wordSupply';
import { useState } from 'react';
import { Link } from 'react-router';

import IconChevronDown from '~icons/ion/chevron-down';

import { DetailDrawer } from '../components/Overlays';
import { StatusBadge } from '../components/Primitives';

export const WORD_GAME_LABELS = {
  fibking: '瞎掰王',
  undercover: '谁是卧底',
  drawguess: '你画我猜',
} as const;
export const SUBMISSION_STATUS_LABELS = {
  pending: '待启动审核',
  reviewing: '审核中',
  passed: '待确认发布',
  rejected: '模型未通过',
  failed: '审核失败',
  published: '已发布',
  dismissed: '已拒绝',
  unpublished: '已下架',
  duplicate: '重复内容',
} as const;

/** Navigation is URL-backed, including browser back and deep-linked batch details. */
export function WordSections({ game, section }: { game: GameWordGame; section: string }) {
  return (
    <nav className="admin-segmented admin-submission-sections" aria-label="词库工作区">
      {[
        ['inventory', '库存与供给'],
        ['submissions', '外部投稿'],
        ['agents', 'Agent 授权'],
      ].map(([value, label]) => (
        <Link
          key={value}
          to={`/admin/words/${game}${value === 'inventory' ? '' : `?section=${value}`}`}
          aria-current={section === value ? 'page' : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Match CountryFilter: a labeled trigger opens an accessible choice sheet, never a native select. */
export function WordChoiceFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  return (
    <>
      <button
        type="button"
        className="admin-filter-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}：${current?.label ?? value}`}
        onClick={() => setOpen(true)}
      >
        <span>{current?.label ?? value}</span>
        <IconChevronDown aria-hidden />
      </button>
      {open && (
        <DetailDrawer variant="sheet" title={`选择${label}`} onClose={() => setOpen(false)}>
          <div className="admin-choice-list">
            {options.map((option) => (
              <button
                type="button"
                className="admin-choice"
                key={option.value}
                aria-pressed={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
                <span className="admin-choice-mark" aria-hidden />
              </button>
            ))}
          </div>
        </DetailDrawer>
      )}
    </>
  );
}

/** Model rejection and transport failure are intentionally different states. */
export function SubmissionStatus({ status }: { status: WordSubmissionItem['status'] }) {
  return (
    <StatusBadge
      tone={
        status === 'published' || status === 'passed'
          ? 'success'
          : status === 'failed' || status === 'rejected'
            ? 'danger'
            : status === 'reviewing' || status === 'pending'
              ? 'warning'
              : 'neutral'
      }
    >
      {SUBMISSION_STATUS_LABELS[status]}
    </StatusBadge>
  );
}

/** Only unresolved, unlocked candidates participate in selection. */
export function isSelectableSubmission(item: WordSubmissionItem) {
  return ['pending', 'passed', 'failed', 'rejected'].includes(item.status);
}
