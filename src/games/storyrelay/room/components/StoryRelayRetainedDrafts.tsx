/** Gives local rejected or skipped manuscripts an explicit copy path without exposing other users' drafts. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button } from '@/components/Button';
import { RoomDialog } from '@/features/room/components/RoomDialog';
import { copyStoryRelayText } from '@/games/storyrelay/services/copyStoryRelayText';
import { readStoryRelayRoundDrafts } from '@/games/storyrelay/services/storyRelayDrafts';
import { colors, componentSizes } from '@/theme';

import { storyRelayStyles as styles } from './StoryRelayStage.styles';

/** Loads only this account's draft keys for the currently retained round. */
export function StoryRelayRetainedDrafts({
  state,
  roomId,
  userId,
}: {
  readonly state: StoryRelayState;
  readonly roomId: string;
  readonly userId: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const open = () => {
    setText(
      readStoryRelayRoundDrafts(state, roomId, userId)
        .filter((draft) => draft.text.trim().length > 0)
        .map(
          (draft) => `第 ${draft.stepIndex + 1} 棒 · ${draft.authorSeat + 1} 号位\n${draft.text}`,
        )
        .join('\n\n'),
    );
  };
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onPress={open}
        icon={
          <Ionicons
            name="document-text-outline"
            size={componentSizes.icon.sm}
            color={colors.text}
          />
        }
      >
        本机保留草稿
      </Button>
      {text !== null && (
        <RoomDialog
          title="本机保留草稿"
          onClose={() => setText(null)}
          footer={
            <Button
              disabled={text.length === 0}
              onPress={() => void copyStoryRelayText(text)}
              icon={
                <Ionicons name="copy-outline" size={componentSizes.icon.sm} color={colors.text} />
              }
            >
              复制草稿
            </Button>
          }
        >
          <Text selectable style={styles.text}>
            {text.length === 0 ? '没有保留的文字草稿' : text}
          </Text>
        </RoomDialog>
      )}
    </>
  );
}
