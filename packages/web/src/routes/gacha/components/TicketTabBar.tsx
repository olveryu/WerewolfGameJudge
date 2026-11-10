import './TicketTabBar.css';

import type { KeyboardEvent } from 'react';

import IconStar from '~icons/ion/star';
import IconTicketOutline from '~icons/ion/ticket-outline';

export type TicketTab = 'normal' | 'golden';

const TICKET_TABS: readonly TicketTab[] = ['normal', 'golden'];

/** The id of a ticket tab, for the panel's `aria-labelledby`. */
export function ticketTabId(tab: TicketTab): string {
  return `gacha-ticket-tab-${tab}`;
}

interface TicketTabBarProps {
  activeTab: TicketTab;
  normalCount: number;
  goldenCount: number;
  onSwitch: (tab: TicketTab) => void;
  /** The id of the tab panel the tabs control. */
  panelId: string;
  reducedMotion: boolean;
}

/** Normal and golden ticket tabs with their counts and a sliding highlight. */
export function TicketTabBar({
  activeTab,
  normalCount,
  goldenCount,
  onSwitch,
  panelId,
  reducedMotion,
}: TicketTabBarProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const target =
      event.key === 'Home'
        ? 'normal'
        : event.key === 'End'
          ? 'golden'
          : activeTab === 'normal'
            ? 'golden'
            : 'normal';
    onSwitch(target);
    document.getElementById(ticketTabId(target))?.focus();
  };

  return (
    <div
      className="ticket-tabs"
      role="tablist"
      aria-label="抽奖券类型"
      data-active={activeTab}
      data-reduced-motion={reducedMotion}
      onKeyDown={handleKeyDown}
    >
      <span className="ticket-tabs-slider" />
      {TICKET_TABS.map((tab) => {
        const isActive = tab === activeTab;
        const count = tab === 'normal' ? normalCount : goldenCount;
        const Icon = tab === 'normal' ? IconTicketOutline : IconStar;
        return (
          <button
            key={tab}
            id={ticketTabId(tab)}
            type="button"
            role="tab"
            className="ticket-tab"
            data-tab={tab}
            aria-selected={isActive}
            aria-controls={panelId}
            aria-label={`${tab === 'normal' ? '普通券' : '黄金券'} ${count} 张`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSwitch(tab)}
          >
            <span className="ticket-tab-icon">
              <Icon aria-hidden />
            </span>
            <span className="ticket-tab-label">{tab === 'normal' ? '普通' : '黄金'}</span>
            <span className="ticket-tab-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
