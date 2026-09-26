/** Non-virtualized printable stories with image-only export controls. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { RoomDialog } from '@/features/room/components/RoomDialog';
import { colors, componentSizes } from '@/theme';

import { useStoryRelayImageShare } from '../hooks/useStoryRelayImageShare';
import { storyRelayStyles as styles } from './StoryRelayStage.styles';

/** Renders every selected story fully so off-screen fragments are included in each PNG. */
export function StoryRelayImageShare({
  state,
  chainIndex,
}: {
  readonly state: StoryRelayState;
  readonly chainIndex: number;
}) {
  const model = useStoryRelayImageShare(state);
  return (
    <>
      <Button
        variant="secondary"
        style={styles.shareButton}
        accessibilityLabel="分享本篇故事"
        onPress={() => model.openStory(chainIndex)}
        icon={<Ionicons name="image-outline" size={componentSizes.icon.sm} color={colors.text} />}
      >
        分享本篇故事
      </Button>
      {model.isOpen && (
        <RoomDialog
          title="故事图片"
          onClose={model.close}
          footer={
            <Button
              accessibilityLabel="保存／分享图片"
              onPress={model.share}
              loading={model.isSharing}
              disabled={model.isSharing}
              icon={
                <Ionicons name="share-outline" size={componentSizes.icon.sm} color={colors.text} />
              }
            >
              保存／分享图片
            </Button>
          }
        >
          {model.stories.map((story) => (
            <View
              key={story.id}
              collapsable={false}
              ref={(view) => model.setCaptureRef(story.id, view)}
              style={styles.imagePage}
              testID={`storyrelay-export-${story.chainIndex}`}
            >
              <Text style={styles.title}>文字接龙</Text>
              <Text style={styles.text}>{story.text}</Text>
            </View>
          ))}
        </RoomDialog>
      )}
    </>
  );
}
