/**
 * Collapsible board configuration card. Games pass their own sections; the card renders them,
 * owns the collapse toggle and reports role presses. Game-specific actions go in `footer`.
 */
import './BoardInfoCard.css';

import { type ReactNode, useState } from 'react';

import { FactionChip } from '@/components/FactionChip';
import type { BoardInfoSection } from '@/features/room/model/BoardInfoSection';
import IconBookOutline from '~icons/ion/book-outline';
import IconBulbOutline from '~icons/ion/bulb-outline';
import IconChevronDown from '~icons/ion/chevron-down';
import IconChevronUp from '~icons/ion/chevron-up';
import IconDocumentTextOutline from '~icons/ion/document-text-outline';

export function BoardInfoCard({
  playerCount,
  sections,
  collapsed,
  onRolePress,
  onStrategyPress,
  onNotepadPress,
  footer,
}: {
  readonly playerCount: number;
  readonly sections: readonly BoardInfoSection[];
  /** The phase's default; a manual toggle overrides it for the rest of the visit. */
  readonly collapsed: boolean;
  /** Every role row opens a preview: a role the player cannot inspect is a bug. */
  readonly onRolePress: (roleId: string) => void;
  readonly onStrategyPress: (() => void) | null;
  readonly onNotepadPress: (() => void) | null;
  /** Game-specific actions under the roles (e.g. werewolf board nominations). */
  readonly footer: ReactNode;
}) {
  const [userCollapsed, setUserCollapsed] = useState<boolean | null>(null);
  const isCollapsed = userCollapsed ?? collapsed;

  return (
    <section className="board-info-card">
      <div className="board-info-header">
        <button
          type="button"
          className="board-info-toggle"
          aria-expanded={!isCollapsed}
          onClick={() => setUserCollapsed(!isCollapsed)}
        >
          <span className="board-info-title">配置（{playerCount}人）</span>
        </button>
        {onStrategyPress !== null && (
          <button type="button" className="board-info-pill" onClick={onStrategyPress}>
            <IconBookOutline aria-hidden />
            攻略
          </button>
        )}
        {onNotepadPress !== null && (
          <button type="button" className="board-info-pill" onClick={onNotepadPress}>
            <IconDocumentTextOutline aria-hidden />
            笔记
          </button>
        )}
        <button
          type="button"
          className="board-info-chevron"
          aria-label={isCollapsed ? '展开配置' : '收起配置'}
          aria-expanded={!isCollapsed}
          onClick={() => setUserCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <IconChevronDown aria-hidden /> : <IconChevronUp aria-hidden />}
        </button>
      </div>
      {!isCollapsed && (
        <div className="board-info-content">
          {sections.map(
            (section) =>
              section.items.length > 0 && (
                <div key={section.title} className="board-info-category">
                  <span className="board-info-category-label">{section.title}：</span>
                  <div className="board-info-chips">
                    {section.items.map((item) => (
                      <FactionChip
                        key={item.roleId}
                        label={
                          item.count > 1 ? `${item.displayName}×${item.count}` : item.displayName
                        }
                        color={section.color}
                        size="md"
                        onPress={() => onRolePress(item.roleId)}
                      />
                    ))}
                  </div>
                </div>
              ),
          )}
          <div className="board-info-footer">
            <span className="board-info-hint">
              <IconBulbOutline aria-hidden /> 点击角色名查看说明
            </span>
            {footer}
          </div>
        </div>
      )}
    </section>
  );
}
