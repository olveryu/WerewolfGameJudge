/**
 * EncyclopediaRolesHeaderActions — 角色段的页头动作（自狼人杀图鉴壳分解）。
 *
 * 能力筛选按钮只在数据源提供 tagCatalog 时出现；搜索按钮恒有。
 * 由绑定层放进分段壳的 segmentHeaderActions['roles']。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors, componentSizes, spacing, withAlpha } from '@/theme';

import type { EncyclopediaRoleSource } from './encyclopediaSource';
import type { EncyclopediaRolesState } from './useEncyclopediaRolesState';

/** 角色段页头动作：能力筛选（可选）+ 搜索。 */
export function EncyclopediaRolesHeaderActions({
  source,
  state,
}: {
  readonly source: EncyclopediaRoleSource;
  readonly state: EncyclopediaRolesState;
}) {
  return (
    <View style={styles.headerRight}>
      {source.tagCatalog && (
        <Button
          variant="icon"
          onPress={() => state.setTagDropdownVisible(true)}
          style={state.activeTag ? styles.headerIconButtonActive : undefined}
          accessibilityLabel="能力筛选"
        >
          <Ionicons
            name="filter"
            size={componentSizes.icon.md}
            color={state.activeTag ? colors.primary : colors.text}
          />
        </Button>
      )}
      <Button variant="icon" onPress={state.toggleSearch} accessibilityLabel="搜索">
        <Ionicons
          name={state.searchVisible ? 'close' : 'search'}
          size={componentSizes.icon.md}
          color={colors.text}
        />
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  headerIconButtonActive: {
    backgroundColor: withAlpha(colors.primary, 0.15),
  },
});
