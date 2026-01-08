/**
 * NightService - Legacy service for server-driven night phase operations
 * 
 * NOTE: This module is being deprecated in favor of the new Broadcast architecture
 * where GameStateService manages all state locally on the Host device.
 * This stub is kept for backward compatibility during migration.
 * 
 * @deprecated Use GameStateService instead
 */

/**
 * Legacy NightService class
 * @deprecated Use GameStateService instead
 */
export class NightService {
  private static instance: NightService;

  private constructor() {}

  static getInstance(): NightService {
    if (!NightService.instance) {
      NightService.instance = new NightService();
    }
    return NightService.instance;
  }

  /**
   * Mark audio as finished for the current role
   * @deprecated This is a no-op stub. Use GameStateService for new architecture.
   */
  async markAudioFinished(_roomNumber: string): Promise<void> {
    console.warn('[NightService] markAudioFinished is deprecated. Use GameStateService instead.');
    // No-op in new architecture - Host manages audio state locally
  }
}

export const nightService = NightService.getInstance();
export default NightService;
