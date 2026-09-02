/** React controller for the game-owned Werewolf notepad. */

import type { GameState, RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { ROLE_SPECS, Team } from '@game-judge/game-engine/games/werewolf/public';
import { getDisplaySeatNumber } from '@game-judge/game-engine/platform/room/formatSeat';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  clearWerewolfNotepad,
  getWerewolfNotepadRoundId,
  readWerewolfNotepad,
  type WerewolfNotepadOwner,
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

type PersistenceIntent = 'none' | 'write' | 'clear';

interface ScopedNotepadState {
  readonly roomId: string | null;
  readonly userId: string | null;
  readonly roundId: WerewolfNotepadRoundId | null;
  readonly seatCount: number;
  readonly state: WerewolfNotepadState;
  readonly persistence: PersistenceIntent;
}

function isCurrentScope(
  scoped: ScopedNotepadState,
  userId: string | null,
  roomId: string | null,
  roundId: WerewolfNotepadRoundId | null,
  seatCount: number,
): boolean {
  return (
    scoped.userId === userId &&
    scoped.roomId === roomId &&
    scoped.roundId === roundId &&
    scoped.seatCount === seatCount
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

/** Manage notes for one immutable room and one Werewolf round generation. */
export function useNotepad(room: ActiveWerewolfNotepadRoom | null): UseNotepadReturn {
  const userId = room?.userId ?? null;
  const roomId = room?.roomId ?? null;
  const gameState = room?.gameState ?? null;
  const roundId =
    gameState === null ? null : getWerewolfNotepadRoundId(gameState.roleRevealRandomNonce);
  const seatCount = gameState?.templateRoles.length ?? 0;
  const owner = useMemo<WerewolfNotepadOwner | null>(
    () => (userId === null || roomId === null ? null : { userId, roomId }),
    [roomId, userId],
  );

  const stored = useMemo(() => {
    if (owner === null || roundId === null) return { kind: 'missing' as const };
    return readWerewolfNotepad(owner, roundId, seatCount);
  }, [owner, roundId, seatCount]);
  const loadedState = useMemo(
    () => (stored.kind === 'found' ? stored.state : createEmptyWerewolfNotepadState()),
    [stored],
  );

  const [scopedState, setScopedState] = useState<ScopedNotepadState>(() => ({
    userId,
    roomId,
    roundId,
    seatCount,
    state: loadedState,
    persistence: 'none',
  }));
  const state = isCurrentScope(scopedState, userId, roomId, roundId, seatCount)
    ? scopedState.state
    : loadedState;
  const authoritativeSheriffCandidateStatuses =
    createAuthoritativeSheriffCandidateStatuses(gameState);
  const sheriffCandidateStatuses =
    authoritativeSheriffCandidateStatuses ?? createManualSheriffCandidateStatuses(state, seatCount);

  useEffect(() => {
    if (stored.kind === 'stale' && owner !== null) {
      clearWerewolfNotepad(owner);
    }
  }, [owner, stored.kind]);

  useEffect(() => {
    if (
      !isCurrentScope(scopedState, userId, roomId, roundId, seatCount) ||
      scopedState.persistence === 'none'
    ) {
      return;
    }
    if (owner === null || roundId === null) {
      throw new Error('[FAIL-FAST] Cannot persist a Werewolf notepad without an active room');
    }

    if (scopedState.persistence === 'clear') {
      clearWerewolfNotepad(owner);
    } else {
      writeWerewolfNotepad(owner, roundId, seatCount, scopedState.state);
    }

    setScopedState((current) =>
      current === scopedState ? { ...current, persistence: 'none' } : current,
    );
  }, [owner, roomId, roundId, scopedState, seatCount, userId]);

  const updateState = useCallback(
    (update: (current: WerewolfNotepadState) => WerewolfNotepadState) => {
      if (userId === null || roomId === null || roundId === null) {
        throw new Error('[FAIL-FAST] Cannot edit a Werewolf notepad without an active room');
      }
      setScopedState((current) => ({
        userId,
        roomId,
        roundId,
        seatCount,
        state: update(
          isCurrentScope(current, userId, roomId, roundId, seatCount) ? current.state : loadedState,
        ),
        persistence: 'write',
      }));
    },
    [loadedState, roomId, roundId, seatCount, userId],
  );

  const playerCount = gameState === null ? 0 : gameState.templateRoles.length;
  const roleTags = useMemo<readonly RoleTagInfo[]>(() => {
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
  }, [gameState]);

  const setNote = useCallback(
    (seat: number, text: string) => {
      requireNotepadSeat(seat, seatCount);
      updateState((current) => ({
        ...current,
        playerNotes: { ...current.playerNotes, [seat]: text },
      }));
    },
    [seatCount, updateState],
  );

  const setPublicNoteLeft = useCallback(
    (text: string) => {
      updateState((current) => ({ ...current, publicNoteLeft: text }));
    },
    [updateState],
  );

  const setPublicNoteRight = useCallback(
    (text: string) => {
      updateState((current) => ({ ...current, publicNoteRight: text }));
    },
    [updateState],
  );

  const toggleHand = useCallback(
    (seat: number) => {
      requireNotepadSeat(seat, seatCount);
      updateState((current) => ({
        ...current,
        handStates: { ...current.handStates, [seat]: !(current.handStates[seat] ?? false) },
      }));
    },
    [seatCount, updateState],
  );

  const setRole = useCallback(
    (seat: number, roleId: RoleId | null) => {
      requireNotepadSeat(seat, seatCount);
      updateState((current) => ({
        ...current,
        roleGuesses: {
          ...current.roleGuesses,
          [seat]: (current.roleGuesses[seat] ?? null) === roleId ? null : roleId,
        },
      }));
    },
    [seatCount, updateState],
  );

  const clearAll = useCallback(() => {
    if (userId === null || roomId === null || roundId === null) {
      throw new Error('[FAIL-FAST] Cannot clear a Werewolf notepad without an active room');
    }
    setScopedState({
      userId,
      roomId,
      roundId,
      seatCount,
      state: createEmptyWerewolfNotepadState(),
      persistence: 'clear',
    });
  }, [roomId, roundId, seatCount, userId]);

  return {
    state,
    playerCount,
    roleTags,
    sheriffCandidateStatuses,
    isSheriffCandidateStatusAuthoritative: authoritativeSheriffCandidateStatuses !== null,
    setNote,
    setPublicNoteLeft,
    setPublicNoteRight,
    toggleHand,
    setRole,
    clearAll,
  };
}
