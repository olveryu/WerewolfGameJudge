/**
 * 阿瓦隆投票与任务结果面板：展示服务端倒计时，到期后自动推进。
 */
import '@/components/CenterDialog.css';
import './AvalonResultPanel.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import type { ReactNode } from 'react';

import { TESTIDS } from '@/testids';

/** 结算面板：banner 是对话框标题，outcome 决定横幅颜色；有 bannerImageSrc 时标题上方渲染全宽横幅图。 */
export function AvalonResultDialog({
  banner,
  bannerImageSrc,
  outcome,
  kind,
  remainingSeconds,
  children,
}: {
  readonly banner: string;
  readonly bannerImageSrc?: string;
  readonly outcome: 'positive' | 'negative';
  /** Which settlement this is; keys the panel / banner / close test ids. */
  readonly kind: 'vote' | 'quest';
  readonly remainingSeconds: number | null;
  readonly children: ReactNode;
}) {
  return (
    <Dialog.Root
      open
      onEscapeKeyDown={(event) => event.preventDefault()}
      onInteractOutside={(event) => event.preventDefault()}
    >
      <Portal>
        <Dialog.Backdrop className="center-dialog-backdrop" />
        <Dialog.Positioner className="center-dialog-positioner">
          <Dialog.Content
            className="center-dialog"
            data-kind={kind}
            data-testid={TESTIDS.avalonResultPanel(kind)}
          >
            {bannerImageSrc !== undefined && (
              <img
                src={bannerImageSrc}
                alt=""
                decoding="async"
                className="avalon-result-banner-image"
                data-testid={TESTIDS.avalonResultBannerImage(kind)}
              />
            )}
            {kind === 'vote' && <p className="avalon-vote-result-eyebrow">圆桌投票</p>}
            <Dialog.Title
              className="avalon-result-banner"
              data-outcome={outcome}
              data-testid={TESTIDS.avalonResultBanner(kind)}
            >
              {banner}
            </Dialog.Title>
            {children}
            <p>
              {remainingSeconds === null || remainingSeconds === 0
                ? '等待进入下一阶段…'
                : `${remainingSeconds} 秒后继续`}
            </p>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
