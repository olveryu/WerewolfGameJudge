/**
 * 阿瓦隆结算面板外壳（投票结算 / 任务结算同范式）：彩色结论横幅 + 内容 + "知道了"。
 * 挂载即开始自动关闭倒计时，到时、手动"知道了"、Escape、点背景都走 onClose。
 */
import '@/components/CenterDialog.css';
import './AvalonResultPanel.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import { type ReactNode, useEffect, useEffectEvent } from 'react';

import { Button } from '@/components/Button';
import { TESTIDS } from '@/testids';

/** 结算面板自动关闭时长（设计稿 412 行"展示后自动进下一阶段"；D4 的"无计时"指游戏逻辑 deadline）。 */
const RESULT_AUTO_DISMISS_MS = 6000;

/** 结算面板：banner 是对话框标题，outcome 决定横幅颜色。 */
export function AvalonResultDialog({
  banner,
  outcome,
  kind,
  onClose,
  children,
}: {
  readonly banner: string;
  readonly outcome: 'positive' | 'negative';
  /** Which settlement this is; keys the panel / banner / close test ids. */
  readonly kind: 'vote' | 'quest';
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  const autoDismiss = useEffectEvent(() => onClose());
  useEffect(() => {
    const timer = setTimeout(() => autoDismiss(), RESULT_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Dialog.Root
      open
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop className="center-dialog-backdrop" />
        <Dialog.Positioner className="center-dialog-positioner">
          <Dialog.Content className="center-dialog" data-testid={TESTIDS.avalonResultPanel(kind)}>
            <Dialog.Title
              className="avalon-result-banner"
              data-outcome={outcome}
              data-testid={TESTIDS.avalonResultBanner(kind)}
            >
              {banner}
            </Dialog.Title>
            {children}
            <Button
              variant="secondary"
              size="lg"
              onClick={onClose}
              data-testid={TESTIDS.avalonResultClose(kind)}
            >
              知道了
            </Button>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
