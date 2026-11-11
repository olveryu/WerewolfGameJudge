import { useEffect, useRef } from 'react';

import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

/**
 * Warms portraits from the public board, never from a player's secret assignment. Keep the
 * images alive while the room is mounted so decoded portraits can be reused by the role card.
 * Failed preloads are logged once; they do not prevent the card's normal image request.
 */
export function useRolePortraitPreload(portraitUrls: readonly string[]): void {
  const portraits = useRef(new Map<string, HTMLImageElement>());

  useEffect(() => {
    for (const url of portraitUrls) {
      if (portraits.current.has(url)) continue;
      const image = new Image();
      portraits.current.set(url, image);
      image.fetchPriority = 'low';
      image.src = url;
      void image.decode().catch((error: unknown) => {
        handleError(error, {
          label: '预加载角色立绘',
          logger: roomScreenLog,
          feedback: false,
        });
      });
    }
  }, [portraitUrls]);
}
