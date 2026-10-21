/**
 * The one client audio-playback lock for room surfaces.
 *
 * Narration audio is a chassis mechanism: while it plays, every
 * state-changing flow control must render disabled and its press must
 * be unreachable — in every phase, night steps and the day / ended
 * announcement window alike. Read-only actions stay available; which
 * actions are read-only is each game's own content, so each game
 * declares its exemption list where it assembles its model.
 *
 * The predicate is the single source every consumer reads (interaction
 * policy gates, seat greying, bottom-layout collapse, and the
 * host-management combinator below), so the lock cannot drift per
 * surface the way per-surface copies of the expression did.
 */

import type { RoomHostManagementAction, RoomHostManagementModel } from './RoomHostManagement';

/** The one disabled reason shown on actions held by the audio playback lock. */
export const AUDIO_PLAYBACK_LOCK_REASON = '语音播报中，请稍候';

/** Whether the audio playback lock is engaged, given the room's playback flag. */
export function isAudioPlaybackLocked(isAudioPlaying: boolean): boolean {
  return isAudioPlaying;
}

export interface AudioPlaybackLockInput {
  readonly isAudioPlaying: boolean;
  /** Keys of read-only actions that stay enabled while the lock is engaged. */
  readonly exemptActionKeys: ReadonlySet<string>;
}

function lockAction(
  action: RoomHostManagementAction,
  exemptActionKeys: ReadonlySet<string>,
): RoomHostManagementAction {
  if (!action.isEnabled || exemptActionKeys.has(action.key)) return action;
  const { onPress: _onPress, ...rest } = action;
  return { ...rest, isEnabled: false, disabledReason: AUDIO_PLAYBACK_LOCK_REASON };
}

/**
 * Apply the audio playback lock to an assembled host-management model.
 *
 * While audio plays, every non-exempt action is flipped to disabled
 * with the one lock reason; the press handler drops with the enabled
 * branch, so the press is unreachable, not just greyed — on both
 * render surfaces of the model (collapsed console and expanded panel).
 * Already-disabled actions keep their own reason, exempt actions pass
 * through untouched, and when audio is idle the model is returned
 * as-is. Games call this once at their host-management factory exit.
 */
export function applyAudioPlaybackLock(
  model: RoomHostManagementModel | null,
  input: AudioPlaybackLockInput,
): RoomHostManagementModel | null {
  if (model === null || !isAudioPlaybackLocked(input.isAudioPlaying)) return model;
  return {
    ...model,
    sections: model.sections.map((section) => ({
      ...section,
      actions: section.actions.map((action) => lockAction(action, input.exemptActionKeys)),
    })),
  };
}
