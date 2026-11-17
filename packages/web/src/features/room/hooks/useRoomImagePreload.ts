import { useEffect, useRef } from 'react';

import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

/**
 * Warms room images that are public to everyone in the room — role portraits from the
 * public board, plus the game's other room art — never from a player's secret assignment.
 * Keep the images alive while the room is mounted so decoded images can be reused when
 * they are shown. Failed preloads are logged once; they do not prevent the normal
 * image request.
 */
export function useRoomImagePreload(imageUrls: readonly string[]): void {
  const images = useRef(new Map<string, HTMLImageElement>());

  useEffect(() => {
    for (const url of imageUrls) {
      if (images.current.has(url)) continue;
      const image = new Image();
      images.current.set(url, image);
      image.fetchPriority = 'low';
      image.src = url;
      void image.decode().catch((error: unknown) => {
        handleError(error, {
          label: '预加载房间图片',
          logger: roomScreenLog,
          feedback: false,
        });
      });
    }
  }, [imageUrls]);
}
