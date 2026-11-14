/**
 * Characterization tests for the WerewolfRoomScreen shell-model assembly.
 *
 * Pins the RoomShellModel the screen assembles from the room state
 * (bottom-action branching, seat gating, host-management presence, header
 * wiring) so a refactor of the assembly cannot silently change behavior.
 * The RoomShell itself is replaced by a probe that captures the model.
 */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import {
  createWerewolfRoomMock,
  mountWerewolfRoom,
  type WerewolfRoomMockOptions,
} from '@/games/werewolf/room/__tests__/harness';
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
  shellProbe.model = null;
  const view = await mountWerewolfRoom(createWerewolfRoomMock(options));
  expect(view.getByTestId(TESTIDS.roomScreenRoot)).toBeInTheDocument();
  view.unmount();
  if (shellProbe.model === null) throw new Error('RoomShell model was not captured');
  return shellProbe.model;
}

describe('WerewolfRoomScreen shell model assembly (characterization)', () => {
  it('assembles the baseline model during a night action that is not mine', async () => {
    const model = await captureModel(seerStepRoom({}));

    expect(model.roomCode).toBe('1234');
    expect(model.connection.status).toEqual({ kind: 'live' });
    expect(model.header.userAction).not.toBeNull();
    expect(model.header.userAction?.ticketCount).toBeNull();
    expect(model.seats.visuallyDisabled).toBe(false);
    expect(model.seats.onBotSeatLongPress).toBeNull();
    expect(model.bottomActions.kind).toBe('stacked');
    if (model.bottomActions.kind === 'stacked') {
      // A non-actor reads the step's waiting line.
      expect(model.bottomActions.message).toBe('正在等待 预言家 行动');
    }
    expect(model.hostManagement).toBeNull();
    expect(model.controlledSeat).toBeNull();
    expect(model.profile).toBeNull();
    expect(model.seatConfirmation).toBeNull();
  });

  it('surfaces the action message on the stacked dock when it is my action', async () => {
    const model = await captureModel(seerStepRoom({ myRole: 'seer', mySeat: 0 }));

    expect(model.bottomActions.kind).toBe('stacked');
    if (model.bottomActions.kind === 'stacked') {
      expect(model.bottomActions.message).toBe('请选择要查验的玩家，如不使用请点击「不用技能」');
      expect(model.bottomActions.layout.primary).toEqual([]);
      expect(model.bottomActions.layout.secondary.map((a) => [a.key, a.label, a.variant])).toEqual([
        ['skip', '不用技能', 'secondary'],
        ['viewRole', '查看身份', 'secondary'],
      ]);
      expect(model.bottomActions.layout.ghost.map((a) => [a.key, a.label, a.variant])).toEqual([]);
    }
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
      expect(model.bottomActions.kind).toBe('stacked');
      if (model.bottomActions.kind === 'stacked') {
        expect(model.bottomActions.message).toBeNull();
        expect(model.bottomActions.layout).toEqual({ primary: [], secondary: [], ghost: [] });
      }
    },
  );

  it('includes host management only for the host', async () => {
    const model = await captureModel(seerStepRoom({ mySeat: 0, isHost: true }));

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

    expect(model.bottomActions.kind).toBe('stacked');
    if (model.bottomActions.kind === 'stacked') {
      // The host's Ended bottom is their own participant surface (view
      // identity as a secondary tool); the dawn flow is the host task.
      expect(model.bottomActions.layout.primary).toEqual([]);
      expect(model.bottomActions.layout.secondary.map((a) => [a.key, a.label, a.variant])).toEqual([
        ['viewRole', '查看身份', 'secondary'],
      ]);
      expect(model.bottomActions.layout.ghost.map((a) => [a.key, a.label, a.variant])).toEqual([]);
    }
    expect(model.hostManagement?.task).toMatchObject({
      kind: 'action',
      actionKey: 'last-night-info',
      steps: [
        { key: 'lastNightInfo', state: 'current' },
        { key: 'grantReview', state: 'upcoming' },
        { key: 'closing', state: 'upcoming' },
      ],
    });
  });

  it('gives a player no panel flow once the game has ended', async () => {
    const model = await captureModel(
      seerStepRoom({
        gameStateOverrides: { status: GameStatus.Ended },
        hookOverrides: { roomStatus: GameStatus.Ended },
      }),
    );

    expect(model.bottomActions.kind).toBe('stacked');
    if (model.bottomActions.kind === 'stacked') {
      // The flow is the host's alone: a player gets no host management
      // and no host buttons at Ended — only their own secondary tool and
      // the disabled review entry until the host grants access; no guide
      // line (the night step is cleared when the night ends).
      expect(model.hostManagement).toBeNull();
      expect(model.bottomActions.message).toBeNull();
      expect(model.bottomActions.layout.primary).toEqual([]);
      expect(model.bottomActions.layout.secondary.map((a) => [a.key, a.label, a.variant])).toEqual([
        ['viewRole', '查看身份', 'secondary'],
      ]);
      expect(model.bottomActions.layout.ghost).toMatchObject([
        {
          key: 'review',
          label: '本局复盘',
          variant: 'ghost',
          isEnabled: false,
          disabledReason: '房主尚未向你开放复盘',
        },
      ]);
    }
  });

  it('uses the sheriff-election dock model on the first day while the election runs', async () => {
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

    expect(model.bottomActions.kind).toBe('dock');
    if (model.bottomActions.kind === 'dock') {
      expect(model.bottomActions.message).toBeNull();
      expect(model.bottomActions.leading).toMatchObject({
        key: 'viewRole',
        label: '查看身份',
        tone: 'default',
        isEnabled: true,
      });
      expect(model.bottomActions.primary).toMatchObject({
        key: 'sheriff-register',
        label: '报名上警',
        variant: 'primary',
        size: 'md',
        testID: 'sheriff-register-button',
        isEnabled: true,
      });
      // No seat is granted yet: the review tool is visible but disabled, with the reason.
      expect(model.bottomActions.trailing).toMatchObject({
        key: 'review',
        label: '本局复盘',
        isEnabled: false,
        disabledReason: '房主尚未向你开放复盘',
      });
    }
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
    expect(model.bottomActions.kind).toBe('stacked');
    if (model.bottomActions.kind === 'stacked') {
      expect(model.bottomActions.message).toBeNull();
    }
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
