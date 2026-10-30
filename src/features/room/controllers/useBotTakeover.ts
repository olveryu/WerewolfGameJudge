/**
 * useBotTakeover — the one bot-takeover assembly every game room runs.
 *
 * Fixed internal order: local control state (`useRoomBotControl`) →
 * lifecycle guard (`useBotTakeoverGuard`: release when no longer host or
 * the seat is no longer a bot) → effective seat (`resolveEffectiveSeat`)
 * → capability (`createBotTakeoverCapability`) → seat long-press entry
 * (`useBotTakeoverLongPress`). Games supply only the identity (`viewer`),
 * their engine's bot-seat predicate and a name for fail-fast messages;
 * none of the five pieces is wired per game anymore.
 *
 * Bot takeover is not identity: `controlledSeat` only widens the seat the
 * viewer acts as (`effectiveSeat`). `isDelegating` is true while a bot
 * seat is under control, for UI that labels delegated actions.
 */

import { createBotTakeoverCapability, type RoomCapability } from '../model/RoomCapabilities';
import { resolveEffectiveSeat, type RoomViewer } from '../model/RoomViewer';
import { useBotTakeoverGuard } from './useBotTakeoverGuard';
import { useBotTakeoverLongPress } from './useBotTakeoverLongPress';
import { useRoomBotControl } from './useRoomBotControl';

export interface BotTakeoverOptions {
  readonly viewer: RoomViewer;
  /** This game's bot-seat predicate against the current authoritative state. */
  readonly isBotSeat: (seat: number) => boolean;
  /** Game name for fail-fast messages. */
  readonly gameName: string;
}

export interface BotTakeover {
  /** The bot seat under control, null when acting as oneself. */
  readonly controlledSeat: number | null;
  /** The seat the viewer currently acts as: the controlled bot seat or the own seat. */
  readonly effectiveSeat: number | null;
  /** True while a bot seat is under control. */
  readonly isDelegating: boolean;
  readonly takeOver: (seat: number) => void;
  readonly release: () => void;
  /** The takeover permission with the shared denial copy. */
  readonly capability: RoomCapability<readonly [seat: number]>;
  /** Long-press on a bot seat: release if controlled, otherwise take over. */
  readonly onBotSeatLongPress: (seat: number) => void;
}

export function useBotTakeover({ viewer, isBotSeat, gameName }: BotTakeoverOptions): BotTakeover {
  const { controlledSeat, takeOver, release } = useRoomBotControl();
  const canControlBots = viewer.isHost;
  useBotTakeoverGuard({
    controlledSeat,
    canControlBots,
    seatStillBot: controlledSeat === null || isBotSeat(controlledSeat),
    release,
  });
  const effectiveSeat = resolveEffectiveSeat(viewer, controlledSeat);
  const capability = createBotTakeoverCapability(canControlBots, takeOver);
  const onBotSeatLongPress = useBotTakeoverLongPress({
    controlledSeat,
    takeOver,
    release,
    canTakeOver: capability.isAllowed,
    deniedReason:
      capability.isAllowed || capability.reason === null ? undefined : capability.reason,
    isBotSeat,
    gameName,
  });
  return {
    controlledSeat,
    effectiveSeat,
    isDelegating: controlledSeat !== null,
    takeOver,
    release,
    capability,
    onBotSeatLongPress,
  };
}
