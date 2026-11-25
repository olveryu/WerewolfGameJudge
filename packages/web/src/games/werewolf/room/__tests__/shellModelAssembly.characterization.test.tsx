/**
 * Characterization tests for the WerewolfRoomScreen shell-model assembly.
 *
 * Pins the RoomShellModel the screen assembles from the room state
 * (bottom-action branching, seat gating, host-management presence, header
 * wiring) so a refactor of the assembly cannot silently change behavior.
 * The RoomShell itself is replaced by a probe that captures the model.
 */

import { GameStatus, type RoleId } from '@game-judge/game-engine/games/werewolf/public';

import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import {
  createWerewolfRoomMock,
  createWerewolfRoomMockFromState,
  mountWerewolfRoom,
  type WerewolfRoomMock,
  type WerewolfRoomMockOptions,
} from '@/games/werewolf/room/__tests__/harness';
import { createBoardNightState } from '@/games/werewolf/room/__tests__/harness/boardNightScenarios';
import { TESTIDS } from '@/testids';

const shellProbe = vi.hoisted(() => ({ model: null as RoomShellModel | null }));

vi.mock('@/contexts/AuthContext', () => import('./harness/testAuthContext'));
vi.mock('@/features/room/components/RoomShell', async () => {
  const { TESTIDS: ids } = await import('@/testids');
  return {
    RoomShell: (props: { readonly model: RoomShellModel }) => {
      shellProbe.model = props.model;
      return <div data-testid={ids.roomScreenRoot} />;
    },
  };
});

/** A 4-seat seer step; overrides describe the viewer and the room phase. */
function seerStepRoom(overrides: Partial<WerewolfRoomMockOptions>): WerewolfRoomMockOptions {
  return {
    schemaId: 'seerCheck',
    currentActionRole: 'seer',
    myRole: 'villager',
    mySeat: 3,
    numberOfPlayers: 4,
    ...overrides,
  };
}

async function captureModel(options: WerewolfRoomMockOptions): Promise<RoomShellModel> {
  return captureMockModel(createWerewolfRoomMock(options));
}

async function captureMockModel(mock: WerewolfRoomMock): Promise<RoomShellModel> {
  shellProbe.model = null;
  const view = await mountWerewolfRoom(mock);
  expect(view.getByTestId(TESTIDS.roomScreenRoot)).toBeInTheDocument();
  view.unmount();
  if (shellProbe.model === null) throw new Error('RoomShell model was not captured');
  return shellProbe.model;
}

const roles: readonly RoleId[] = [
  'villager',
  'villager',
  'villager',
  'villager',
  'wolf',
  'wolf',
  'wolf',
  'wolf',
  'seer',
  'witch',
  'hunter',
  'idiot',
];
const roleAssignment = new Map(roles.map((role, seat) => [seat, role]));
const seerState = createBoardNightState(
  '预女猎白',
  (state) => state.nightState?.slice.current?.stepId === 'seerCheck',
  { wolfKill: { actionKey: 'wolfKillAbstain' } },
  roleAssignment,
);

