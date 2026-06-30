/**
 * FibSeatCell — one seat in the fibking room grid (thin shell, composes shared components).
 *
 * Composes AvatarWithFrame + NameStyleText (no SeatTile coupling). Shows the guesser badge
 * publicly; honest/fibber roles only when revealed.
 */
import type { FibRole, FibSeat } from '@werewolf/game-engine/fibking/types';
import type { RosterEntry } from '@werewolf/game-engine/protocol/common';
import type React from 'react';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarWithFrame } from '@/components/AvatarWithFrame';
import { NameStyleText } from '@/components/nameStyles/NameStyleText';
import { borderRadius, colors, spacing, typography } from '@/theme';

interface FibSeatCellProps {
  /** 0-based seat index. */
  seat: number;
  occupant: FibSeat | null;
  roster?: RosterEntry;
  role?: FibRole;
  /** Revealed phase → show every role; otherwise only guesser is public. */
  revealed: boolean;
  isMe: boolean;
  onPress: () => void;
}

const ROLE_LABEL: Record<FibRole, string> = {
  guesser: '大聪明 🔍',
  honest: '老实人 ✅',
  fibber: '瞎掰王 🤥',
};

const FibSeatCellComponent: React.FC<FibSeatCellProps> = ({
  seat,
  occupant,
  roster,
  role,
  revealed,
  isMe,
  onPress,
}) => {
  const showRole = role !== undefined && (revealed || role === 'guesser');

  return (
    <Pressable style={styles.cell} onPress={onPress} testID={`fib-seat-${seat}`}>
      {occupant ? (
        <>
          <AvatarWithFrame
            value={occupant.userId}
            size={48}
            avatarUrl={roster?.avatarUrl}
            frameId={roster?.avatarFrame}
          />
          <NameStyleText styleId={roster?.nameStyle} style={styles.name} numberOfLines={1}>
            {roster?.displayName ?? ''}
          </NameStyleText>
          {showRole && role ? <Text style={styles.role}>{ROLE_LABEL[role]}</Text> : null}
          {isMe ? <Text style={styles.me}>你</Text> : null}
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.plus}>＋</Text>
        </View>
      )}
      <Text style={styles.seatNo}>{seat + 1}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  cell: {
    width: 92,
    alignItems: 'center',
    paddingVertical: spacing.small,
    gap: spacing.tight,
  },
  empty: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: { fontSize: typography.title, color: colors.textMuted },
  name: { fontSize: typography.caption, color: colors.text, maxWidth: 88 },
  role: { fontSize: typography.captionSmall, color: colors.primary },
  me: { fontSize: typography.captionSmall, color: colors.success },
  seatNo: { fontSize: typography.captionSmall, color: colors.textMuted },
});

export const FibSeatCell = memo(FibSeatCellComponent);
