/** 带标签的加减数量控件：减号、当前值、加号；不依赖滑动操作。 */
import './ToolboxStepper.css';

export interface ToolboxStepperProps {
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  readonly isDisabled: boolean;
  readonly onChange: (value: number) => void;
}

/** 数量步进器；边界值禁用对应按钮。 */
export function ToolboxStepper({
  label,
  value,
  unit,
  min,
  max,
  isDisabled,
  onChange,
}: ToolboxStepperProps) {
  return (
    <div className="toolbox-stepper" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`减少一${unit}`}
        disabled={isDisabled || value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output aria-live="polite">
        {value} {unit}
      </output>
      <button
        type="button"
        aria-label={`增加一${unit}`}
        disabled={isDisabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
