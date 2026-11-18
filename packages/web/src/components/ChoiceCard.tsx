/** 投票 / 出牌的竖版插画卡牌按钮：点选即上报，已选中的那张上浮 + 金边 + 打勾角标。 */
import './ChoiceCard.css';

/** 大卡片按钮；selected 映射 aria-pressed，提交中禁用防重复提交。省略 isSelected 时不带选择态（即时动作卡：不压暗、不打勾）。 */
export function ChoiceCard({
  label,
  imageSrc,
  isSelected,
  isDisabled,
  testId,
  onClick,
}: {
  readonly label: string;
  readonly imageSrc: string;
  readonly isSelected?: boolean;
  readonly isDisabled: boolean;
  readonly testId: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="choice-card"
      aria-pressed={isSelected}
      disabled={isDisabled}
      data-testid={testId}
      onClick={onClick}
    >
      <img src={imageSrc} alt="" decoding="async" className="choice-image" />
      {isSelected && (
        <span className="choice-check" aria-hidden="true">
          ✓
        </span>
      )}
      <span className="choice-label">{label}</span>
    </button>
  );
}
