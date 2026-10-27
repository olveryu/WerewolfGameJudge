/**
 * Word-category choice backed by the live inventory: the schema supplies the
 * full option list and labels, the inventory decides which are selectable
 * today. Loading and empty inventories render as hints; errors go through the
 * shared error pipeline. Submission is gated by useUndercoverConfigSubmitGate.
 */

import {
  type UndercoverCategory,
  type UndercoverConfig,
} from '@game-judge/game-engine/games/undercover/public';
import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { GameSettingsChoice } from '@/components/GameSettings';
import { gameSettingsStyles as styles } from '@/components/GameSettings.styles';
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

export const UndercoverCategoryField: React.FC<ConfigFieldRendererProps> = ({
  spec,
  value,
  onChange,
  issueMessage,
  testID,
}) => {
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

  const available = inventory.isSuccess ? inventory.data : [];
  const options = spec.options.flatMap((option) =>
    isAvailable(option.value, available) ? [{ value: option.value, label: option.label }] : [],
  );
  const selected = typeof value === 'string' ? value : null;

  return (
    <View testID={testID}>
      {inventory.isPending ? (
        <View style={styles.section}>
          <Text style={styles.label}>{spec.label}</Text>
          <Text style={styles.hint}>正在读取分类</Text>
        </View>
      ) : inventory.isSuccess && inventory.data.length === 0 ? (
        <View style={styles.section}>
          <Text style={styles.label}>{spec.label}</Text>
          <Text style={styles.hint}>暂无可用词语</Text>
        </View>
      ) : (
        <GameSettingsChoice
          title={spec.label}
          hint={spec.hint}
          options={options}
          value={selected}
          onChange={onChange}
          optionTestID={(option) =>
            TESTIDS.gameConfigFieldOption('undercover', 'category', String(option))
          }
          optionAccessibilityLabel={(_option, label) => label}
        />
      )}
      {issueMessage === null ? null : <Text style={styles.issue}>{issueMessage}</Text>}
    </View>
  );
};

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
  if (inventory.data.length === 0 || !isAvailable(config.category, inventory.data)) {
    return {
      isReady: false,
      blockedTitle: '暂无可用词语',
      blockedMessage: '请选择有可用词语的分类，或稍后重试',
    };
  }
  return { isReady: true, blockedTitle: '', blockedMessage: '' };
}
