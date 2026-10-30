/** Owns mounted story capture and image-only sharing without changing game state. */

import type { StoryRelayState } from '@game-judge/game-engine/games/storyrelay/public';
import { useRef, useState } from 'react';
import type { View } from 'react-native';

import { useShareImageAction } from '@/features/room/controllers/useShareImageAction';
import { captureViewPngBase64 } from '@/features/room/services/captureViewPngBase64';

import { formatStoryRelayStory } from '../storyRelayPresentation';

/** Exports each selected story as its own complete PNG, never the virtualized gallery. */
export function useStoryRelayImageShare(state: StoryRelayState) {
  const [selection, setSelection] = useState<readonly number[] | null>(null);
  const shareAction = useShareImageAction({
    label: '分享故事图片',
    alertMessage: '故事图片分享失败，请稍后重试。',
  });
  const captureRefs = useRef(new Map<string, View>());
  const stories =
    selection?.map((chainIndex) => {
      const chain = state.chains[chainIndex];
      if (chain === undefined) throw new Error('Story image chain missing');
      return { id: chain.id, chainIndex, text: formatStoryRelayStory(state, chain, chainIndex) };
    }) ?? [];

  const share = () =>
    shareAction.share(
      stories.map((story) => ({
        filename: `storyrelay-${state.roomCode}-${state.roundNumber}-${story.chainIndex + 1}.png`,
        getBase64: () => {
          const view = captureRefs.current.get(story.id);
          if (view === undefined) throw new Error('Story image view is not mounted');
          return captureViewPngBase64({ current: view });
        },
      })),
      '故事接龙',
    );

  return {
    isOpen: selection !== null,
    isSharing: shareAction.isSharing,
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
