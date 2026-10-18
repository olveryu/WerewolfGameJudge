/**
 * useRoomHostDialogs - MVP selection and settings entry for
 * WerewolfRoomScreen.
 *
 * The host flow commands (assign / start / restart) are panel commands
 * and live in useWerewolfHostControl on the shared command pipeline.
 * This hook keeps the two remaining host extras that are not panel
 * commands: the MVP selection flow and the room-settings navigation.
 */
import {
  GameStatus,
  type WerewolfMvpSelection,
} from '@game-judge/game-engine/games/werewolf/public';
import { getMvpGoldenDraws } from '@game-judge/game-engine/product/rewards';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';

import { isSuccessfulRoomCommand } from '@/features/room/session/roomCommandResult';
import type { WerewolfCommandDispatchOutcome } from '@/games/werewolf/runtime/WerewolfGameClient';
import type { LocalGameState } from '@/games/werewolf/state/LocalGameState';
import type { RootStackParamList } from '@/navigation/types';
import { showDismissAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

interface UseRoomHostDialogsParams {
  gameState: LocalGameState;
  selectMvp: (selection: WerewolfMvpSelection) => Promise<WerewolfCommandDispatchOutcome>;

  navigation: NativeStackNavigationProp<RootStackParamList, 'Room'>;
  roomCode: string;
}

interface UseRoomHostDialogsResult {
  mvpSelection: {
    participants: readonly {
      userId: string;
      seat: number;
      displayName: string;
      hasLeft: boolean;
    }[];
    goldenDraws: number;
    roleRevealRandomNonce: string | null;
    onSelect: (userId: string) => Promise<void>;
  } | null;
  showMvpSelection: () => void;
  closeMvpSelection: () => void;
  handleSettingsPress: () => void;
  /** True while an MVP selection submission is in-flight. */
  isMvpSubmitting: boolean;
}

/** Host extras hook (MVP selection + room settings navigation). */
export const useRoomHostDialogs = ({
  gameState,
  selectMvp,
  navigation,
  roomCode,
}: UseRoomHostDialogsParams): UseRoomHostDialogsResult => {
  const submittingRef = useRef(false);
  const [isMvpSubmitting, setIsMvpSubmitting] = useState(false);
  const [mvpSelection, setMvpSelection] = useState<UseRoomHostDialogsResult['mvpSelection']>(null);
  const closeMvpSelection = useCallback(() => {
    if (!submittingRef.current) setMvpSelection(null);
  }, []);

  /** Mark MVP submission start (ref + state). */
  const markSubmitting = useCallback((v: boolean) => {
    submittingRef.current = v;
    setIsMvpSubmitting(v);
  }, []);

  const showMvpSelection = useCallback(() => {
    if (submittingRef.current) return;
    if (gameState.status !== GameStatus.Ended || gameState.mvpUserId !== undefined) return;
    const participants = gameState.startingParticipants;
    if (participants === undefined) {
      showDismissAlert('无法评选 MVP', '本局缺少开局真人名单');
      return;
    }
    const roleRevealRandomNonce = gameState.roleRevealRandomNonce ?? null;
    setMvpSelection({
      participants: participants.map((participant) => {
        const player = gameState.players.get(participant.seat);
        const hasLeft = player?.userId !== participant.userId;
        return {
          ...participant,
          displayName: hasLeft ? '' : (player.displayName ?? ''),
          hasLeft,
        };
      }),
      goldenDraws: getMvpGoldenDraws(participants.length),
      roleRevealRandomNonce,
      onSelect: async (mvpUserId) => {
        if (submittingRef.current) return;
        markSubmitting(true);
        try {
          const result = await selectMvp({ roleRevealRandomNonce, mvpUserId });
          if (isSuccessfulRoomCommand(result)) setMvpSelection(null);
        } catch (err) {
          handleError(err, { label: '评选 MVP', logger: roomScreenLog, feedback: 'toast' });
        } finally {
          markSubmitting(false);
        }
      },
    });
  }, [gameState, markSubmitting, selectMvp]);

  const handleSettingsPress = useCallback(() => {
    navigation.navigate('GameConfig', {
      gameType: 'werewolf',
      mode: 'edit',
      roomCode,
    });
  }, [navigation, roomCode]);

  return {
    mvpSelection:
      gameState.status === GameStatus.Ended &&
      gameState.mvpUserId === undefined &&
      mvpSelection?.roleRevealRandomNonce === (gameState.roleRevealRandomNonce ?? null)
        ? mvpSelection
        : null,
    showMvpSelection,
    closeMvpSelection,
    handleSettingsPress,
    isMvpSubmitting,
  };
};
