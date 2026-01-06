import { Player, createPlayer } from '../models/Player';
import { RoomStatus } from '../models/Room';
import { AuthService } from './AuthService';
import { RoomService } from './RoomService';

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

  async takeSeat(
    roomNumber: string,
    seatIndex: number,
    currentSeat: number | null
  ): Promise<number> {
    await this.authService.waitForInit();
    const userId = this.authService.getCurrentUserId();
    console.log('[SeatService] takeSeat called:', { roomNumber, seatIndex, currentSeat, userId });
    
    const room = await this.roomService.getRoom(roomNumber);
    if (!room) {
      console.log('[SeatService] Room not found');
      return -1;
    }

    // Check if seat is taken by someone else
    const existingPlayer = room.players.get(seatIndex);
    if (existingPlayer && existingPlayer.uid !== userId) {
      console.log('[SeatService] Seat taken by someone else:', existingPlayer.uid);
      return -1;
    }

    // Check seat index is valid
    if (seatIndex < 0 || seatIndex >= room.template.numberOfPlayers) {
      console.log('[SeatService] Invalid seat index:', seatIndex);
      return -1;
    }

    // Create new player WITHOUT role (role is assigned later during "准备看牌")
    const playerId = userId || 'anonymous';
    const newPlayer = createPlayer(playerId, seatIndex, null);
    newPlayer.displayName = await this.authService.getCurrentDisplayName();
    newPlayer.avatarUrl = await this.authService.getCurrentAvatarUrl();
    console.log('[SeatService] takeSeat - newPlayer:', {
      uid: newPlayer.uid,
      displayName: newPlayer.displayName,
      avatarUrl: newPlayer.avatarUrl,
      role: newPlayer.role,  // Should be null
    });

    // Update players map
    const newPlayers = new Map(room.players);
    if (currentSeat !== null && currentSeat !== seatIndex) {
      console.log('[SeatService] Leaving current seat:', currentSeat);
      newPlayers.set(currentSeat, null);
    }
    newPlayers.set(seatIndex, newPlayer);
    
    console.log('[SeatService] New players map:');
    newPlayers.forEach((p, seat) => {
      console.log(`  Seat ${seat}:`, p ? p.uid : 'null');
    });

    // Check if all seats are filled
    let allSeated = true;
    newPlayers.forEach((p) => {
      if (!p) allSeated = false;
    });

    // Update room - change to seated if all seats are filled
    const updatedRoom = { 
      ...room, 
      players: newPlayers,
      roomStatus: allSeated ? RoomStatus.seated : room.roomStatus,
    };
    await this.roomService.updateRoom(roomNumber, updatedRoom);
    
    console.log('[SeatService] Room updated successfully, allSeated:', allSeated);
    return 0;
  }

  async leaveSeat(roomNumber: string, seatIndex: number): Promise<void> {
    const room = await this.roomService.getRoom(roomNumber);
    if (!room) return;

    const newPlayers = new Map(room.players);
    newPlayers.set(seatIndex, null);

    // If someone leaves, go back to unseated
    const updatedRoom = { 
      ...room, 
      players: newPlayers,
      roomStatus: RoomStatus.unseated,
    };
    await this.roomService.updateRoom(roomNumber, updatedRoom);
  }

  // Fill remaining seats with bots (for testing mode)
  // Host takes seat 0, bots fill the rest
  // Note: This fills seats without assigning roles - use assignRoles separately
  async fillWithBots(roomNumber: string): Promise<number> {
    await this.authService.waitForInit();
    const userId = this.authService.getCurrentUserId();
    
    const room = await this.roomService.getRoom(roomNumber);
    if (!room) return 0;

    const newPlayers = new Map<number, Player>();
    let filledCount = 0;

    for (let index = 0; index < room.template.numberOfPlayers; index++) {
      if (index === 0) {
        // Host takes seat 0
        const hostPlayer = createPlayer(userId || 'host', 0, null);
        hostPlayer.displayName = await this.authService.getCurrentDisplayName();
        hostPlayer.avatarUrl = await this.authService.getCurrentAvatarUrl();
        newPlayers.set(0, hostPlayer);
      } else {
        // Bots fill the rest
        const botId = `bot_${index}_${Math.random().toString(36).substring(2, 8)}`;
        const botPlayer = createPlayer(botId, index, null);
        botPlayer.displayName = this.authService.generateDisplayName(botId);
        newPlayers.set(index, botPlayer);
      }
      filledCount++;
    }

    // All seats filled, set status to seated
    const updatedRoom = { 
      ...room, 
      players: newPlayers,
      roomStatus: RoomStatus.seated,
    };
    await this.roomService.updateRoom(roomNumber, updatedRoom);
    
    console.log(`[SeatService] Test mode: host at seat 0, filled ${filledCount - 1} seats with bots, status -> seated`);
    return filledCount;
  }

  // Update a single player seat
  async updatePlayerSeat(
    roomNumber: string,
    seatIndex: number,
    player: Player | null
  ): Promise<void> {
    const room = await this.roomService.getRoom(roomNumber);
    if (!room) return;

    const newPlayers = new Map(room.players);
    newPlayers.set(seatIndex, player);

    const updatedRoom = { ...room, players: newPlayers };
    await this.roomService.updateRoom(roomNumber, updatedRoom);
  }
}

export default SeatService;
