import { useState } from 'react';

import { Select } from '@/components/Select';
import IconAddOutline from '~icons/ion/add-outline';

import { DetailDrawer } from './Overlays';

export interface SupplyAction {
  count: 1 | 10 | 100;
  category: string;
}

/** Offer explicit batch sizes in a responsive sheet. */
export function SupplyControls({
  categories,
  disabled,
  triggering,
  gameLabel,
  onSelect,
}: {
  categories: readonly { id: string; name: string; active: number }[];
  disabled: boolean;
  triggering: boolean;
  gameLabel: string;
  onSelect: (action: SupplyAction) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="admin-primary admin-supply-trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <IconAddOutline aria-hidden />
        {triggering ? '正在触发…' : '补词'}
      </button>
      {open && (
        <SupplyDialog
          categories={categories}
          gameLabel={gameLabel}
          onClose={() => setOpen(false)}
          onSelect={(action) => {
            setOpen(false);
            onSelect(action);
          }}
        />
      )}
    </>
  );
}

function SupplyDialog({
  categories,
  gameLabel,
  onClose,
  onSelect,
}: {
  categories: readonly { id: string; name: string; active: number }[];
  gameLabel: string;
  onClose: () => void;
  onSelect: (action: SupplyAction) => void;
}) {
  const [count, setCount] = useState<SupplyAction['count']>(1);
  const [category, setCategory] = useState(categories[0]?.id ?? '');
  return (
    <DetailDrawer variant="sheet" title="补充词库" onClose={onClose}>
      <p className="admin-muted">{gameLabel} · 触发新的词库供给任务</p>
      <p className="admin-muted">触发后生成并入队等待审核，不自动审核发布。完成后请手动刷新。</p>
      <label className="admin-supply-category">
        <span>目标类别</span>
        <Select value={category} onChange={(event) => setCategory(event.currentTarget.value)}>
          {categories.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}（{new Intl.NumberFormat('zh-CN').format(option.active)}）
            </option>
          ))}
        </Select>
      </label>
      <div className="admin-supply-options">
        <span>触发次数</span>
        <div className="admin-segmented" role="group" aria-label="触发次数">
          {([1, 10, 100] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={value === count}
              onClick={() => setCount(value)}
            >
              {value} 次
            </button>
          ))}
        </div>
      </div>
      <div className="admin-sheet-actions">
        <button type="button" onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="admin-primary"
          disabled={category === ''}
          onClick={() => onSelect({ count, category })}
        >
          提交 {count} 次任务
        </button>
      </div>
    </DetailDrawer>
  );
}
