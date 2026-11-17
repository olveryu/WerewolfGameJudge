/** 阿瓦隆投票 / 出牌的圆桌卡牌按钮：竖版插画卡，点选即上报，已选中的那张上浮 + 金边 + 打勾角标。 */
import './AvalonStageModal.css';

/** 大卡片按钮；selected 映射 aria-pressed，提交中禁用防重复提交。 */
export function AvalonChoiceCard({
  label,
  imageSrc,
  isSelected,
  isDisabled,
  testId,
  onClick,
}: {
  readonly label: string;
  readonly imageSrc: string;
  readonly isSelected: boolean;
  readonly isDisabled: boolean;
  readonly testId: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="avalon-choice-card"
      aria-pressed={isSelected}
      disabled={isDisabled}
      data-testid={testId}
      onClick={onClick}
    >
      <img src={imageSrc} alt="" decoding="async" className="avalon-choice-image" />
      {isSelected && (
        <span className="avalon-choice-check" aria-hidden="true">
          ✓
        </span>
      )}
      <span className="avalon-choice-label">{label}</span>
    </button>
  );
}
