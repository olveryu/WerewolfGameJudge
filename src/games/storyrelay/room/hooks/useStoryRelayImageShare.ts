/** Owns mounted story capture and image-only sharing without changing game state. */

import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';
import { useRef, useState } from 'react';
import type { View } from 'react-native';

import { captureViewPngBase64 } from '@/features/room/services/captureViewPngBase64';
import { shareImagesBase64 } from '@/features/room/services/shareImage';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import { formatStoryRelayStory } from '../storyRelayPresentation';

/** Exports each selected story as its own complete PNG, never the virtualized gallery. */
export function useStoryRelayImageShare(state: StoryRelayState) {
  const [selection, setSelection] = useState<readonly number[] | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const captureRefs = useRef(new Map<string, View>());
  const stories =
    selection?.map((chainIndex) => {
      const chain = state.chains[chainIndex];
      if (chain === undefined) throw new Error('Story image chain missing');
      return { id: chain.id, chainIndex, text: formatStoryRelayStory(state, chain, chainIndex) };
    }) ?? [];

  const share = async () => {
    setIsSharing(true);
    try {
      await shareImagesBase64(
        stories.map((story) => ({
          filename: `storyrelay-${state.roomCode}-${state.roundNumber}-${story.chainIndex + 1}.png`,
          getBase64: () => {
            const view = captureRefs.current.get(story.id);
            if (view === undefined) throw new Error('Story image view is not mounted');
            return captureViewPngBase64({ current: view });
          },
        })),
        '文字接龙',
      );
    } catch (error) {
      handleError(error, {
        label: '分享故事图片',
        logger: roomScreenLog,
        alertMessage: '故事图片分享失败，请稍后重试。',
      });
    } finally {
      setIsSharing(false);
    }
  };

  return {
    isOpen: selection !== null,
    isSharing,
    stories,
    openStory: (chainIndex: number) => setSelection([chainIndex]),
    close: () => setSelection(null),
    setCaptureRef: (id: string, view: View | null) => {
      if (view === null) captureRefs.current.delete(id);
      else captureRefs.current.set(id, view);
    },
    share: () => void share(),
  };
}
