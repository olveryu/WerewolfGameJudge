/** RoleRow and BoardTray: row toggles, info button opens the card, tray tokens remove. */
import { fireEvent, render, screen } from '@testing-library/react';

import { BoardTray } from '@/games/werewolf/screens/ConfigScreen/components/BoardTray';
import { RoleRow } from '@/games/werewolf/screens/ConfigScreen/components/RoleRow';
import { buildInitialSelection } from '@/games/werewolf/screens/ConfigScreen/configData';
import type { VariantOverrides } from '@/games/werewolf/screens/ConfigScreen/configHelpers';
import { TESTIDS } from '@/testids';

describe('RoleRow', () => {
  it('renders its label, one-liner and selected state', () => {
    render(
      <RoleRow
        id="seer"
        label="预言家"
        oneLiner="每晚可查验一名玩家的阵营"
        selected
        onToggle={vi.fn()}
        faction="god"
      />,
    );

    const row = screen.getByTestId(TESTIDS.configRoleRow('seer'));
    expect(row).toHaveTextContent('预言家');
    expect(row).toHaveTextContent('每晚可查验一名玩家的阵营');
    expect(row).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onToggle with its id when the row is pressed without opening the card', () => {
    const onToggle = vi.fn<(id: string) => void>();
    const onInfoPress = vi.fn<(id: string) => void>();
    render(
      <RoleRow
        id="witch"
        label="女巫"
        oneLiner="拥有一瓶解药和一瓶毒药"
        selected={false}
        onToggle={onToggle}
        faction="god"
        onInfoPress={onInfoPress}
      />,
    );

    fireEvent.click(screen.getByTestId(TESTIDS.configRoleRow('witch')));

    expect(onToggle).toHaveBeenCalledWith('witch');
    expect(onInfoPress).not.toHaveBeenCalled();
  });

  it('opens the role info when the info button is pressed without toggling', () => {
    const onToggle = vi.fn<(id: string) => void>();
    const onInfoPress = vi.fn<(id: string) => void>();
    render(
      <RoleRow
        id="witch"
        label="女巫"
        oneLiner="拥有一瓶解药和一瓶毒药"
        selected={false}
        onToggle={onToggle}
        faction="god"
        onInfoPress={onInfoPress}
      />,
    );

    fireEvent.click(screen.getByTestId(TESTIDS.configRoleRowInfo('witch')));

    expect(onInfoPress).toHaveBeenCalledWith('witch');
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('BoardTray', () => {
  const renderTray = (overrides?: {
    totalCount?: number;
    targetPlayerCount?: number | null;
    variantOverrides?: VariantOverrides;
  }) => {
    const onRemoveToken = vi.fn<(key: string) => void>();
    render(
      <BoardTray
        selection={buildInitialSelection()}
        variantOverrides={overrides?.variantOverrides ?? {}}
        totalCount={overrides?.totalCount ?? 12}
        targetPlayerCount={overrides?.targetPlayerCount ?? 12}
        onRemoveToken={onRemoveToken}
      />,
    );
    return { onRemoveToken };
  };

  it('shows faction counts, selected tokens and the target', () => {
    renderTray();

    expect(screen.getByTestId(TESTIDS.configBoardTray)).not.toHaveTextContent('已选');
    expect(screen.getByTestId(TESTIDS.configBoardTray)).toHaveTextContent('目标 12 人');
    expect(screen.getByText('平民×4')).toBeInTheDocument();
    expect(screen.getByText('狼人×4')).toBeInTheDocument();
    expect(screen.getByText('女巫')).toBeInTheDocument();
  });

  it('removes one copy when a token is pressed', () => {
    const { onRemoveToken } = renderTray();

    fireEvent.click(screen.getByTestId(TESTIDS.configBoardTrayToken('witch')));

    expect(onRemoveToken).toHaveBeenCalledWith('witch');
  });

  it('warns without blocking when the board goes over the target', () => {
    renderTray({ totalCount: 13, targetPlayerCount: 12 });

    expect(screen.getByText('多出 1 人')).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.configBoardTray)).toHaveTextContent('目标 12 人');
    expect(screen.getByTestId(TESTIDS.configBoardTray)).not.toHaveTextContent('已选');
  });

  it('shows no target for a blank custom board', () => {
    render(
      <BoardTray
        selection={buildInitialSelection([])}
        variantOverrides={{}}
        totalCount={0}
        targetPlayerCount={null}
        onRemoveToken={vi.fn()}
      />,
    );

    expect(screen.getByTestId(TESTIDS.configBoardTray)).not.toHaveTextContent('已选');
    expect(screen.queryByText(/目标/)).not.toBeInTheDocument();
    expect(screen.queryByTestId(TESTIDS.configBoardTrayToken('witch'))).not.toBeInTheDocument();
  });
});
