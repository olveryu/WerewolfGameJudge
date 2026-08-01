/** Shared room QR visibility, link copy, and image share controller. */

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner-native';

import type { RoomShareModel } from '@/features/room/model/RoomShare';
import { buildRoomUrl, shareOrCopyRoomLink } from '@/features/room/services/roomShare';
import { shareRoomQRCode } from '@/features/room/services/shareRoomQRCode';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

interface UseRoomShareControllerParams {
  readonly roomCode: string;
  readonly gameDisplayName: string;
}

export function useRoomShareController({
  roomCode,
  gameDisplayName,
}: UseRoomShareControllerParams): RoomShareModel {
  const [isVisible, setIsVisible] = useState(false);

  const open = useCallback(() => {
    if (isVisible) throw new Error('Cannot open room share modal while it is already open');
    setIsVisible(true);
  }, [isVisible]);

  const close = useCallback(() => {
    if (!isVisible) throw new Error('Cannot close room share modal while it is not open');
    setIsVisible(false);
  }, [isVisible]);

  const copyLink = useCallback(async (): Promise<void> => {
    try {
      const result = await shareOrCopyRoomLink(roomCode, gameDisplayName);
      switch (result) {
        case 'copied':
          toast.success('房间链接已复制');
          return;
        case 'shared':
        case 'cancelled':
          return;
        case 'failed':
          showErrorAlert('链接分享失败', '无法复制链接，请手动分享房间号');
          return;
      }
    } catch (error) {
      handleError(error, {
        label: '分享链接',
        logger: roomScreenLog,
        alertMessage: '无法复制链接，请手动分享房间号',
      });
    }
  }, [gameDisplayName, roomCode]);

  const shareImage = useCallback(
    async (getBase64: () => Promise<string>): Promise<void> => {
      try {
        await shareRoomQRCode(getBase64, roomCode, gameDisplayName);
      } catch (error) {
        handleError(error, {
          label: '分享二维码',
          logger: roomScreenLog,
          alertMessage: '无法分享二维码图片',
        });
      }
    },
    [gameDisplayName, roomCode],
  );

  return useMemo(
    () => ({
      isVisible,
      roomCode,
      roomUrl: buildRoomUrl(roomCode),
      open,
      close,
      copyLink,
      shareImage,
    }),
    [close, copyLink, isVisible, open, roomCode, shareImage],
  );
}
