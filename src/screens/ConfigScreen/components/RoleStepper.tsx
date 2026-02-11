/**
 * RoleStepper - 角色数量步进器（Memoized）
 *
 * 用于普通狼人/村民等批量角色的 [-] count [+] 控件。
 *
 * ✅ 允许：渲染 UI + 上报 onCountChange
 * ❌ 禁止：import service / 业务逻辑判断
 */
import { memo, useCallback } from 'react';
import { Text, TouchableOpacity,View } from 'react-native';

import { ConfigScreenStyles } from './styles';

export interface RoleStepperProps {
  roleId: string;
  label: string;
  count: number;
  maxCount: number;
  onCountChange: (roleId: string, newCount: number) => void;
  styles: ConfigScreenStyles;
  accentColor: string;
}

export const RoleStepper = memo<RoleStepperProps>(
  ({ roleId, label, count, maxCount, onCountChange, styles, accentColor }) => {
    const handleDecrement = useCallback(() => {
      if (count > 0) onCountChange(roleId, count - 1);
    }, [roleId, count, onCountChange]);

    const handleIncrement = useCallback(() => {
      if (count < maxCount) onCountChange(roleId, count + 1);
    }, [roleId, count, maxCount, onCountChange]);

    return (
      <View style={styles.stepperRow}>
        <Text style={styles.stepperLabel}>{label}</Text>
        <View style={[styles.stepperPill, count > 0 && { borderColor: accentColor + '40' }]}>
          <View style={styles.stepperControls}>
            <TouchableOpacity
              testID={`config-stepper-dec-${roleId}`}
              style={[styles.stepperBtn, count <= 0 && styles.stepperBtnDisabled]}
              onPress={handleDecrement}
              activeOpacity={count <= 0 ? 1 : 0.6}
              accessibilityState={{ disabled: count <= 0 }}
            >
              <Text
                style={[
                  styles.stepperBtnText,
                  { color: accentColor },
                  count <= 0 && styles.stepperBtnTextDisabled,
                ]}
              >
                −
              </Text>
            </TouchableOpacity>
            <Text style={[styles.stepperCount, { color: count > 0 ? accentColor : undefined }]}>
              {count}
            </Text>
            <TouchableOpacity
              testID={`config-stepper-inc-${roleId}`}
              style={[styles.stepperBtn, count >= maxCount && styles.stepperBtnDisabled]}
              onPress={handleIncrement}
              activeOpacity={count >= maxCount ? 1 : 0.6}
              accessibilityState={{ disabled: count >= maxCount }}
            >
              <Text
                style={[
                  styles.stepperBtnText,
                  { color: accentColor },
                  count >= maxCount && styles.stepperBtnTextDisabled,
                ]}
              >
                +
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  },
);

RoleStepper.displayName = 'RoleStepper';
