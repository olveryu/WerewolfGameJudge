/**
 * Shared encyclopedia "roles" segment: faction filter tabs, the ability tag filter (when the
 * source has a `tagCatalog`), search, the two-column role grid and the role detail sheet. The
 * shell's binding owns the state and passes it in.
 */
import './Encyclopedia.css';

import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import { TESTIDS } from '@/testids';
import IconCheckmark from '~icons/ion/checkmark';
import IconSearch from '~icons/ion/search';

import { EncyclopediaRoleDetailSheet } from './EncyclopediaRoleDetailSheet';
import { EncyclopediaRoleListItem } from './EncyclopediaRoleListItem';
import type { EncyclopediaRoleSource } from './encyclopediaSource';
import type { EncyclopediaRolesState } from './useEncyclopediaRolesState';

function findSelectedEntry(source: EncyclopediaRoleSource, roleId: string | null) {
  if (roleId === null) return null;
  const entry = source.roles.find((candidate) => candidate.id === roleId);
  if (entry === undefined) throw new Error(`[Encyclopedia] Unknown role: ${roleId}`);
  return entry;
}

/** Roles segment content. */
export function EncyclopediaRolesContent({
  source,
  state,
}: {
  readonly source: EncyclopediaRoleSource;
  readonly state: EncyclopediaRolesState;
}) {
  const tagCatalog = source.tagCatalog;
  const selectedEntry = findSelectedEntry(source, state.selectedRoleId);

  return (
    <div className="encyclopedia-segment-body">
      {state.searchVisible && (
        <label className="encyclopedia-search">
          <IconSearch aria-hidden />
          <input
            type="search"
            className="encyclopedia-search-input"
            placeholder="搜索角色名/技能"
            value={state.searchQuery}
            onChange={(event) => state.setSearchQuery(event.currentTarget.value)}
            autoFocus
            autoCorrect="off"
            enterKeyHint="search"
          />
        </label>
      )}

      <div className="encyclopedia-filter-bar" role="group" aria-label="阵营筛选">
        {source.factionGroups.map((group) => (
          <button
            key={group.key}
            type="button"
            className="encyclopedia-filter-chip"
            aria-pressed={state.activeFilter === group.key}
            data-testid={TESTIDS.encyclopediaFactionTab(group.key)}
            onClick={() => state.handleFactionChange(group.key)}
          >
            {group.label} · {state.getTabCount(group.key)}
          </button>
        ))}
      </div>

      {tagCatalog && (
        <CenterDialog
          open={state.tagDropdownVisible}
          onClose={() => state.setTagDropdownVisible(false)}
          title="能力筛选"
        >
          <div className="encyclopedia-option-list">
            {tagCatalog.map((tag) => {
              const isActive = state.activeTag === tag.key;
              const count = state.getTagCount(tag.key);
              if (count === 0 && !isActive) return null;
              return (
                <button
                  key={tag.key}
                  type="button"
                  className="encyclopedia-option"
                  aria-pressed={isActive}
                  data-testid={TESTIDS.encyclopediaTagFilter(tag.key)}
                  onClick={() => state.handleTagPress(tag.key)}
                >
                  <span className="encyclopedia-option-label">{tag.label}</span>
                  {count > 0 && <span className="encyclopedia-option-count">{count}</span>}
                  {isActive && <IconCheckmark aria-hidden />}
                </button>
              );
            })}
          </div>
          {state.activeTag !== null && (
            <Button
              variant="ghost"
              onClick={() => {
                state.setActiveTag(null);
                state.setTagDropdownVisible(false);
              }}
            >
              清除筛选
            </Button>
          )}
        </CenterDialog>
      )}

      {state.totalCount > 0 ? (
        <div className="encyclopedia-list">
          {state.sections.map((section) => (
            <section key={section.key} aria-label={section.title}>
              <h2 className="encyclopedia-section-header" data-color-key={section.colorKey}>
                {section.title}
              </h2>
              <div className="encyclopedia-grid">
                {section.entries.map((entry) => (
                  <EncyclopediaRoleListItem
                    key={entry.id}
                    entry={entry}
                    onPress={state.handleRolePress}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="encyclopedia-empty">
          <IconSearch className="encyclopedia-empty-icon" aria-hidden />
          <p className="encyclopedia-empty-text">没有找到匹配的角色</p>
          <p className="encyclopedia-empty-hint">试试调整筛选条件</p>
        </div>
      )}

      {selectedEntry !== null && (
        <EncyclopediaRoleDetailSheet entry={selectedEntry} onClose={state.handleCloseDetail} />
      )}
    </div>
  );
}
