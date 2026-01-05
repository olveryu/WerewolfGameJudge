import { Player, createPlayer } from '../models/Player';
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

    // Get the role for this seat
    const role = room.template.roles[seatIndex];
    if (!role) {
      console.log('[SeatService] No role for seat:', seatIndex);
      return -1;
    }

    // Create new player
    const playerId = userId || 'anonymous';
    const newPlayer = createPlayer(playerId, seatIndex, role);
    newPlayer.displayName = await this.authService.getCurrentDisplayName();
    newPlayer.avatarUrl = await this.authService.getCurrentAvatarUrl();
    console.log('[SeatService] takeSeat - newPlayer:', {
      uid: newPlayer.uid,
      displayName: newPlayer.displayName,
      avatarUrl: newPlayer.avatarUrl,
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

    // Update room
    const updatedRoom = { ...room, players: newPlayers };
    await this.roomService.updateRoom(roomNumber, updatedRoom);
    
    console.log('[SeatService] Room updated successfully');
    return 0;
  }

  async leaveSeat(roomNumber: string, seatIndex: number): Promise<void> {
    const room = await this.roomService.getRoom(roomNumber);
    if (!room) return;

    const newPlayers = new Map(room.players);
    newPlayers.set(seatIndex, null);

    const updatedRoom = { ...room, players: newPlayers };
    await this.roomService.updateRoom(roomNumber, updatedRoom);
  }

  // Fill ALL seats with bots (for testing mode)
  async fillWithBots(roomNumber: string): Promise<number> {
    const room = await this.roomService.getRoom(roomNumber);
    if (!room) return 0;

    const newPlayers = new Map<number, Player>();
    let filledCount = 0;

    room.template.roles.forEach((role, index) => {
      const botId = `bot_${index}_${Math.random().toString(36).substring(2, 8)}`;
      const botPlayer = createPlayer(botId, index, role);
      botPlayer.displayName = this.authService.generateDisplayName(botId);
      newPlayers.set(index, botPlayer);
      filledCount++;
    });

    const updatedRoom = { ...room, players: newPlayers };
    await this.roomService.updateRoom(roomNumber, updatedRoom);
    
    console.log(`[SeatService] Test mode: filled all ${filledCount} seats with bots`);
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
