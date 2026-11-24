import { CANCEL_BUTTON, showAlertWithGeneration } from '@/utils/alert';

/**
 * Presents a confirmation whose title is derived from the action label.
 */
export function confirmAction(input: {
  readonly label: string;
  readonly body?: string;
  readonly tone?: 'default' | 'danger';
  readonly confirmText?: string;
  readonly onCancel?: () => void;
  readonly onConfirm: () => void | Promise<void>;
  readonly onShown?: (generation: number | null) => void;
}): void {
  const title = input.label.endsWith('？') ? input.label : `${input.label}？`;
  const actionText = input.confirmText ?? input.label.replace(/？$/, '');
  const generation = showAlertWithGeneration(title, input.body, [
    { ...CANCEL_BUTTON, onPress: input.onCancel },
    {
      text: input.tone === 'danger' ? actionText : (input.confirmText ?? '确定'),
      style: input.tone === 'danger' ? 'destructive' : 'default',
      onPress: input.onConfirm,
    },
  ]);
  input.onShown?.(generation);
}

/**
 * Asks before revealing information, then shows it with a single acknowledgement button.
 */
export function confirmView(input: {
  readonly label: string;
  readonly onView: () => void | Promise<void>;
  readonly onShown?: (generation: number | null) => void;
}): void {
  const question = input.label.endsWith('？') ? input.label : `${input.label}？`;
  const generation = showAlertWithGeneration(question, '', [
    { ...CANCEL_BUTTON },
    {
      text: '查看',
      onPress: input.onView,
    },
  ]);
  input.onShown?.(generation);
}
