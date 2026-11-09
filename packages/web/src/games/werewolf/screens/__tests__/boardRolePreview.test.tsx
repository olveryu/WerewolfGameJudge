/**
 * Board role previews use the real cards and keep the expanded board; the guide only browses
 * boards (no select button) and filters them by category and strategy tag.
 */
import {
  PRESET_TEMPLATES,
  TEMPLATE_CATEGORY_LABELS,
  TemplateCategory,
} from '@game-judge/game-engine/games/werewolf/public';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { BOARD_STRATEGY } from '@/games/werewolf/components/BoardStrategy/boardStrategyData';
import { BoardPickerScreen } from '@/games/werewolf/screens/BoardPickerScreen/BoardPickerScreen';
import { BoardsGuideContent } from '@/games/werewolf/screens/EncyclopediaScreen/BoardsGuideContent';

function renderInRouter(element: ReactElement) {
  render(<RouterProvider router={createMemoryRouter([{ path: '/', element }])} />);
}

/** The guide lifts the search and tag filter into its header; this host plays that part. */
function BoardsGuideHost() {
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [tagFilterVisible, setTagFilterVisible] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setTagFilterVisible(true)}>
        标签筛选
      </button>
      <BoardsGuideContent
        searchVisible={false}
        searchQuery=""
        setSearchQuery={vi.fn()}
        tagFilter={tagFilter}
        setTagFilter={setTagFilter}
        tagFilterDropdownVisible={tagFilterVisible}
        setTagFilterDropdownVisible={setTagFilterVisible}
      />
    </>
  );
}

function firstClassicTemplate() {
  const template = PRESET_TEMPLATES.find(
    (candidate) => candidate.category === TemplateCategory.Classic,
  );
  if (template === undefined) throw new Error('No classic preset');
  return template;
}

describe.each([
  {
    name: 'board picker',
    renderScreen: () =>
      renderInRouter(<BoardPickerScreen exitPath="/games" onSelect={vi.fn()} onCustom={vi.fn()} />),
  },
  { name: 'boards guide', renderScreen: () => renderInRouter(<BoardsGuideHost />) },
])('$name role preview', ({ renderScreen }) => {
  it('opens the selected role and preserves the expanded board after closing', () => {
    renderScreen();

    fireEvent.click(screen.getByText(firstClassicTemplate().name));
    fireEvent.click(screen.getByRole('button', { name: '预言家' }));

    expect(within(screen.getByTestId('role-card-modal')).getByText('预言家')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '知道了' }));

    expect(screen.queryByTestId('role-card-modal')).toBeNull();
    expect(screen.getByText(/点击角色名查看能力说明/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '女巫' }));
    expect(within(screen.getByTestId('role-card-modal')).getByText('女巫')).toBeVisible();
  });
});

describe('BoardsGuideContent', () => {
  it('browses boards without a select button', () => {
    renderInRouter(<BoardsGuideHost />);

    fireEvent.click(screen.getByText(firstClassicTemplate().name));

    expect(screen.getByText('点击角色名查看能力说明')).toBeVisible();
    expect(screen.getByRole('button', { name: '查看攻略' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '以此为基础' })).toBeNull();
  });

  it('filters by category and by strategy tag', async () => {
    renderInRouter(<BoardsGuideHost />);
    const classicCount = PRESET_TEMPLATES.filter(
      (template) => template.category === TemplateCategory.Classic,
    ).length;

    fireEvent.click(
      screen.getByRole('button', {
        name: `${TEMPLATE_CATEGORY_LABELS[TemplateCategory.Classic]} · ${classicCount}`,
      }),
    );
    expect(screen.getAllByRole('article')).toHaveLength(classicCount);

    const tag = '经典';
    const taggedClassics = PRESET_TEMPLATES.filter(
      (template) =>
        template.category === TemplateCategory.Classic &&
        BOARD_STRATEGY[template.name]?.tags.includes(tag),
    ).length;
    fireEvent.click(screen.getByRole('button', { name: '标签筛选' }));
    const dialog = await screen.findByRole('dialog', { name: '特色标签筛选' });
    fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`^${tag}\\d+$`) }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    expect(screen.getAllByRole('article')).toHaveLength(taggedClassics);
    fireEvent.click(screen.getByRole('button', { name: '清除标签筛选' }));
    expect(screen.getAllByRole('article')).toHaveLength(classicCount);
  });
});
