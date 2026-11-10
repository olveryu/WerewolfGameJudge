/**
 * Header actions of the roles segment: the ability filter (only when the source has a
 * `tagCatalog`) and search. The binding puts them under the shell's `segmentHeaderActions.roles`.
 */
import './Encyclopedia.css';

import { IconButton } from '@/components/IconButton';
import IconClose from '~icons/ion/close';
import IconFilter from '~icons/ion/filter';
import IconSearch from '~icons/ion/search';

import type { EncyclopediaRoleSource } from './encyclopediaSource';
import type { EncyclopediaRolesState } from './useEncyclopediaRolesState';

/** Roles segment header actions: ability filter (optional) and search. */
export function EncyclopediaRolesHeaderActions({
  source,
  state,
}: {
  readonly source: EncyclopediaRoleSource;
  readonly state: EncyclopediaRolesState;
}) {
  return (
    <>
      {source.tagCatalog && (
        <IconButton
          label="能力筛选"
          icon={<IconFilter aria-hidden />}
          className="encyclopedia-header-button"
          data-active={state.activeTag !== null}
          onClick={() => state.setTagDropdownVisible(true)}
        />
      )}
      <IconButton
        label="搜索"
        icon={state.searchVisible ? <IconClose aria-hidden /> : <IconSearch aria-hidden />}
        className="encyclopedia-header-button"
        onClick={state.toggleSearch}
      />
    </>
  );
}
