/**
 * Word-category choice backed by the live inventory: the schema supplies the
 * full option list and labels, the inventory decides which are selectable
 * today. Loading and empty inventories render as hints; errors go through the
 * shared error pipeline. Submission is gated by useUndercoverConfigSubmitGate.
 */

import type {
  UndercoverCategory,
  UndercoverConfig,
} from '@game-judge/game-engine/games/undercover/public';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { GameSettingsChoice } from '@/components/GameSettings';
import type {
  ConfigFieldRendererProps,
  ConfigSubmitGate,
} from '@/features/room/config/GameConfigScreenDefinition';
import { TESTIDS } from '@/testids';
import { handleError } from '@/utils/errorPipeline';
import { configLog } from '@/utils/logger';

import { undercoverInventoryOptions } from '../services/undercoverInventory';

function isAvailable(
  value: unknown,
  available: readonly UndercoverCategory[],
): value is UndercoverConfig['category'] {
  return value === 'all' || available.some((category) => category === value);
}

/** Category field of the undercover config form, limited to categories that have words today. */
export function UndercoverCategoryField({
  spec,
  value,
  onChange,
  issueMessage,
  testId,
}: ConfigFieldRendererProps) {
  if (spec.kind !== 'choice') {
    throw new Error('[FAIL-FAST] Undercover category renderer requires a choice field');
  }
  const inventory = useQuery(undercoverInventoryOptions);
  useEffect(() => {
    if (inventory.error !== null) {
      handleError(inventory.error, {
        label: '读取词语分类',
        logger: configLog,
        alertMessage: '读取词语分类失败，请重试',
      });
    }
  }, [inventory.error]);

  const available = inventory.isSuccess ? inventory.data.availableCategories : [];
  const options = spec.options.flatMap((option) =>
    isAvailable(option.value, available) ? [{ value: option.value, label: option.label }] : [],
  );
  const selected = typeof value === 'string' ? value : null;

  return (
    <div data-testid={testId}>
      {inventory.isPending ? (
        <div className="game-settings-section">
          <span className="game-settings-label">{spec.label}</span>
          <p className="game-settings-hint">正在读取分类</p>
        </div>
      ) : inventory.isSuccess && !inventory.data.hasAnyWords ? (
        <div className="game-settings-section">
          <span className="game-settings-label">{spec.label}</span>
          <p className="game-settings-hint">暂无可用词语</p>
        </div>
      ) : (
        <GameSettingsChoice<string | null>
          title={spec.label}
          hint={spec.hint}
          options={options}
          value={selected}
          onChange={onChange}
          optionTestId={(option) =>
            TESTIDS.gameConfigFieldOption('undercover', 'category', String(option))
          }
        />
      )}
      {issueMessage !== null && (
        <p
          className="game-settings-issue"
          aria-live="polite"
          data-testid={TESTIDS.gameConfigFieldIssue('undercover', 'category')}
        >
          {issueMessage}
        </p>
      )}
    </div>
  );
}

/** Create/save is blocked until the inventory has loaded and the chosen category has words. */
export function useUndercoverConfigSubmitGate(config: UndercoverConfig): ConfigSubmitGate {
  const inventory = useQuery(undercoverInventoryOptions);
  if (!inventory.isSuccess) {
    return {
      isReady: false,
      blockedTitle: '分类尚未就绪',
      blockedMessage: '请等待分类加载完成，或重试读取分类',
    };
  }
  if (
    !inventory.data.hasAnyWords ||
    !isAvailable(config.category, inventory.data.availableCategories)
  ) {
    return {
      isReady: false,
      blockedTitle: '暂无可用词语',
      blockedMessage: '请选择有可用词语的分类，或稍后重试',
    };
  }
  return { isReady: true, blockedTitle: '', blockedMessage: '' };
}
