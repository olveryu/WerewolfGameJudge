/** Shared controlled-bot banner with a type-honest mode contract. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { UI_ICONS } from '@/config/iconTokens';
import { formatRoomSeat } from '@/features/room/model/RoomSeatDataSource';
import type { RoomControlledSeatModel } from '@/features/room/model/RoomShellModel';
import { typography } from '@/theme';

import type { ControlledSeatBannerStyles } from './styles';

interface ControlledSeatBannerProps {
  readonly model: RoomControlledSeatModel;
  readonly styles: ControlledSeatBannerStyles;
}

const ControlledSeatBannerComponent: React.FC<ControlledSeatBannerProps> = ({ model, styles }) => {
  if (model.kind === 'hint') {
    return (
      <View style={styles.hintContainer}>
        <Text style={styles.hintText}>
          <Ionicons name={UI_ICONS.HINT} size={typography.secondary} />
          {model.showBulkViewHint
            ? ' 长按座位可接管机器人，右上角菜单可一键查看身份'
            : ' 长按座位可接管机器人'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        <Ionicons name={UI_ICONS.GAMEPAD} size={typography.secondary} />
        {` 正在操控 ${formatRoomSeat(model.seat)} 位（${model.displayName}）`}
      </Text>
      <TouchableOpacity style={styles.releaseButton} onPress={model.onRelease}>
        <Text style={styles.releaseButtonText}>退出</Text>
      </TouchableOpacity>
    </View>
  );
};

export const ControlledSeatBanner = memo(ControlledSeatBannerComponent);
ControlledSeatBanner.displayName = 'ControlledSeatBanner';
