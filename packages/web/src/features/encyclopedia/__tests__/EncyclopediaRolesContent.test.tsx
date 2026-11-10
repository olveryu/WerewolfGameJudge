/** The shared roles segment: faction and ability filters, search, and the role detail sheet. */
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { EncyclopediaRolesContent } from '@/features/encyclopedia/EncyclopediaRolesContent';
import { EncyclopediaRolesHeaderActions } from '@/features/encyclopedia/EncyclopediaRolesHeaderActions';
import type {
  EncyclopediaRoleEntry,
  EncyclopediaRoleSource,
} from '@/features/encyclopedia/encyclopediaSource';
import { useEncyclopediaRolesState } from '@/features/encyclopedia/useEncyclopediaRolesState';
import { TESTIDS } from '@/testids';

const SCOUT_TAG = { key: 'scout', label: '侦查', colorKey: 'info' } as const;
const STRIKE_TAG = { key: 'strike', label: '击杀', colorKey: 'error' } as const;

function entry(
  id: string,
  displayName: string,
  factionKey: 'light' | 'dark',
  tags: EncyclopediaRoleEntry['tags'],
): EncyclopediaRoleEntry {
  return {
    id,
    displayName,
    factionKey,
    factionLabel: factionKey === 'light' ? '光明阵营' : '黑暗阵营',
    factionColorKey: factionKey === 'light' ? 'god' : 'wolf',
    description: `${displayName}的介绍`,
    searchText: `${displayName}${id}`,
    structuredFields: [],
    tags,
  };
}

const SOURCE: EncyclopediaRoleSource = {
  roles: [
    entry('watcher', '守望者', 'light', [SCOUT_TAG]),
    entry('knight', '骑士', 'light', [STRIKE_TAG]),
    entry('shade', '暗影', 'dark', [STRIKE_TAG]),
  ],
  factionGroups: [
    { key: 'light', label: '光明', colorKey: 'god' },
    { key: 'dark', label: '黑暗', colorKey: 'wolf' },
  ],
  tagCatalog: [SCOUT_TAG, STRIKE_TAG],
};

function RolesSegment({ initialRoleId }: { readonly initialRoleId?: string }) {
  const state = useEncyclopediaRolesState(SOURCE, initialRoleId);
  return (
    <>
      <EncyclopediaRolesHeaderActions source={SOURCE} state={state} />
      <EncyclopediaRolesContent source={SOURCE} state={state} />
    </>
  );
}

function visibleRoleIds() {
  return SOURCE.roles
    .map((role) => role.id)
    .filter((id) => screen.queryByTestId(TESTIDS.encyclopediaRoleItem(id)) !== null);
}

describe('EncyclopediaRolesContent', () => {
  it('groups every role by faction and narrows to one faction', () => {
    render(<RolesSegment />);

    expect(screen.getByRole('heading', { name: '光明 · 2' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '黑暗 · 1' })).toBeVisible();

    fireEvent.click(screen.getByTestId(TESTIDS.encyclopediaFactionTab('dark')));
    expect(visibleRoleIds()).toEqual(['shade']);
    fireEvent.click(screen.getByTestId(TESTIDS.encyclopediaFactionTab('dark')));
    expect(visibleRoleIds()).toEqual(['watcher', 'knight', 'shade']);
  });

  it('filters by ability tag and clears the filter', async () => {
    render(<RolesSegment />);

    fireEvent.click(screen.getByRole('button', { name: '能力筛选' }));
    const dialog = await screen.findByRole('dialog', { name: '能力筛选' });
    fireEvent.click(within(dialog).getByTestId(TESTIDS.encyclopediaTagFilter('strike')));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(visibleRoleIds()).toEqual(['knight', 'shade']);

    fireEvent.click(screen.getByRole('button', { name: '能力筛选' }));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: '能力筛选' })).getByRole('button', {
        name: '清除筛选',
      }),
    );
    expect(visibleRoleIds()).toEqual(['watcher', 'knight', 'shade']);
  });

  it('searches across factions and shows the empty state', () => {
    render(<RolesSegment />);

    fireEvent.click(screen.getByTestId(TESTIDS.encyclopediaFactionTab('dark')));
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));
    fireEvent.change(screen.getByPlaceholderText('搜索角色名/技能'), { target: { value: '骑' } });
    expect(visibleRoleIds()).toEqual(['knight']);

    fireEvent.change(screen.getByPlaceholderText('搜索角色名/技能'), { target: { value: '无' } });
    expect(screen.getByText('没有找到匹配的角色')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(screen.queryByPlaceholderText('搜索角色名/技能')).toBeNull();
    expect(visibleRoleIds()).toEqual(['shade']);
  });

  it('opens a role detail from the list and closes it', () => {
    render(<RolesSegment />);

    fireEvent.click(screen.getByTestId(TESTIDS.encyclopediaRoleItem('knight')));
    const sheet = screen.getByRole('dialog', { name: '骑士' });
    expect(within(sheet).getByText('光明阵营')).toBeVisible();
    expect(within(sheet).getByText('骑士的介绍')).toBeVisible();

    fireEvent.click(within(sheet).getByRole('button', { name: '知道了' }));
    expect(screen.queryByRole('dialog', { name: '骑士' })).toBeNull();
  });

  it('opens the deep-linked role and follows a new deep link', () => {
    const { result, rerender } = renderHook(
      ({ roleId }: { roleId?: string }) => useEncyclopediaRolesState(SOURCE, roleId),
      { initialProps: { roleId: 'shade' } },
    );
    expect(result.current.selectedRoleId).toBe('shade');

    act(() => result.current.handleCloseDetail());
    expect(result.current.selectedRoleId).toBeNull();

    rerender({ roleId: 'watcher' });
    expect(result.current.selectedRoleId).toBe('watcher');
  });
});
