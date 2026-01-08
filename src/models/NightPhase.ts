/**
 * NightPhase - Legacy interface for server-driven night phase state
 * 
 * NOTE: This module is being deprecated in favor of the new Broadcast architecture
 * where GameStateService manages all state locally on the Host device.
 * These types are kept for backward compatibility during migration.
 */

import { RoleName } from './roles';

/**
 * NightPhase represents the current state of night actions.
 * Used in the old server-driven architecture.
 * @deprecated Use GameStateService instead
 */
export interface NightPhase {
  currentRole: string;
  audioStatus: 'playing' | 'finished';
  pendingSeats: number[];
  completedSeats: number[];
}

/**
 * Parse NightPhase from database JSON
 * @deprecated Use GameStateService instead
 */
export const parseNightPhase = (data: any): NightPhase | null => {
  if (!data) return null;
  if (typeof data !== 'object') return null;
  
  return {
    currentRole: data.currentRole ?? '',
    audioStatus: data.audioStatus ?? 'finished',
    pendingSeats: data.pendingSeats ?? [],
    completedSeats: data.completedSeats ?? [],
  };
};

/**
 * Check if a player should see the action dialog
 * @deprecated Use GameStateService.getState().status and currentActionerIndex instead
 */
export const shouldShowActionDialog = (
  nightPhase: NightPhase | null,
  mySeat: number | null,
  _myRole?: RoleName
): boolean => {
  if (!nightPhase || mySeat === null) return false;
  
  return (
    nightPhase.audioStatus === 'finished' &&
    nightPhase.pendingSeats.includes(mySeat) &&
    !nightPhase.completedSeats.includes(mySeat)
  );
};

/**
 * Check if host should play audio
 * @deprecated Use GameStateService instead
 */
export const shouldHostPlayAudio = (
  nightPhase: NightPhase | null,
  lastAudioRole: string | null
): boolean => {
  if (!nightPhase) return false;
  
  return (
    nightPhase.audioStatus === 'playing' &&
    nightPhase.currentRole !== lastAudioRole
  );
};

/**
 * Check if night has ended
 * @deprecated Use GameStateService.getState().status === 'ended' instead
 */
export const isNightEnded = (nightPhase: NightPhase | null): boolean => {
  return nightPhase === null;
};

/**
 * Get the current role from night phase
 * @deprecated Use GameStateService.getCurrentActionRole() instead
 */
export const getCurrentRole = (nightPhase: NightPhase | null): RoleName | null => {
  if (!nightPhase || !nightPhase.currentRole) return null;
  return nightPhase.currentRole as RoleName;
};
