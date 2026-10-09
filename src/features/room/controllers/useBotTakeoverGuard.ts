/**
 * useBotTakeoverGuard - Shared bot takeover lifecycle guard.
 *
 * Centralizes the "permission revoked" auto-release that was previously
 * hand-written in each game.
 *
 * Werewolf is EXEMPT: it uses the interaction policy dispatcher, not the
 * boolean canControlBots model. Do not apply this hook to werewolf.
 */

import { useEffect } from 'react';

export interface BotTakeoverGuardOptions {
  /** Currently controlled seat, null if none. */
  readonly controlledSeat: number | null;
  /** Whether the current user can control bots. */
  readonly canControlBots: boolean;
  /** Release function. */
  readonly release: () => void;
}

/**
 * Auto-releases the controlled seat when permission is revoked.
 * Must be called unconditionally at the top level of the room state hook.
 */
export function useBotTakeoverGuard({
  controlledSeat,
  canControlBots,
  release,
}: BotTakeoverGuardOptions): void {
  useEffect(() => {
    if (controlledSeat !== null && !canControlBots) {
      // Permission revoked while controlling: fail-safe release.
      // Without this, the host could continue acting as the bot.
      release();
    }
  }, [controlledSeat, canControlBots, release]);
}
