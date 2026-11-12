import { useState } from 'react';

import IconAddOutline from '~icons/ion/add-outline';

import { DetailDrawer } from './Overlays';

export interface SupplyAction {
  count: 1 | 10 | 100;
  force: boolean;
}

/** Offer explicit batch sizes in a responsive sheet, with force explicitly opt-in. */
export function SupplyControls({
  disabled,
  triggering,
  gameLabel,
  remainingBudget,
  onSelect,
}: {
  disabled: boolean;
  triggering: boolean;
  gameLabel: string;
  remainingBudget: number;
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
          gameLabel={gameLabel}
          remainingBudget={remainingBudget}
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
  gameLabel,
  remainingBudget,
  onClose,
  onSelect,
}: {
  gameLabel: string;
  remainingBudget: number;
  onClose: () => void;
  onSelect: (action: SupplyAction) => void;
}) {
  const [count, setCount] = useState<SupplyAction['count']>(1);
  const [force, setForce] = useState(false);
  return (
    <DetailDrawer variant="sheet" title="补充词库" onClose={onClose}>
      <p className="admin-muted">{gameLabel} · 触发新的词库供给任务</p>
      <div className="admin-supply-options">
        <span>触发次数</span>
        <div className="admin-segmented" role="group" aria-label="触发次数">
          {([1, 10, 100] as const).map((value) => (
            <button
              type="button"
              key={value}
              disabled={!force && value > remainingBudget}
              aria-pressed={value === count}
              onClick={() => setCount(value)}
            >
              {value} 次
            </button>
          ))}
        </div>
      </div>
      <label className="admin-supply-mode">
        <span>
          强制补词
          <small>忽略配额限制，可能额外消耗模型额度。</small>
        </span>
        <input
          type="checkbox"
          className="admin-switch"
          role="switch"
          aria-label="强制补词"
          checked={force}
          onChange={(event) => {
            setForce(event.target.checked);
            if (!event.target.checked && count > remainingBudget) setCount(1);
          }}
        />
      </label>
      <p className={`admin-supply-notice${force ? ' is-warning' : ''}`}>
        {force
          ? '强制模式将突破供给配额，请确认剩余额度后操作。'
          : `共享模型剩余额度 ${remainingBudget} 次；一次任务可能消耗多次额度。完成后请手动刷新。`}
      </p>
      <div className="admin-sheet-actions">
        <button type="button" onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="admin-primary"
          disabled={!force && count > remainingBudget}
          onClick={() => onSelect({ count, force })}
        >
          提交 {count} 次任务
        </button>
      </div>
    </DetailDrawer>
  );
}
