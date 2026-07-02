/**
 * fibHeaderItems — Fib adapter for the shared room header menu.
 */
import type { RoomHeaderActionItem } from '@/components/room/RoomHeaderActions';
import {
  createRoomHeaderActionItems,
  createRoomHeaderOperationItems,
} from '@/components/room/roomHeaderItems';
import { isMiniProgram } from '@/utils/miniProgram';

interface CreateFibHeaderActionItemsParams {
  onShareRoom: () => void;
}

interface CreateFibHeaderOperationItemsParams {
  canManageSeats: boolean;
  filled: number;
  isFull: boolean;
  onFillBots: () => void;
  onClearSeats: () => void;
}

export function createFibHeaderActionItems({
  onShareRoom,
}: CreateFibHeaderActionItemsParams): RoomHeaderActionItem[] {
  return createRoomHeaderActionItems({
    canShareRoom: !isMiniProgram(),
    onShareRoom,
  });
}

export function createFibHeaderOperationItems({
  canManageSeats,
  filled,
  isFull,
  onFillBots,
  onClearSeats,
}: CreateFibHeaderOperationItemsParams): RoomHeaderActionItem[] {
  return createRoomHeaderOperationItems({
    canFillBots: canManageSeats && !isFull,
    canClearSeats: canManageSeats && filled > 0,
    onFillBots,
    onClearSeats,
    testIdPrefix: 'fib',
  });
}
