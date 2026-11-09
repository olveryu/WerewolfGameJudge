/**
 * 阿瓦隆湖仙查验结果弹窗：结果产生时向持有人自动弹出一次（按查验去重），
 * 手动关闭——结果不在公开历史中呈现，自动关可能让持有人错过。
 */
import './AvalonDialogs.css';

import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';

import { getAvalonCheckedFactionDisplayName } from '../../model/avalonRoleDisplay';

/** 查验结果弹窗：只有查验持有人能看到（viewModel 已按持有人裁剪）。 */
export function AvalonLadyResultModal({
  targetName,
  faction,
  onClose,
}: {
  readonly targetName: string;
  readonly faction: 'good' | 'evil';
  readonly onClose: () => void;
}) {
  return (
    <CenterDialog open onClose={onClose} title="查验结果" testId="avalon-lady-result-modal">
      <p className="avalon-dialog-body" data-testid="avalon-lady-result-text">
        {targetName} 是{getAvalonCheckedFactionDisplayName(faction)}人。
      </p>
      <p className="avalon-dialog-hint">查验结果只有你能看到，可在讨论中透露、隐瞒或误导。</p>
      <Button size="lg" onClick={onClose} data-testid="avalon-lady-result-close">
        知道了
      </Button>
    </CenterDialog>
  );
}
