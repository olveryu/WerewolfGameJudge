/** React controller for the game-owned Werewolf notepad. */

import type { GameState, RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { ROLE_SPECS, Team } from '@game-judge/game-engine/games/werewolf/public';
import { getDisplaySeatNumber } from '@game-judge/game-engine/platform/room/formatSeat';
import { useEffect, useState } from 'react';

import {
  clearWerewolfNotepad,
  getWerewolfNotepadRoundId,
  readWerewolfNotepad,
  type WerewolfNotepadOwner,
  type WerewolfNotepadReadResult,
  type WerewolfNotepadRoundId,
  writeWerewolfNotepad,
} from '@/games/werewolf/services/notepadRepository';
import {
  createEmptyWerewolfNotepadState,
  type NotepadSheriffCandidateStatuses,
  type RoleTagInfo,
  type WerewolfNotepadState,
} from '@/games/werewolf/state/WerewolfNotepadState';

export interface ActiveWerewolfNotepadRoom {
  readonly userId: string;
  readonly roomId: string;
  readonly gameState: GameState;
}

interface UseNotepadReturn {
  readonly state: WerewolfNotepadState;
  readonly playerCount: number;
  readonly roleTags: readonly RoleTagInfo[];
  readonly sheriffCandidateStatuses: NotepadSheriffCandidateStatuses;
  readonly isSheriffCandidateStatusAuthoritative: boolean;
  readonly setNote: (seat: number, text: string) => void;
  readonly setPublicNoteLeft: (text: string) => void;
  readonly setPublicNoteRight: (text: string) => void;
  readonly toggleHand: (seat: number) => void;
  readonly setRole: (seat: number, roleId: RoleId | null) => void;
  readonly clearAll: () => void;
}

/** One user's notepad for one room instance, round generation, and seat count. */
interface NotepadScope {
  readonly owner: WerewolfNotepadOwner;
  readonly roundId: WerewolfNotepadRoundId;
  readonly seatCount: number;
}

interface EditedNotepad {
  readonly scope: NotepadScope;
  readonly state: WerewolfNotepadState;
}

const MISSING_NOTEPAD: WerewolfNotepadReadResult = { kind: 'missing' };

function resolveScope(room: ActiveWerewolfNotepadRoom | null): NotepadScope | null {
  if (room === null) return null;
  return {
    owner: { userId: room.userId, roomId: room.roomId },
    roundId: getWerewolfNotepadRoundId(room.gameState.roleRevealRandomNonce),
    seatCount: room.gameState.templateRoles.length,
  };
}

function isSameScope(left: NotepadScope, right: NotepadScope): boolean {
  return (
    left.owner.userId === right.owner.userId &&
    left.owner.roomId === right.owner.roomId &&
    left.roundId === right.roundId &&
    left.seatCount === right.seatCount
  );
}

function requireNotepadSeat(seat: number, seatCount: number): void {
  if (!Number.isSafeInteger(seat) || seat < 1 || seat > seatCount) {
    throw new Error(`[FAIL-FAST] Notepad seat ${seat} is outside 1..${seatCount}`);
  }
}

function createAuthoritativeSheriffCandidateStatuses(
  gameState: GameState | null,
): NotepadSheriffCandidateStatuses | null {
  const election = gameState?.sheriffElection;
  if (election === undefined || election.phase === 'registration') return null;

  const withdrawnSeats = new Set(election.withdrawnSeats);
  const statuses: Record<number, NotepadSheriffCandidateStatuses[number]> = {};
  for (const seat of election.registeredSeats) {
    statuses[getDisplaySeatNumber(seat)] = withdrawnSeats.has(seat) ? 'withdrawn' : 'registered';
  }
  return statuses;
}

function createManualSheriffCandidateStatuses(
  state: WerewolfNotepadState,
  seatCount: number,
): NotepadSheriffCandidateStatuses {
  const statuses: Record<number, NotepadSheriffCandidateStatuses[number]> = {};
  for (let seat = 1; seat <= seatCount; seat += 1) {
    if (state.handStates[seat] === true) statuses[seat] = 'registered';
  }
  return statuses;
}

/** Distinct template roles as guess tags: good first, then wolves, then third parties. */
function createRoleTags(gameState: GameState | null): readonly RoleTagInfo[] {
  if (gameState === null) return [];
  const seen = new Set<RoleId>();
  const good: RoleTagInfo[] = [];
  const wolf: RoleTagInfo[] = [];
  const third: RoleTagInfo[] = [];
  for (const roleId of gameState.templateRoles) {
    if (seen.has(roleId)) continue;
    seen.add(roleId);
    const spec = ROLE_SPECS[roleId];
    const info: RoleTagInfo = {
      roleId,
      shortName: spec.shortName,
      team: spec.team,
      faction: spec.faction,
    };
    if (spec.team === Team.Wolf) wolf.push(info);
    else if (spec.team === Team.Third) third.push(info);
    else good.push(info);
  }
  return [...good, ...wolf, ...third];
}

/**
 * Manage notes for one immutable room and one Werewolf round generation. Edits persist in the
 * handler that makes them; a note saved for a previous round is never shown and is cleared.
 */
export function useNotepad(room: ActiveWerewolfNotepadRoom | null): UseNotepadReturn {
  const gameState = room?.gameState ?? null;
  const scope = resolveScope(room);
  const stored =
    scope === null
      ? MISSING_NOTEPAD
      : readWerewolfNotepad(scope.owner, scope.roundId, scope.seatCount);
  const [edited, setEdited] = useState<EditedNotepad | null>(null);
  const state =
    edited !== null && scope !== null && isSameScope(edited.scope, scope)
      ? edited.state
      : stored.kind === 'found'
        ? stored.state
        : createEmptyWerewolfNotepadState();
  const seatCount = scope?.seatCount ?? 0;
  const authoritativeSheriffCandidateStatuses =
    createAuthoritativeSheriffCandidateStatuses(gameState);
  const sheriffCandidateStatuses =
    authoritativeSheriffCandidateStatuses ?? createManualSheriffCandidateStatuses(state, seatCount);

  const staleUserId = stored.kind === 'stale' ? (scope?.owner.userId ?? null) : null;
  const staleRoomId = stored.kind === 'stale' ? (scope?.owner.roomId ?? null) : null;
  useEffect(() => {
    if (staleUserId !== null && staleRoomId !== null) {
      clearWerewolfNotepad({ userId: staleUserId, roomId: staleRoomId });
    }
  }, [staleRoomId, staleUserId]);

  const requireScope = (action: string): NotepadScope => {
    if (scope === null) {
      throw new Error(`[FAIL-FAST] Cannot ${action} a Werewolf notepad without an active room`);
    }
    return scope;
  };

  const updateState = (update: (current: WerewolfNotepadState) => WerewolfNotepadState) => {
    const activeScope = requireScope('edit');
    const next = update(state);
    writeWerewolfNotepad(activeScope.owner, activeScope.roundId, activeScope.seatCount, next);
    setEdited({ scope: activeScope, state: next });
  };

  return {
    state,
    playerCount: seatCount,
    roleTags: createRoleTags(gameState),
    sheriffCandidateStatuses,
    isSheriffCandidateStatusAuthoritative: authoritativeSheriffCandidateStatuses !== null,
    setNote: (seat, text) => {
      requireNotepadSeat(seat, seatCount);
      updateState((current) => ({
        ...current,
        playerNotes: { ...current.playerNotes, [seat]: text },
      }));
    },
    setPublicNoteLeft: (text) => {
      updateState((current) => ({ ...current, publicNoteLeft: text }));
    },
    setPublicNoteRight: (text) => {
      updateState((current) => ({ ...current, publicNoteRight: text }));
    },
    toggleHand: (seat) => {
      requireNotepadSeat(seat, seatCount);
      updateState((current) => ({
        ...current,
        handStates: { ...current.handStates, [seat]: !(current.handStates[seat] ?? false) },
      }));
    },
    setRole: (seat, roleId) => {
      requireNotepadSeat(seat, seatCount);
      updateState((current) => ({
        ...current,
        roleGuesses: {
          ...current.roleGuesses,
          [seat]: (current.roleGuesses[seat] ?? null) === roleId ? null : roleId,
        },
      }));
    },
    clearAll: () => {
      const activeScope = requireScope('clear');
      clearWerewolfNotepad(activeScope.owner);
      setEdited({ scope: activeScope, state: createEmptyWerewolfNotepadState() });
    },
  };
}
