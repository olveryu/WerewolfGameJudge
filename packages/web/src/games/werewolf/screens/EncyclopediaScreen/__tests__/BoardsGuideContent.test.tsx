import { render, screen } from '@testing-library/react';

import { BoardsGuideContent } from '@/games/werewolf/screens/EncyclopediaScreen/BoardsGuideContent';

describe('BoardsGuideContent', () => {
  it('gives the board search an accessible name', () => {
    render(
      <BoardsGuideContent
        searchVisible
        searchQuery=""
        setSearchQuery={vi.fn()}
        tagFilter={null}
        setTagFilter={vi.fn()}
        tagFilterDropdownVisible={false}
        setTagFilterDropdownVisible={vi.fn()}
      />,
    );

    expect(screen.getByRole('searchbox', { name: '搜索板子名/角色名' })).toHaveFocus();
  });
});
