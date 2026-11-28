import './TicketTabBar.css';

import { TabList } from '@/components/Tabs';
import IconStar from '~icons/ion/star';
import IconTicketOutline from '~icons/ion/ticket-outline';

export type TicketTab = 'normal' | 'golden';

/** The ticket type a tab value names; tab values only ever come from `TicketTabList`. */
export function parseTicketTab(value: string): TicketTab {
  if (value === 'normal' || value === 'golden') return value;
  throw new Error(`[FAIL-FAST] Unknown ticket tab: ${value}`);
}

function TicketCount({ tab, count }: { readonly tab: TicketTab; readonly count: number }) {
  return (
    <span className="ticket-tab-count" data-tab={tab}>
      {count}
      <span className="visually-hidden"> 张</span>
    </span>
  );
}

/** Normal and golden ticket tabs with their counts; render inside a `Tabs` valued by `TicketTab`. */
export function TicketTabList({
  normalCount,
  goldenCount,
}: {
  readonly normalCount: number;
  readonly goldenCount: number;
}) {
  return (
    <TabList
      label="抽奖券类型"
      variant="segmented"
      items={[
        {
          value: 'normal',
          label: '普通',
          icon: (
            <span className="ticket-tab-icon" data-tab="normal">
              <IconTicketOutline aria-hidden />
            </span>
          ),
          trailing: <TicketCount tab="normal" count={normalCount} />,
        },
        {
          value: 'golden',
          label: '黄金',
          icon: (
            <span className="ticket-tab-icon" data-tab="golden">
              <IconStar aria-hidden />
            </span>
          ),
          trailing: <TicketCount tab="golden" count={goldenCount} />,
        },
      ]}
    />
  );
}
