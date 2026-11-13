/**
 * Room share dialog: the room URL as a QR code with the room code, plus 复制链接 and 分享图片.
 * Inside the WeChat mini program it shows the native forward guide instead. The share card is
 * captured as soon as it is painted, so a tap hands the image over within its user activation.
 */
import './RoomShareDialog.css';

import { QrCode } from '@ark-ui/react/qr-code';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import type { RoomShareModel } from '@/features/room/model/RoomShare';
import { captureElementPngBase64 } from '@/features/room/services/captureElementPng';
import { TESTIDS } from '@/testids';
import { log } from '@/utils/logger';
import { isMiniProgram } from '@/utils/miniProgram';
import IconPaperPlaneOutline from '~icons/ion/paper-plane-outline';

import appLogoUrl from '../../../../../../assets/pwa/icon-192.png';

function ShareCard({ model }: { readonly model: RoomShareModel }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isLogoLoaded, setIsLogoLoaded] = useState(false);
  const [capture, setCapture] = useState<{ readonly base64: string | null } | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    const card = cardRef.current;
    if (!isLogoLoaded || card === null) return;
    let isCancelled = false;
    const frame = requestAnimationFrame(() => {
      captureElementPngBase64(card).then(
        (base64) => {
          if (!isCancelled) setCapture({ base64 });
        },
        (error: unknown) => {
          if (isCancelled) return;
          log.warn('Pre-capture share card failed', {
            error: error instanceof Error ? error.message : String(error),
          });
          setCapture({ base64: null });
        },
      );
    });
    return () => {
      isCancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [isLogoLoaded]);

  const getBase64 = useCallback(async () => {
    const card = cardRef.current;
    if (capture?.base64 != null) return capture.base64;
    if (card === null) throw new Error('[FAIL-FAST] Share card is not mounted');
    return captureElementPngBase64(card);
  }, [capture]);

  const share = async () => {
    setIsSharing(true);
    try {
      await model.shareImage(getBase64);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <>
      <div ref={cardRef} className="room-share-card">
        <QrCode.Root value={model.roomUrl} encoding={{ ecc: 'H' }} className="room-share-qr">
          <QrCode.Frame className="room-share-qr-frame">
            <QrCode.Pattern className="room-share-qr-pattern" />
          </QrCode.Frame>
          <QrCode.Overlay className="room-share-qr-logo">
            {/* The logo comes from the CDN in deploy builds; CORS mode keeps the capture untainted. */}
            <img
              src={appLogoUrl}
              alt=""
              crossOrigin="anonymous"
              onLoad={() => setIsLogoLoaded(true)}
            />
          </QrCode.Overlay>
        </QrCode.Root>
        <p className="room-share-code">房间号 {model.roomCode}</p>
        <p className="room-share-hint">扫一扫二维码，加入房间</p>
      </div>
      <div className="room-share-actions">
        <Button onClick={() => void model.copyLink()}>复制链接（推荐）</Button>
        <Button
          variant="secondary"
          loading={isSharing || capture === null}
          onClick={() => void share()}
          data-testid={TESTIDS.qrCodeShareButton}
        >
          分享图片
        </Button>
        <Button variant="secondary" onClick={model.close} data-testid={TESTIDS.qrCodeCloseButton}>
          关闭
        </Button>
      </div>
    </>
  );
}

function ForwardGuide({ model }: { readonly model: RoomShareModel }) {
  return (
    <>
      <div className="room-share-card">
        <IconPaperPlaneOutline className="room-share-guide-icon" aria-hidden />
        <p className="room-share-code">房间号 {model.roomCode}</p>
        <ol className="room-share-guide">
          <li>点击右上角 ··· 按钮</li>
          <li>选择「转发给朋友」</li>
        </ol>
        <p className="room-share-hint">好友打开直接进入房间 🎉</p>
      </div>
      <div className="room-share-actions">
        <Button onClick={model.close}>我知道了</Button>
      </div>
    </>
  );
}

export function RoomShareDialog({ model }: { readonly model: RoomShareModel }) {
  return (
    <CenterDialog
      open={model.isVisible}
      onClose={model.close}
      title="分享房间"
      testId={TESTIDS.qrCodeModal}
    >
      {isMiniProgram() ? <ForwardGuide model={model} /> : <ShareCard model={model} />}
    </CenterDialog>
  );
}
