/**
 * useNotepad - 笔记本状态管理 hook
 *
 * 管理玩家笔记（文本 + 上警/身份标记），通过 AsyncStorage 持久化。
 * 提供 cycleHand / cycleIdentity / setNote / clearAll 操作。
 * 纯客户端状态，不涉及服务端 API 或 game-engine 逻辑。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { IGameFacade } from '@/services/types/IGameFacade';
import { chatLog } from '@/utils/logger';

// ── Types ────────────────────────────────────────────────

/** 上警状态：0=未标记, 1=上警, 2=退水 */
export type HandState = 0 | 1 | 2;

/** 身份标记：0=未标记(👤), 1=好人(👍), 2=坏人(👎), 3=存疑(❓) */
export type IdentityState = 0 | 1 | 2 | 3;

export interface NotepadState {
  playerNotes: Record<number, string>;
  handStates: Record<number, HandState>;
  identityStates: Record<number, IdentityState>;
}

export interface UseNotepadReturn {
  state: NotepadState;
  playerCount: number;
  setNote: (seat: number, text: string) => void;
  cycleHand: (seat: number) => void;
  cycleIdentity: (seat: number) => void;
  clearAll: () => void;
}

// ── Constants ────────────────────────────────────────────

const STORAGE_KEY_PREFIX = '@notepad:';
const HAND_COUNT = 3; // 0→1→2→0
const IDENTITY_COUNT = 4; // 0→1→2→3→0

function emptyState(): NotepadState {
  return { playerNotes: {}, handStates: {}, identityStates: {} };
}

function getStorageKey(roomCode: string | null): string | null {
  return roomCode ? `${STORAGE_KEY_PREFIX}${roomCode}` : null;
}

// ══════════════════════════════════════════════════════════
// Hook
// ══════════════════════════════════════════════════════════

export function useNotepad(facade: IGameFacade): UseNotepadReturn {
  const [state, setState] = useState<NotepadState>(emptyState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Derive player count from game state
  const gameState = facade.getState();
  const playerCount = gameState?.templateRoles?.length ?? 12;
  const roomCode = gameState?.roomCode ?? null;
  const storageKey = getStorageKey(roomCode);

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

  const cycleHand = useCallback(
    (seat: number) => {
      setState((prev) => {
        const current = prev.handStates[seat] ?? 0;
        const next: HandState = ((current + 1) % HAND_COUNT) as HandState;
        const newState = { ...prev, handStates: { ...prev.handStates, [seat]: next } };
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

  const clearAll = useCallback(() => {
    const cleared = emptyState();
    setState(cleared);
    if (storageKey) {
      AsyncStorage.removeItem(storageKey).catch((e) => {
        chatLog.warn('Failed to clear notepad state:', e);
      });
    }
  }, [storageKey]);

  return { state, playerCount, setNote, cycleHand, cycleIdentity, clearAll };
}
