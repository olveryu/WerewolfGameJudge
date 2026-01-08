import { useEffect, useState } from 'react';
import { NightPhase } from '../models/NightPhase';
import { nightService } from '../services/NightService';
import AudioService from '../services/AudioService';
import { RoleName } from '../models/roles';

/**
 * Hook to manage Host-side audio playback during Night Phase.
 * 
 * Logic:
 * 1. Listen for changes in NightPhase.
 * 2. If audioStatus === 'playing' AND role has changed:
 * 3. Play audio.
 * 4. Call `markAudioFinished` RPC.
 */
export function useHostAudio(
  nightPhase: NightPhase | null,
  isHost: boolean,
  roomNumber: string
) {
  const [lastProcessedRole, setLastProcessedRole] = useState<string | null>(null);
  
  useEffect(() => {
    // Basic guards
    if (!isHost || !nightPhase || !roomNumber) return;

    // Only proceed if server says "playing"
    if (nightPhase.audioStatus !== 'playing') return;

    // Avoid re-playing for the same role if we've already handled it locally *in this session*
    // However, if the server says 'playing', it means we SHOULD play.
    // We use `lastProcessedRole` to prevent the effect from firing continuously 
    // while the async audio is playing or RPC is in flight.
    if (nightPhase.currentRole === lastProcessedRole) return;

    const playSequence = async () => {
      try {
        setLastProcessedRole(nightPhase.currentRole);
        
        console.log(`[useHostAudio] Playing audio for ${nightPhase.currentRole}`);
        // Cast to RoleName to ensure type safety if needed, though nightPhase.currentRole should be string
        await AudioService.getInstance().playRoleBeginningAudio(nightPhase.currentRole as RoleName);
        
        console.log(`[useHostAudio] Audio finished, marking server state...`);
        await nightService.markAudioFinished(roomNumber);
      } catch (err) {
        console.error('[useHostAudio] Error in audio sequence:', err);
        // Recovery strategy? Maybe retry or alert user.
      }
    };

    playSequence();
  }, [
    isHost,
    roomNumber,
    nightPhase?.audioStatus,
    nightPhase?.currentRole,
    lastProcessedRole
  ]);
}
