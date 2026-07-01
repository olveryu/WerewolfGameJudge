/**
 * ControlledSeatBanner — shared banner for host bot-seat takeover.
 *
 * Room-like games render this between status and the seat board when host can
 * manually control a bot. The component is display-only; takeover policy stays
 * in the screen/controller layer.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatSeat } from '@werewolf/game-engine/utils/formatSeat';
import type React from 'react';
import { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { UI_ICONS } from '@/config/iconTokens';
import { typography } from '@/theme';

import type { ControlledSeatBannerStyles } from './roomComponentStyles';

interface ControlledSeatBannerBaseProps {
  styles: ControlledSeatBannerStyles;
}

interface ControlledSeatBannerHintProps extends ControlledSeatBannerBaseProps {
  mode: 'hint';
  showBulkViewHint?: boolean;
}

interface ControlledSeatBannerActiveProps extends ControlledSeatBannerBaseProps {
  mode: 'controlled';
  controlledSeat: number;
  botDisplayName: string;
  onRelease: () => void;
}

type ControlledSeatBannerProps = ControlledSeatBannerHintProps | ControlledSeatBannerActiveProps;

const ControlledSeatBannerComponent: React.FC<ControlledSeatBannerProps> = (props) => {
  if (props.mode === 'hint') {
    return (
      <View style={props.styles.hintContainer}>
        <Text style={props.styles.hintText}>
          <Ionicons name={UI_ICONS.HINT} size={typography.secondary} />
          {props.showBulkViewHint
            ? ' 长按座位可接管机器人，右上角菜单可一键查看身份'
            : ' 长按座位可接管机器人'}
        </Text>
      </View>
    );
  }

  return (
    <View style={props.styles.container}>
      <Text style={props.styles.text}>
        <Ionicons name={UI_ICONS.GAMEPAD} size={typography.secondary} />
        {` 正在操控 ${formatSeat(props.controlledSeat)} 位（${props.botDisplayName}）`}
      </Text>
      <TouchableOpacity style={props.styles.releaseButton} onPress={props.onRelease}>
        <Text style={props.styles.releaseButtonText}>退出</Text>
      </TouchableOpacity>
    </View>
  );
};

export const ControlledSeatBanner = memo(ControlledSeatBannerComponent);

ControlledSeatBanner.displayName = 'ControlledSeatBanner';