describe('WerewolfRoomScreen shell model assembly (characterization)', () => {
  it('assembles the baseline model during a night action that is not mine', async () => {
    const model = await captureMockModel(createWerewolfRoomMockFromState(seerState, 3));

    expect(model.roomCode).toBe(seerState.roomCode);
    expect(model.connection.status).toEqual({ kind: 'live' });
    expect(model.header.userAction).not.toBeNull();
    expect(model.header.userAction?.ticketCount).toBeNull();
    expect(model.seats.visuallyDisabled).toBe(false);
    expect(model.seats.onBotSeatLongPress).toBeNull();
    expect(model.playerActions.message).toBe('正在等待 预言家 行动');
    expect(model.hostManagement).toBeNull();
    expect(model.controlledSeat).toBeNull();
    expect(model.profile).toBeNull();
    expect(model.seatConfirmation).toBeNull();
  });

  it('surfaces the action message when it is my action', async () => {
    const model = await captureMockModel(createWerewolfRoomMockFromState(seerState, 8));

    expect(model.playerActions.message).toContain('查验');
    expect(model.playerActions.message).toContain('不用技能');
    expect(model.playerActions.actions).toEqual([
      expect.objectContaining({ key: 'viewRole', label: '查看身份' }),
    ]);
    expect(model.playerActions.group).toMatchObject({
      label: '查验',
      isPending: true,
    });
    expect(model.playerActions.group?.actions.map((action) => action.key)).toEqual([
      'seerCheck',
      '$skip',
    ]);
  });

  it.each(['host', 'player', 'spectator'] as const)(
    'projects narration and keeps seats locked for %s',
    async (viewer) => {
      const model = await captureModel(
        seerStepRoom({
          myRole: 'seer',
          mySeat: 0,
          isHost: viewer === 'host',
          isAudioPlaying: true,
          isViewerSeated: viewer !== 'spectator',
        }),
      );

      expect(model.isAudioPlaying).toBe(true);
      expect(model.seats.visuallyDisabled).toBe(true);
      expect(model.playerActions.message).toBeNull();
      expect(model.playerActions.actions).toEqual([]);
    },
  );

  it('includes host management only for the host', async () => {
    const model = await captureMockModel(createWerewolfRoomMockFromState(seerState, 0));

    expect(model.hostManagement).not.toBeNull();
  });

  it('switches the host bottom actions to the info form once the game has ended', async () => {
    const model = await captureModel(
      seerStepRoom({
        isHost: true,
        gameStateOverrides: { status: GameStatus.Ended },
        hookOverrides: { roomStatus: GameStatus.Ended },
      }),
    );

    expect(model.playerActions.actions.map((action) => [action.key, action.label])).toEqual([
      ['viewRole', '查看身份'],
    ]);
    expect(model.hostManagement?.task).toMatchObject({
      kind: 'action',
      actionKey: 'last-night-info',
    });
  });

  it('gives a player no panel flow once the game has ended', async () => {
    const model = await captureModel(
      seerStepRoom({
        gameStateOverrides: { status: GameStatus.Ended },
        hookOverrides: { roomStatus: GameStatus.Ended },
      }),
    );

    expect(model.hostManagement).toBeNull();
    expect(model.playerActions.message).toBeNull();
    expect(model.playerActions.actions).toMatchObject([
      { key: 'viewRole', label: '查看身份' },
      {
        key: 'review',
        label: '本局复盘',
        state: { kind: 'blocked', reason: '房主尚未向你开放复盘' },
      },
    ]);
  });

  it('uses sheriff-election actions on the first day while the election runs', async () => {
    const model = await captureModel(
      seerStepRoom({
        gameStateOverrides: {
          status: GameStatus.Day,
          rules: { isSheriffElectionEnabled: true },
          sheriffElection: {
            phase: 'registration',
            registeredSeats: [],
            withdrawnSeats: [],
            completedRounds: [],
          },
          nightReviewAllowedSeats: [],
        },
        hookOverrides: { roomStatus: GameStatus.Day },
      }),
    );

    expect(model.playerActions.message).toBeNull();
    expect(model.playerActions.actions).toMatchObject([
      {
        key: 'viewRole',
        label: '查看身份',
        state: { kind: 'ready' },
      },
      {
        key: 'sheriff-register',
        label: '报名上警',
        testID: 'sheriff-register-button',
        state: { kind: 'ready' },
      },
      {
        key: 'review',
        label: '本局复盘',
        state: { kind: 'blocked', reason: '房主尚未向你开放复盘' },
      },
    ]);
  });

  it('shows the plague-mode judge message to the host in the ready state', async () => {
    const model = await captureModel(
      seerStepRoom({
        mySeat: 0,
        isHost: true,
        gameStateOverrides: { status: GameStatus.Ready, rules: { isPlagueMode: true } },
        hookOverrides: { roomStatus: GameStatus.Ready },
      }),
    );

    // The judge instruction is the host task; the bottom message stays the participant channel.
    expect(model.hostManagement?.task).toEqual({
      kind: 'message',
      text: '黑死病模式 — 已发牌，请由房主担任真人法官主持后续流程',
    });
    expect(model.playerActions.message).toBeNull();
  });

  it('exposes the room status verbatim as the shell phase anchor', async () => {
    // The phase anchor is the contract e2e phase waits bind to (a night
    // ending = the anchor leaving 'Ongoing'); it must mirror the
    // authoritative room status, never display copy.
    const cases = [GameStatus.Ongoing, GameStatus.Day, GameStatus.Ended] as const;
    for (const status of cases) {
      const model = await captureModel(
        seerStepRoom({
          gameStateOverrides: { status },
          hookOverrides: { roomStatus: status },
        }),
      );

      expect(model.phase).toBe(status);
    }
  });
});
