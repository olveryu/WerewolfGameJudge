/**
 * useRoomShareActions — shared QR/link sharing controller for room screens.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner-native';

import { shareQRCodeImage } from '@/components/room/shareQRCode';
import { buildRoomUrl, shareOrCopyRoomLink } from '@/components/room/shareRoom';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

interface UseRoomShareActionsParams {
  roomCode: string;
  gameName?: string;
  autoShowWhen: boolean;
}

export function useRoomShareActions({
  roomCode,
  gameName,
  autoShowWhen,
}: UseRoomShareActionsParams) {
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const hasAutoShownQR = useRef(false);

  useEffect(() => {
    if (!autoShowWhen || hasAutoShownQR.current) return;
    hasAutoShownQR.current = true;
    setQrModalVisible(true);
  }, [autoShowWhen]);

  const openQRCode = useCallback(() => {
    setQrModalVisible(true);
  }, []);

  const closeQRCode = useCallback(() => {
    setQrModalVisible(false);
  }, []);

  const handleCopyLink = useCallback(() => {
    void shareOrCopyRoomLink(roomCode, { gameName })
      .then((result) => {
        if (result === 'copied') {
          toast.success('房间链接已复制');
        } else if (result === 'failed') {
          showErrorAlert('链接分享失败', '无法复制链接，请手动分享房间号');
        }
      })
      .catch((err) => {
        handleError(err, {
          label: '分享链接',
          logger: roomScreenLog,
          alertMessage: '无法复制链接，请手动分享房间号',
        });
      });
  }, [gameName, roomCode]);

  const handleShareQRCode = useCallback(
    (getBase64: () => Promise<string>) => {
      void shareQRCodeImage(getBase64, roomCode, gameName).catch((err) => {
        handleError(err, {
          label: '分享二维码',
          logger: roomScreenLog,
          alertMessage: '无法分享二维码图片',
        });
      });
    },
    [gameName, roomCode],
  );

  return useMemo(
    () => ({
      qrModalVisible,
      roomUrl: buildRoomUrl(roomCode),
      openQRCode,
      closeQRCode,
      handleCopyLink,
      handleShareQRCode,
    }),
    [closeQRCode, handleCopyLink, handleShareQRCode, openQRCode, qrModalVisible, roomCode],
  );
}
