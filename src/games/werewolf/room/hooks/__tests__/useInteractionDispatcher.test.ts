/**
 * useInteractionDispatcher — gate toast feedback tests.
 *
 * Pins the two NOOP gates that give the user feedback when a tap is held:
 * - audio_playing: throttled toast carrying the one shared
 *   AUDIO_PLAYBACK_LOCK_REASON constant (no inline copy in the dispatcher)
 * - pending_ack: throttled toast carrying PENDING_ACK_GATE_MESSAGE
 * Every other NOOP reason and every non-gated path stays silent.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react-native';
import { toast } from 'sonner-native';

import { AUDIO_PLAYBACK_LOCK_REASON } from '@/features/room/model/audioPlaybackLock';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import {
  PENDING_ACK_GATE_MESSAGE,
  useInteractionDispatcher,
} from '@/games/werewolf/room/hooks/useInteractionDispatcher';
import type { InteractionEvent } from '@/games/werewolf/room/policy/types';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';

// Toast is mapped via moduleNameMapper → __mocks__/sonner-native.ts

let mockHasPendingAck = false;
jest.mock('@/games/werewolf/hooks/useWerewolfPendingAcks', () => ({
  useWerewolfPendingAcks: () => mockHasPendingAck,
}));

type DispatcherParams = Parameters<typeof useInteractionDispatcher>[0];

function buildParams(overrides: Partial<DispatcherParams> = {}): DispatcherParams {
  const allowedCapability = { isAllowed: true, execute: jest.fn() } as const;
  const capabilities: RoomCapabilities = {
    canTakeSeat: allowedCapability,
    canMoveSeat: allowedCapability,
    canLeaveSeat: allowedCapability,
    canKickSeat: allowedCapability,
    canClearSeats: allowedCapability,
    canFillBots: allowedCapability,
    canConfigureGame: allowedCapability,
    canViewProfiles: allowedCapability,
    canTakeOverBots: allowedCapability,
    canShareRoom: allowedCapability,
    shouldConfirmExit: false,
  };
  return {
    gameState: { players: new Map() } as unknown as LocalGameState,
    roomStatus: GameStatus.Ongoing,
    isAudioPlaying: false,
    isHost: true,
    imActioner: true,
    mySeat: 1,
    myRole: null,
    actorSeatForUi: 1,
    actorRoleForUi: null,
    effectiveSeat: 1,
    controlledSeat: null,
    isDelegating: false,
    handleActionIntent: jest.fn(async () => {}),
    getActionIntent: jest.fn(() => null),
    capabilities,
    requestRoomExit: jest.fn(),
    viewedRole: jest.fn(() => new Promise<never>(() => {})),
    showPrepareToFlipDialog: jest.fn(),
    showStartGameDialog: jest.fn(),
    showAbortDialog: jest.fn(),
    showRedealDialog: jest.fn(),
    showReturnToLobbyDialog: jest.fn(),
    setRoleCardVisible: jest.fn(),
    setShouldPlayRevealAnimation: jest.fn(),
    setIsLoadingRole: jest.fn(),
    ...overrides,
  };
}

describe('useInteractionDispatcher gate toasts', () => {
  let nowMs = 0;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHasPendingAck = false;
    nowMs = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => nowMs);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('pending_ack NOOP shows the gate message once per throttle window', () => {
    mockHasPendingAck = true;
    const params = buildParams();
    const { result } = renderHook(() => useInteractionDispatcher(params));
    const tap: InteractionEvent = { kind: 'SEAT_TAP', seat: 2 };

    act(() => {
      result.current.dispatchInteraction(tap);
    });
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith(PENDING_ACK_GATE_MESSAGE);

    // Repeated taps inside the window stay silent.
    act(() => {
      result.current.dispatchInteraction(tap);
    });
    expect(toast.info).toHaveBeenCalledTimes(1);

    // After the window passes, the next held tap shows the toast again.
    nowMs += 3000;
    act(() => {
      result.current.dispatchInteraction(tap);
    });
    expect(toast.info).toHaveBeenCalledTimes(2);
    expect(toast.info).toHaveBeenLastCalledWith(PENDING_ACK_GATE_MESSAGE);
  });

  it('pending_ack gate message copy is pinned verbatim', () => {
    expect(PENDING_ACK_GATE_MESSAGE).toBe('正在确认上一步，请稍候');
  });

  it('audio_playing NOOP toasts the shared lock reason constant, throttled', () => {
    const params = buildParams({ isAudioPlaying: true });
    const { result } = renderHook(() => useInteractionDispatcher(params));
    const tap: InteractionEvent = { kind: 'SEAT_TAP', seat: 2 };

    act(() => {
      result.current.dispatchInteraction(tap);
    });
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith(AUDIO_PLAYBACK_LOCK_REASON);

    act(() => {
      result.current.dispatchInteraction(tap);
    });
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('other NOOP reasons stay silent (host_only)', () => {
    const params = buildParams({ isHost: false });
    const { result } = renderHook(() => useInteractionDispatcher(params));

    act(() => {
      result.current.dispatchInteraction({ kind: 'HOST_CONTROL', action: 'startGame' });
    });
    expect(toast.info).not.toHaveBeenCalled();
    expect(params.showStartGameDialog).not.toHaveBeenCalled();
  });

  it('LEAVE_ROOM is exempt from the pending-ack gate and stays silent', () => {
    mockHasPendingAck = true;
    const params = buildParams();
    const { result } = renderHook(() => useInteractionDispatcher(params));

    act(() => {
      result.current.dispatchInteraction({ kind: 'LEAVE_ROOM' });
    });
    expect(params.requestRoomExit).toHaveBeenCalledTimes(1);
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('dispatcher source carries no inline copy of the audio lock reason', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/games/werewolf/room/hooks/useInteractionDispatcher.ts'),
      'utf-8',
    );
    expect(source).not.toContain('语音播报中，请稍候');
    expect(source).toContain('AUDIO_PLAYBACK_LOCK_REASON');
  });
});
