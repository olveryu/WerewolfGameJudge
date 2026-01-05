// Backend service - now directly uses Supabase
import { Room } from '../models/Room';
import { Player } from '../models/Player';
import { SupabaseService } from './SupabaseService';

/**
 * BackendService - Unified interface for room and auth operations
 * Now directly uses Supabase as the backend.
 */
export class BackendService {
  private static instance: BackendService;
  private supabaseService: SupabaseService;

  private constructor() {
    this.supabaseService = SupabaseService.getInstance();
    console.log('BackendService initialized with Supabase');
  }

  static getInstance(): BackendService {
    if (!BackendService.instance) {
      BackendService.instance = new BackendService();
    }
    return BackendService.instance;
  }

  // Auth methods
  getCurrentUserId(): string | null {
    return this.supabaseService.getCurrentUserId();
  }

  getCurrentUser() {
    return this.supabaseService.getCurrentUser();
  }

  async signInAnonymously(): Promise<string> {
    return this.supabaseService.signInAnonymously();
  }

  async signUpWithEmail(email: string, password: string, displayName?: string): Promise<{ userId: string; user: any }> {
    return this.supabaseService.signUpWithEmail(email, password, displayName);
  }

  async signInWithEmail(email: string, password: string): Promise<string> {
    return this.supabaseService.signInWithEmail(email, password);
  }

  async updateProfile(updates: { displayName?: string; avatarUrl?: string }): Promise<void> {
    return this.supabaseService.updateProfile(updates);
  }

  async uploadAvatar(fileUri: string): Promise<string> {
    return this.supabaseService.uploadAvatar(fileUri);
  }

  async signOut(): Promise<void> {
    return this.supabaseService.signOut();
  }

  // Room methods
  async createRoom(roomNumber: string, room: Room): Promise<void> {
    return this.supabaseService.createRoom(roomNumber, room);
  }

  async getRoom(roomNumber: string): Promise<Room | null> {
    return this.supabaseService.getRoom(roomNumber);
  }

  async updateRoom(roomNumber: string, room: Room): Promise<void> {
    return this.supabaseService.updateRoom(roomNumber, room);
  }

  async deleteRoom(roomNumber: string): Promise<void> {
    return this.supabaseService.deleteRoom(roomNumber);
  }

  subscribeToRoom(
    roomNumber: string,
    callback: (room: Room | null) => void
  ): () => void {
    return this.supabaseService.subscribeToRoom(roomNumber, callback);
  }

  // Seat management
  async takeSeat(
    roomNumber: string,
    seatIndex: number,
    currentSeat: number | null
  ): Promise<number> {
    return this.supabaseService.takeSeat(roomNumber, seatIndex, currentSeat);
  }

  async leaveSeat(roomNumber: string, seatIndex: number): Promise<void> {
    return this.supabaseService.leaveSeat(roomNumber, seatIndex);
  }

  // Utility methods
  async roomExists(roomNumber: string): Promise<boolean> {
    return this.supabaseService.roomExists(roomNumber);
  }

  async generateRoomNumber(): Promise<string> {
    return this.supabaseService.generateRoomNumber();
  }

  // Fill empty seats with bot players
  async fillWithBots(roomNumber: string): Promise<number> {
    return this.supabaseService.fillWithBots(roomNumber);
  }

  // Update a single player seat
  async updatePlayerSeat(
    roomNumber: string,
    seatIndex: number,
    player: Player | null
  ): Promise<void> {
    return this.supabaseService.updatePlayerSeat(roomNumber, seatIndex, player);
  }

  // Save/load last room
  async saveLastRoom(roomNumber: string): Promise<void> {
    return this.supabaseService.saveLastRoom(roomNumber);
  }

  async getLastRoom(): Promise<string | null> {
    return this.supabaseService.getLastRoom();
  }

  // Wait for service initialization
  async waitForInit(): Promise<void> {
    await this.supabaseService.waitForInit();
  }
}

export default BackendService;
