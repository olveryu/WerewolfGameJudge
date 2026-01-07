import { Player } from '../models/Player';
import { AuthService } from './AuthService';
import { RoomService } from './RoomService';

/**
 * V2 SeatService: Uses RPC-based atomic updates for seat operations
 */
export class SeatService {
  private static instance: SeatService;
  private readonly authService: AuthService;
  private readonly roomService: RoomService;

  private constructor() {
    this.authService = AuthService.getInstance();
    this.roomService = RoomService.getInstance();
  }

  static getInstance(): SeatService {
    if (!SeatService.instance) {
      SeatService.instance = new SeatService();
    }
    return SeatService.instance;
  }

  /**
   * V2: Take a seat using atomic RPC update
   */
  async takeSeat(
    roomNumber: string,
    seatIndex: number,
    currentSeat: number | null
  ): Promise<number> {
    await this.authService.waitForInit();
    const userId = this.authService.getCurrentUserId();
    const displayName = await this.authService.getCurrentDisplayName();
    const avatarUrl = await this.authService.getCurrentAvatarUrl();
    
    console.log('[SeatService] takeSeat called:', { roomNumber, seatIndex, currentSeat, userId });
    
    // If switching seats, leave current seat first
    if (currentSeat !== null && currentSeat !== seatIndex) {
      console.log('[SeatService] Leaving current seat:', currentSeat);
      await this.roomService.leaveSeat(roomNumber, currentSeat, userId || 'anonymous');
    }
    
    // Take the new seat using V2 RPC
    const result = await this.roomService.takeSeat(
      roomNumber,
      seatIndex,
      userId || 'anonymous',
      displayName ?? undefined,
      avatarUrl ?? undefined
    );
    
    if (!result.success) {
      console.log('[SeatService] takeSeat failed:', result.error);
      return -1;
    }
    
    console.log('[SeatService] takeSeat success, allSeated:', result.allSeated);
    return 0;
  }

  /**
   * V2: Leave a seat using atomic RPC update
   */
  async leaveSeat(roomNumber: string, seatIndex: number): Promise<void> {
    const userId = this.authService.getCurrentUserId();
    console.log('[SeatService] leaveSeat called:', { roomNumber, seatIndex, userId });
    
    const result = await this.roomService.leaveSeat(roomNumber, seatIndex, userId || 'anonymous');
    
    if (result.success) {
      console.log('[SeatService] leaveSeat success');
    } else {
      console.log('[SeatService] leaveSeat failed:', result.error);
    }
  }

  /**
   * V2: Fill remaining seats with bots using batch update RPC
   * Host takes seat 0, bots fill the rest
   */
  async fillWithBots(roomNumber: string): Promise<number> {
    await this.authService.waitForInit();
    const userId = this.authService.getCurrentUserId();
    
    const room = await this.roomService.getRoom(roomNumber);
    if (!room) return 0;

    // Build player updates for batch operation
    const playerUpdates: Record<string, {
      uid: string;
      displayName?: string;
      avatarUrl?: string;
      role?: string | null;
    }> = {};
    
    let filledCount = 0;
    const hostDisplayName = await this.authService.getCurrentDisplayName();
    const hostAvatarUrl = await this.authService.getCurrentAvatarUrl();

    for (let index = 0; index < room.template.numberOfPlayers; index++) {
      if (index === 0) {
        // Host takes seat 0
        playerUpdates[index.toString()] = {
          uid: userId || 'host',
          displayName: hostDisplayName ?? undefined,
          avatarUrl: hostAvatarUrl ?? undefined,
        };
      } else {
        // Bots fill the rest
        const botId = `bot_${index}_${Math.random().toString(36).substring(2, 8)}`;
        playerUpdates[index.toString()] = {
          uid: botId,
          displayName: this.authService.generateDisplayName(botId),
        };
      }
      filledCount++;
    }

    // Use batch_update_players RPC
    const result = await this.roomService.batchUpdatePlayers(
      roomNumber,
      playerUpdates,
      userId || 'host'
    );
    
    if (!result.success) {
      console.error('[SeatService] fillWithBots failed:', result.error);
      return 0;
    }
    
    console.log(`[SeatService] Test mode: host at seat 0, filled ${filledCount - 1} seats with bots`);
    return filledCount;
  }

  /**
   * V2: Update a single player seat using atomic field update
   */
  async updatePlayerSeat(
    roomNumber: string,
    seatIndex: number,
    player: Player | null
  ): Promise<void> {
    if (player === null) {
      // Remove player from seat
      const userId = this.authService.getCurrentUserId();
      const result = await this.roomService.leaveSeat(roomNumber, seatIndex, userId || 'anonymous');
      if (!result.success) {
        console.error('[SeatService] updatePlayerSeat (remove) failed:', result.error);
      }
    } else {
      // Set player at seat - use takeSeat
      const result = await this.roomService.takeSeat(
        roomNumber,
        seatIndex,
        player.uid,
        player.displayName ?? undefined,
        player.avatarUrl ?? undefined
      );
      if (!result.success) {
        console.error('[SeatService] updatePlayerSeat (set) failed:', result.error);
      }
    }
  }
}

export default SeatService;
