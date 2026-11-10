/**
 * BoardsGuideContent — the guide's boards segment: category chips, the feature tag filter,
 * search, and the board cards (browse only, no select button). Display only.
 */
import '@/features/encyclopedia/Encyclopedia.css';
import './BoardsGuideContent.css';

import {
  getRoleSpec,
  PRESET_TEMPLATES,
  type PresetTemplate,
  TEMPLATE_CATEGORY_LABELS,
  TemplateCategory,
} from '@game-judge/game-engine/games/werewolf/public';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import { useViewportWidth } from '@/features/room/hooks/useViewportWidth';
import { BOARD_STRATEGY } from '@/games/werewolf/components/BoardStrategy/boardStrategyData';
import { BoardStrategyModal } from '@/games/werewolf/components/BoardStrategy/BoardStrategyModal';
import { RoleCardSimple } from '@/games/werewolf/components/RoleCardSimple';
import { BoardCard, estimateMaxChips } from '@/games/werewolf/screens/BoardPickerScreen/BoardCard';
import { useBoardRolePreview } from '@/games/werewolf/screens/useBoardRolePreview';
import IconAlbumsOutline from '~icons/ion/albums-outline';
import IconCheckmark from '~icons/ion/checkmark';
import IconCloseCircle from '~icons/ion/close-circle';
import IconSearch from '~icons/ion/search';

const CATEGORIES: readonly TemplateCategory[] = [
  TemplateCategory.Classic,
  TemplateCategory.Advanced,
  TemplateCategory.Special,
  TemplateCategory.ThirdParty,
];

const CATEGORY_TABS: readonly { readonly key: TemplateCategory; readonly label: string }[] =
  CATEGORIES.map((category) => ({
    key: category,
    label: `${TEMPLATE_CATEGORY_LABELS[category]} · ${
      PRESET_TEMPLATES.filter((template) => template.category === category).length
    }`,
  }));

function getBoardStrategy(name: string) {
  const strategy = BOARD_STRATEGY[name];
  if (strategy === undefined) throw new Error(`[FAIL-FAST] Board ${name} has no strategy`);
  return strategy;
}

/** Every strategy tag, by frequency (desc) then name. */
const ALL_BOARD_TAGS: readonly { readonly tag: string; readonly count: number }[] = (() => {
  const countMap = new Map<string, number>();
  for (const strategy of Object.values(BOARD_STRATEGY)) {
    for (const tag of strategy.tags) {
      countMap.set(tag, (countMap.get(tag) ?? 0) + 1);
    }
  }
  return [...countMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
    .map(([tag, count]) => ({ tag, count }));
})();

function matchesSearchQuery(template: PresetTemplate, query: string): boolean {
  if (query === '') return true;
  const lowerQuery = query.toLowerCase();
  if (template.name.toLowerCase().includes(lowerQuery)) return true;
  return template.roles.some((roleId) =>
    getRoleSpec(roleId).displayName.toLowerCase().includes(lowerQuery),
  );
}

interface BoardsGuideContentProps {
  readonly searchVisible: boolean;
  readonly searchQuery: string;
  readonly setSearchQuery: (query: string) => void;
  readonly tagFilter: string | null;
  readonly setTagFilter: (tag: string | null) => void;
  readonly tagFilterDropdownVisible: boolean;
  readonly setTagFilterDropdownVisible: (visible: boolean) => void;
}

/** Boards guide content area. */
export function BoardsGuideContent({
  searchVisible,
  searchQuery,
  setSearchQuery,
  tagFilter,
  setTagFilter,
  tagFilterDropdownVisible,
  setTagFilterDropdownVisible,
}: BoardsGuideContentProps) {
  const maxChips = estimateMaxChips(useViewportWidth());
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | null>(null);
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [strategyBoardName, setStrategyBoardName] = useState<string | null>(null);
  const { handleRolePress, roleCardProps } = useBoardRolePreview();

  const filteredTemplates = PRESET_TEMPLATES.filter(
    (template) =>
      (activeCategory === null || template.category === activeCategory) &&
      matchesSearchQuery(template, searchQuery) &&
      (tagFilter === null || getBoardStrategy(template.name).tags.includes(tagFilter)),
  );

  const closeTagFilter = () => setTagFilterDropdownVisible(false);

  return (
    <div className="encyclopedia-segment-body">
      {searchVisible && (
        <label className="encyclopedia-search">
          <IconSearch aria-hidden />
          <input
            type="search"
            className="encyclopedia-search-input"
            placeholder="搜索板子名/角色名"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            autoFocus
            autoCorrect="off"
            enterKeyHint="search"
          />
        </label>
      )}

      <div className="encyclopedia-filter-bar" role="group" aria-label="板子分类">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className="encyclopedia-filter-chip"
            aria-pressed={activeCategory === tab.key}
            onClick={() => setActiveCategory((previous) => (previous === tab.key ? null : tab.key))}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tagFilter !== null && (
        <div className="boards-guide-active-filter">
          <span className="boards-guide-active-filter-badge">
            {tagFilter}
            <button
              type="button"
              className="boards-guide-active-filter-clear"
              aria-label="清除标签筛选"
              onClick={() => setTagFilter(null)}
            >
              <IconCloseCircle aria-hidden />
            </button>
          </span>
        </div>
      )}

      <CenterDialog open={tagFilterDropdownVisible} onClose={closeTagFilter} title="特色标签筛选">
        <div className="encyclopedia-option-list">
          {ALL_BOARD_TAGS.map(({ tag, count }) => {
            const isActive = tagFilter === tag;
            return (
              <button
                key={tag}
                type="button"
                className="encyclopedia-option"
                aria-pressed={isActive}
                onClick={() => {
                  setTagFilter(isActive ? null : tag);
                  closeTagFilter();
                }}
              >
                <span className="encyclopedia-option-label">{tag}</span>
                <span className="encyclopedia-option-count">{count}</span>
                {isActive && <IconCheckmark aria-hidden />}
              </button>
            );
          })}
        </div>
        {tagFilter !== null && (
          <Button
            variant="ghost"
            onClick={() => {
              setTagFilter(null);
              closeTagFilter();
            }}
          >
            清除筛选
          </Button>
        )}
      </CenterDialog>

      {filteredTemplates.length > 0 ? (
        <div className="encyclopedia-list">
          {filteredTemplates.map((template) => (
            <BoardCard
              key={template.name}
              template={template}
              isExpanded={expandedName === template.name}
              onToggleExpand={(name) =>
                setExpandedName((previous) => (previous === name ? null : name))
              }
              onRolePress={handleRolePress}
              onStrategyPress={setStrategyBoardName}
              maxChips={maxChips}
            />
          ))}
        </div>
      ) : (
        <div className="encyclopedia-empty">
          <IconAlbumsOutline className="encyclopedia-empty-icon" aria-hidden />
          <p className="encyclopedia-empty-text">没有找到匹配的板子</p>
          <p className="encyclopedia-empty-hint">试试调整筛选条件</p>
        </div>
      )}

      <RoleCardSimple {...roleCardProps} />
      <BoardStrategyModal
        boardName={strategyBoardName}
        onClose={() => setStrategyBoardName(null)}
      />
    </div>
  );
}
