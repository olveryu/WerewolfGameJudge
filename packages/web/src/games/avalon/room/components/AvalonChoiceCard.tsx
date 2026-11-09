/** 阿瓦隆投票 / 出牌的大卡片按钮：点选即上报，已选中的那张高亮。 */
import './AvalonStageModal.css';

import type { ReactElement } from 'react';

/** 大卡片按钮；selected 映射 aria-pressed，提交中禁用防重复提交。 */
export function AvalonChoiceCard({
  label,
  icon,
  tone,
  isSelected,
  isDisabled,
  testId,
  onClick,
}: {
  readonly label: string;
  readonly icon: ReactElement;
  readonly tone: 'light' | 'dark' | 'gold';
  readonly isSelected: boolean;
  readonly isDisabled: boolean;
  readonly testId: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="avalon-choice-card"
      data-tone={tone}
      aria-pressed={isSelected}
      disabled={isDisabled}
      data-testid={testId}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
