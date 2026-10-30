/**
 * useLastActionToast — passive toasts for host actions, shown to the
 * players they happened to.
 *
 * The link snapshot marks the command that produced each revision
 * (`lastCommand`); this hook turns that marker into one toast per
 * revision for non-host viewers. The shared seat commands have shared
 * copy and a shared condition (the viewer lost their seat); game
 * commands come from the game's injected table, keyed by command type.
 * Nothing is shown to the host (they issued the command) or while the
 * screen is not focused (the marker is consumed on return, not replayed).
 */

import type { RoomSeatCommand } from '@game-judge/game-engine/platform/protocol/commands';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner-native';

type RoomSeatCommandType = RoomSeatCommand<unknown>['type'];
const ROOM_SEAT_KICK_COMMAND: RoomSeatCommandType = 'room.seat.kick';
const ROOM_SEAT_CLEAR_COMMAND: RoomSeatCommandType = 'room.seat.clear';

export interface LastActionToastMessage {
  readonly level: 'info' | 'warning';
  readonly text: string;
}

export interface LastActionToastOptions {
  readonly lastCommand: { readonly revision: number; readonly type: string } | null;
  readonly isHost: boolean;
  /** The viewer's own seat; seat loss is the condition for the seat-command toasts. */
  readonly mySeat: number | null;
  readonly isFocused: boolean;
  /** Game command type → toast; omitted types show nothing. */
  readonly messages: Readonly<Record<string, LastActionToastMessage>>;
}

function show(message: LastActionToastMessage): void {
  if (message.level === 'warning') toast.warning(message.text);
  else toast.info(message.text);
}

export function useLastActionToast({
  lastCommand,
  isHost,
  mySeat,
  isFocused,
  messages,
}: LastActionToastOptions): void {
  const prevSeatRef = useRef(mySeat);
  const handledRevisionRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isFocused) return;
    const prevSeat = prevSeatRef.current;
    prevSeatRef.current = mySeat;

    if (lastCommand === null || handledRevisionRef.current === lastCommand.revision) return;
    handledRevisionRef.current = lastCommand.revision;
    if (isHost) return;

    const lostSeat = prevSeat !== null && mySeat === null;
    if (lastCommand.type === ROOM_SEAT_KICK_COMMAND) {
      if (lostSeat) toast.warning(`你已被移出 ${prevSeat + 1} 号座位`);
      return;
    }
    if (lastCommand.type === ROOM_SEAT_CLEAR_COMMAND) {
      if (lostSeat) toast.warning('房主已清空所有座位');
      return;
    }
    const message = messages[lastCommand.type];
    if (message !== undefined) show(message);
  }, [isFocused, isHost, lastCommand, messages, mySeat]);
}
