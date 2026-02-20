/**
 * useNotepad - 笔记本状态管理 hook
 *
 * 管理玩家笔记（文本 + 上警/身份/角色猜测标记），通过 AsyncStorage 持久化。
 * 提供 toggleHand / cycleIdentity / setNote / setRole / clearAll 操作。
 * 纯客户端状态，不涉及服务端 API 或 game-engine 逻辑。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ROLE_SPECS, type RoleId } from '@werewolf/game-engine/models/roles';
import type { Faction } from '@werewolf/game-engine/models/roles/spec/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { IGameFacade } from '@/services/types/IGameFacade';
import { chatLog } from '@/utils/logger';

// ── Types ────────────────────────────────────────────────

/** 身份标记：0=未标记, 1=好人, 2=坏人, 3=存疑 */
export type IdentityState = 0 | 1 | 2 | 3;

/** 角色标签信息（从 ROLE_SPECS 派生） */
export interface RoleTagInfo {
  roleId: RoleId;
  shortName: string;
  team: 'good' | 'wolf' | 'third';
  faction: Faction;
}

export interface NotepadState {
  playerNotes: Record<number, string>;
  handStates: Record<number, boolean>;
  identityStates: Record<number, IdentityState>;
  roleGuesses: Record<number, RoleId | null>;
}

export interface UseNotepadReturn {
  state: NotepadState;
  playerCount: number;
  roleTags: readonly RoleTagInfo[];
  setNote: (seat: number, text: string) => void;
  toggleHand: (seat: number) => void;
  cycleIdentity: (seat: number) => void;
  setRole: (seat: number, roleId: RoleId | null) => void;
  clearAll: () => void;
}

// ── Constants ────────────────────────────────────────────

const STORAGE_KEY_PREFIX = '@notepad:';
const IDENTITY_COUNT = 4; // 0→1→2→3→0

function emptyState(): NotepadState {
  return { playerNotes: {}, handStates: {}, identityStates: {}, roleGuesses: {} };
}

function getStorageKey(roomCode: string | null): string | null {
  return roomCode ? `${STORAGE_KEY_PREFIX}${roomCode}` : null;
}

// ══════════════════════════════════════════════════════════
// Hook
// ══════════════════════════════════════════════════════════

export function useNotepad(facade: IGameFacade): UseNotepadReturn {
  const [state, setState] = useState<NotepadState>(emptyState);

  // Derive player count from game state
  const gameState = facade.getState();
  const playerCount = gameState?.templateRoles?.length ?? 12;
  const templateRoles = gameState?.templateRoles;
  const roomCode = gameState?.roomCode ?? null;
  const storageKey = getStorageKey(roomCode);

  // ── Derive role tags from templateRoles (schema-driven) ──
  const roleTags = useMemo<readonly RoleTagInfo[]>(() => {
    if (!templateRoles) return [];
    const seen = new Set<RoleId>();
    const good: RoleTagInfo[] = [];
    const wolf: RoleTagInfo[] = [];
    const third: RoleTagInfo[] = [];
    for (const roleId of templateRoles) {
      if (seen.has(roleId as RoleId)) continue;
      seen.add(roleId as RoleId);
      const spec = ROLE_SPECS[roleId as RoleId];
      if (!spec) continue;
      const info: RoleTagInfo = {
        roleId: roleId as RoleId,
        shortName: spec.shortName,
        team: spec.team,
        faction: spec.faction,
      };
      if (spec.team === 'wolf') wolf.push(info);
      else if (spec.team === 'third') third.push(info);
      else good.push(info);
    }
    return [...good, ...wolf, ...third];
  }, [templateRoles]);

  // ── Load from AsyncStorage on mount / room change ────
  useEffect(() => {
    if (!storageKey) return;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as NotepadState;
            setState(parsed);
          } catch {
            chatLog.warn('Failed to parse notepad state');
          }
        }
      })
      .catch((e) => {
        chatLog.warn('Failed to load notepad state:', e);
      });
  }, [storageKey]);

  // ── Persist helper (debounced to avoid thrashing) ────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup pending save timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const persistState = useCallback(
    (newState: NotepadState) => {
      if (!storageKey) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        AsyncStorage.setItem(storageKey, JSON.stringify(newState)).catch((e) => {
          chatLog.warn('Failed to save notepad state:', e);
        });
      }, 500);
    },
    [storageKey],
  );

  // ── Actions ──────────────────────────────────────────

  const setNote = useCallback(
    (seat: number, text: string) => {
      setState((prev) => {
        const next = { ...prev, playerNotes: { ...prev.playerNotes, [seat]: text } };
        persistState(next);
        return next;
      });
    },
    [persistState],
  );

  const toggleHand = useCallback(
    (seat: number) => {
      setState((prev) => {
        const current = prev.handStates[seat] ?? false;
        const newState = { ...prev, handStates: { ...prev.handStates, [seat]: !current } };
        persistState(newState);
        return newState;
      });
    },
    [persistState],
  );

  const cycleIdentity = useCallback(
    (seat: number) => {
      setState((prev) => {
        const current = prev.identityStates[seat] ?? 0;
        const next: IdentityState = ((current + 1) % IDENTITY_COUNT) as IdentityState;
        const newState = { ...prev, identityStates: { ...prev.identityStates, [seat]: next } };
        persistState(newState);
        return newState;
      });
    },
    [persistState],
  );

  const setRole = useCallback(
    (seat: number, roleId: RoleId | null) => {
      setState((prev) => {
        const currentRole = prev.roleGuesses[seat] ?? null;
        const newRole = currentRole === roleId ? null : roleId;
        const newState = { ...prev, roleGuesses: { ...prev.roleGuesses, [seat]: newRole } };
        persistState(newState);
        return newState;
      });
    },
    [persistState],
  );

  const clearAll = useCallback(() => {
    const cleared = emptyState();
    setState(cleared);
    if (storageKey) {
      AsyncStorage.removeItem(storageKey).catch((e) => {
        chatLog.warn('Failed to clear notepad state:', e);
      });
    }
  }, [storageKey]);

  return { state, playerCount, roleTags, setNote, toggleHand, cycleIdentity, setRole, clearAll };
}
