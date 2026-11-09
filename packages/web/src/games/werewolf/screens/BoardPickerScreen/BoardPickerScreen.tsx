/**
 * BoardPickerScreen — full-screen board picker page (first step of room creation)
 *
 * Preset template cards by category (Classic / Advanced / Special / Third-party), each with
 * name + faction stats + key differentiating role chips. The search bar filters by name and
 * role name; the role filter keeps boards holding every chosen role. The bottom "Custom"
 * entry skips presets and goes directly to the role config.
 */
import '@/games/werewolf/components/faction.css';
import './BoardPickerScreen.css';

import {
  TEMPLATE_CATEGORY_LABELS,
  TemplateCategory,
} from '@game-judge/game-engine/games/werewolf/public';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import { IconButton } from '@/components/IconButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useViewportWidth } from '@/features/room/hooks/useViewportWidth';
import { BoardStrategyModal } from '@/games/werewolf/components/BoardStrategy/BoardStrategyModal';
import { RoleCardSimple } from '@/games/werewolf/components/RoleCardSimple';
import { useBoardRolePreview } from '@/games/werewolf/screens/useBoardRolePreview';
import { TESTIDS } from '@/testids';
import IconChevronDown from '~icons/ion/chevron-down';
import IconChevronUp from '~icons/ion/chevron-up';
import IconClose from '~icons/ion/close';
import IconCreateOutline from '~icons/ion/create-outline';
import IconFunnel from '~icons/ion/funnel';
import IconFunnelOutline from '~icons/ion/funnel-outline';
import IconSearch from '~icons/ion/search';

import { BoardCard, estimateMaxChips } from './BoardCard';
import { useBoardPickerScreenState } from './useBoardPickerScreenState';

/** Tab order for category filter bar */
const CATEGORY_TABS: readonly TemplateCategory[] = [
  TemplateCategory.Classic,
  TemplateCategory.Advanced,
  TemplateCategory.Special,
  TemplateCategory.ThirdParty,
];

interface BoardPickerScreenProps {
  /** Where Back goes when the picker is the first page of a directly opened flow. */
  readonly exitPath: string;
  readonly onSelect: (presetName: string) => void;
  readonly onCustom: () => void;
}

/** Board picker screen. */
export function BoardPickerScreen({ exitPath, onSelect, onCustom }: BoardPickerScreenProps) {
  const maxChips = estimateMaxChips(useViewportWidth());
  const { handleRolePress, roleCardProps } = useBoardRolePreview();
  const state = useBoardPickerScreenState();
  const [strategyBoardName, setStrategyBoardName] = useState<string | null>(null);
  const filterCount = state.selectedRoleIds.size;

  return (
    <div className="board-picker-page" data-testid={TESTIDS.boardPickerScreenRoot}>
      <ScreenHeader title="选择板子" parentPath={exitPath}>
        <span className="board-picker-filter-button">
          <IconButton
            label="筛选角色"
            icon={
              state.filterVisible ? <IconFunnel aria-hidden /> : <IconFunnelOutline aria-hidden />
            }
            data-active={filterCount > 0}
            onClick={state.toggleFilter}
          />
          {filterCount > 0 && (
            <span className="board-picker-filter-badge" aria-hidden>
              {filterCount}
            </span>
          )}
        </span>
        <IconButton
          label="搜索"
          icon={state.searchVisible ? <IconClose aria-hidden /> : <IconSearch aria-hidden />}
          onClick={state.toggleSearch}
        />
      </ScreenHeader>

      {state.searchVisible ? (
        <label className="board-picker-search">
          <IconSearch aria-hidden />
          <input
            type="search"
            className="board-picker-search-input"
            placeholder="搜索模板或角色"
            value={state.searchQuery}
            onChange={(event) => state.setSearchQuery(event.currentTarget.value)}
            autoFocus
            autoCorrect="off"
            enterKeyHint="search"
          />
        </label>
      ) : (
        <div className="board-picker-tabs" role="group" aria-label="板子分类">
          {CATEGORY_TABS.map((category) => (
            <button
              key={category}
              type="button"
              className="board-picker-tab"
              aria-pressed={state.activeCategory === category}
              onClick={() => state.handleTabPress(category)}
            >
              {TEMPLATE_CATEGORY_LABELS[category]} {state.categoryCounts.get(category) ?? 0}
            </button>
          ))}
        </div>
      )}

      <main className="board-picker-list">
        {state.sections.length === 0 ? (
          <div className="board-picker-empty">
            <p className="board-picker-empty-text">没有匹配的模板</p>
            <Button variant="ghost" onClick={state.handleClearSearch}>
              清除搜索
            </Button>
          </div>
        ) : (
          state.sections.map((section, index) => (
            <section key={section.category} aria-label={section.title}>
              <h2
                className="board-picker-section-header"
                data-tone={index % 2 === 0 ? 'god' : 'warning'}
              >
                {section.title}
              </h2>
              {section.data.map((template) => (
                <BoardCard
                  key={template.name}
                  template={template}
                  isExpanded={state.expandedName === template.name}
                  onToggleExpand={state.handleToggleExpand}
                  onSelect={onSelect}
                  onRolePress={handleRolePress}
                  onStrategyPress={setStrategyBoardName}
                  maxChips={maxChips}
                />
              ))}
            </section>
          ))
        )}
      </main>

      <footer className="board-picker-bottom">
        <button type="button" className="board-picker-custom" onClick={onCustom}>
          <IconCreateOutline aria-hidden />
          从零开始自定义配置
        </button>
      </footer>

      <CenterDialog open={state.filterVisible} onClose={state.toggleFilter} title="筛选角色">
        <div className="board-picker-filter-groups">
          {state.filterGroups.map((group) => {
            const isSectionExpanded = state.expandedFactions.has(group.label);
            const selectedInGroup = group.items.filter((item) =>
              state.selectedRoleIds.has(item.roleId),
            ).length;
            return (
              <div key={group.label} data-faction={group.faction}>
                <button
                  type="button"
                  className="board-picker-filter-section"
                  aria-expanded={isSectionExpanded}
                  onClick={() => state.handleToggleFactionSection(group.label)}
                >
                  <span className="board-picker-filter-section-label">{group.label}</span>
                  <span className="board-picker-filter-section-count">
                    {selectedInGroup > 0 ? `${selectedInGroup}/` : ''}
                    {group.items.length}
                  </span>
                  {isSectionExpanded ? (
                    <IconChevronUp aria-hidden />
                  ) : (
                    <IconChevronDown aria-hidden />
                  )}
                </button>
                {isSectionExpanded && (
                  <div className="board-picker-filter-chips">
                    {group.items.map((item) => (
                      <button
                        key={item.roleId}
                        type="button"
                        className="board-picker-filter-chip"
                        aria-pressed={state.selectedRoleIds.has(item.roleId)}
                        onClick={() => state.handleToggleRole(item.roleId)}
                      >
                        {item.displayName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="board-picker-filter-hint">部分角色不在预设板子中，可通过“自定义配置”添加</p>
        <div className="board-picker-filter-footer">
          {filterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={state.handleClearFilter}>
              清除筛选
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={state.toggleFilter}>
            确认
          </Button>
        </div>
      </CenterDialog>

      <RoleCardSimple {...roleCardProps} />

      <BoardStrategyModal
        boardName={strategyBoardName}
        onClose={() => setStrategyBoardName(null)}
      />
    </div>
  );
}
