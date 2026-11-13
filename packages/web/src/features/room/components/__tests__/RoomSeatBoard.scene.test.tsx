/**
 * Seat board scene gating: the scene layer mounts only while some visible seat has a resident
 * decoration, the game allows decorations, the user has not switched them off and the system
 * does not ask for reduced motion.
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { RoomSeatBoard } from '@/features/room/components/RoomSeatBoard';
import type { RoomSeatPlayer, RoomSeatViewModel } from '@/features/room/model/RoomSeatDataSource';
import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import { displaySettings } from '@/features/settings/displaySettings';
import { TESTIDS } from '@/testids';

vi.mock('@/features/room/components/RoomSeatScene', () => ({
  RoomSeatSceneCanvas: () => <div data-testid="scene-canvas" />,
  RoomSeatResidents: ({ residents }: { residents: { flairId: string | null } }) => (
    <div data-testid="seat-residents">{residents.flairId}</div>
  ),
}));

function seat(index: number, player: Partial<RoomSeatPlayer> | null, decorationsEnabled = true) {
  return {
    seat: index,
    player:
      player === null
        ? null
        : {
            occupant: { kind: 'human', userId: `user-${index}` },
            displayName: `玩家${index + 1}`,
            isAnonymous: false,
            ...player,
          },
    isSelf: false,
    highlight: 'none',
    secondaryLabel: null,
    showReadyBadge: false,
    statusBadge: null,
    indicators: null,
    isStatusEmphasized: false,
    showLevel: false,
    decorationsEnabled,
  } satisfies RoomSeatViewModel;
}

function board(seats: readonly RoomSeatViewModel[], visuallyDisabled = false): RoomSeatBoardModel {
  return {
    source: { count: seats.length, revision: 1, getSeat: (index) => seats[index]! },
    visuallyDisabled,
    onSeatPress: () => {},
    onBotSeatLongPress: null,
  };
}

function renderBoard(seats: readonly RoomSeatViewModel[]) {
  return render(<RoomSeatBoard model={board(seats)} header={null} footer={null} />);
}

describe('RoomSeatBoard scene layer', () => {
  beforeEach(() => {
    localStorage.clear();
    displaySettings.setSeatDecorationsEnabled(true);
  });

  it('stays unloaded when no seated player has a resident decoration', () => {
    renderBoard([seat(0, {}), seat(1, { seatFlair: 'unknownFlair' }), seat(2, null)]);
    expect(screen.queryByTestId('scene-canvas')).toBeNull();
  });

  it('mounts the canvas and the seats that show a flair', async () => {
    renderBoard([seat(0, { seatFlair: 'fireRing' }), seat(1, {}), seat(2, null)]);
    expect(await screen.findByTestId('scene-canvas')).toBeInTheDocument();
    expect(screen.getAllByTestId('seat-residents').map((node) => node.textContent)).toEqual([
      'fireRing',
    ]);
  });

  it('marks only seats whose avatar frame the scene draws as framed', async () => {
    renderBoard([seat(0, { avatarFrame: 'ironForge' }), seat(1, { seatFlair: 'fireRing' })]);
    expect(await screen.findByTestId('scene-canvas')).toBeInTheDocument();
    expect(screen.getAllByTestId('seat-residents')).toHaveLength(2);
    expect(screen.getByTestId(TESTIDS.seatTilePressable(0))).toHaveAttribute('data-framed', 'true');
    expect(screen.getByTestId(TESTIDS.seatTilePressable(1))).toHaveAttribute(
      'data-framed',
      'false',
    );
  });

  it('mounts the scene for a pet or an entrance and stages only entrance avatars', async () => {
    renderBoard([
      seat(0, { seatPetId: 'tarot' }),
      seat(1, { seatAnimation: 'fadeRedEnter' }),
      seat(2, { seatPetId: 'random', seatAnimation: 'unknownEnter' }),
    ]);
    expect(await screen.findByTestId('scene-canvas')).toBeInTheDocument();
    expect(screen.getAllByTestId('seat-residents')).toHaveLength(2);
    const stages = document.querySelectorAll('.seat-avatar-stage');
    expect([...stages].map((stage) => stage.getAttribute('data-entrance'))).toEqual([
      'false',
      'true',
      'false',
    ]);
  });

  it('shows no resident decorations when the game or the user turns them off', () => {
    const { unmount } = renderBoard([seat(0, { seatFlair: 'fireRing' }, false)]);
    expect(screen.queryByTestId('scene-canvas')).toBeNull();
    unmount();

    displaySettings.setSeatDecorationsEnabled(false);
    renderBoard([seat(0, { seatFlair: 'fireRing' })]);
    expect(screen.queryByTestId('scene-canvas')).toBeNull();
  });

  it('shows no resident decorations under reduced motion', () => {
    const noPreference = window.matchMedia;
    const matchMedia = vi
      .spyOn(window, 'matchMedia')
      .mockImplementation((query) => ({ ...noPreference(query), matches: true }));
    renderBoard([seat(0, { seatFlair: 'fireRing' })]);
    expect(screen.queryByTestId('scene-canvas')).toBeNull();
    matchMedia.mockRestore();
  });

  it('places the lobby level badge on the avatar, separate from the name', () => {
    const onSeatPress = vi.fn();
    const seatWithLevel = seat(0, { level: 42 });
    const { getByTestId } = render(
      <RoomSeatBoard
        model={{ ...board([{ ...seatWithLevel, showLevel: true }]), onSeatPress }}
        header={null}
        footer={null}
      />,
    );

    const button = getByTestId(TESTIDS.seatTilePressable(0));
    const levelBadge = screen.getByText('42').closest<HTMLElement>('.seat-level-badge');
    const nameRow = getByTestId(TESTIDS.seatNameRow(0));

    expect(button).toContainElement(levelBadge);
    expect(nameRow).not.toContainElement(levelBadge);
    expect(levelBadge).toHaveTextContent('Lv.42');
    expect(button).toHaveAccessibleName('1号座位 玩家1，等级 42');

    fireEvent.click(button);
    expect(onSeatPress).toHaveBeenCalledWith(0, undefined);
  });

  it('prevents seat interaction while the board is visually disabled', () => {
    const onSeatPress = vi.fn();
    render(
      <RoomSeatBoard
        model={{ ...board([seat(0, null)], true), onSeatPress }}
        header={null}
        footer={null}
      />,
    );

    const button = screen.getByTestId(TESTIDS.seatTilePressable(0));
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onSeatPress).not.toHaveBeenCalled();
  });

  it('omits the level badge when the seat has a secondary label', () => {
    const seatWithLevel = seat(0, { level: 42 });

    renderBoard([{ ...seatWithLevel, showLevel: true, secondaryLabel: '预言家' }]);

    expect(screen.queryByText('42')).not.toBeInTheDocument();
  });
});
