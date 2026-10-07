/** Render a complete, non-virtualized album for portable image capture after all media is ready. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type {
  PictionaryChain,
  PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { RoomDialog } from '@/features/room/components/RoomDialog';
import { captureViewPngBase64 } from '@/features/room/services/captureViewPngBase64';
import { shareImageBase64 } from '@/features/room/services/shareImage';
import { getPictionarySeatDisplayName } from '@/games/pictionary/model/pictionarySelectors';
import { readPictionaryDrawingDataUri } from '@/games/pictionary/services/pictionaryMediaApi';
import { colors, spacing, textStyles } from '@/theme';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

/** Capture one complete album, never a virtualized viewport or a partially loaded image. */
export function PictionaryAlbumExport({
  state,
  chain,
}: {
  readonly state: PictionaryState;
  readonly chain: PictionaryChain;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        onPress={() => setIsOpen(true)}
        icon={<Ionicons name="share-outline" size={20} color={colors.text} />}
      >
        分享本篇画册
      </Button>
      {isOpen && <AlbumExportDialog state={state} chain={chain} onClose={() => setIsOpen(false)} />}
    </>
  );
}

function AlbumExportDialog({
  state,
  chain,
  onClose,
}: {
  readonly state: PictionaryState;
  readonly chain: PictionaryChain;
  readonly onClose: () => void;
}) {
  const ref = useRef<View>(null);
  const [images, setImages] = useState<Readonly<Record<string, string>> | null>(null);
  const [loaded, setLoaded] = useState<readonly string[]>([]);
  const [hasFailed, setHasFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const drawings = chain.entries.filter((entry) => entry.kind === 'drawing');
  useEffect(() => {
    const controller = new AbortController();
    setHasFailed(false);
    setImages(null);
    setLoaded([]);
    const load = async () => {
      const next: Record<string, string> = {};
      for (const entry of chain.entries) {
        if (entry.kind === 'drawing')
          next[entry.id] = await readPictionaryDrawingDataUri(
            state.roomCode,
            entry.id,
            null,
            controller.signal,
          );
      }
      if (!controller.signal.aborted) setImages(next);
    };
    void load().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setHasFailed(true);
      handleError(error, {
        label: '加载画册',
        logger: roomScreenLog,
        alertMessage: '画作加载失败，请重试后再导出。',
      });
    });
    return () => controller.abort();
  }, [attempt, chain, state.roomCode]);
  const isReady =
    images !== null && !hasFailed && drawings.every((entry) => loaded.includes(entry.id));
  const share = async () => {
    setIsSharing(true);
    try {
      await shareImageBase64(
        () => captureViewPngBase64(ref),
        `pictionary-${state.roomCode}-${state.roundNumber}-${chain.originSeat + 1}.png`,
        '你画我猜接龙',
      );
    } catch (error) {
      handleError(error, {
        label: '导出画册',
        logger: roomScreenLog,
        alertMessage: '导出画册失败，请稍后重试。',
      });
    } finally {
      setIsSharing(false);
    }
  };
  return (
    <RoomDialog
      title="画册长图"
      onClose={onClose}
      footer={
        hasFailed ? (
          <Button onPress={() => setAttempt(attempt + 1)}>重新加载画作</Button>
        ) : (
          <Button
            disabled={!isReady || isSharing}
            loading={isSharing}
            onPress={() => void share()}
            icon={<Ionicons name="download-outline" size={20} color={colors.text} />}
          >
            {isReady ? '保存／分享长图' : '正在加载画作'}
          </Button>
        )
      }
    >
      <View
        key={attempt}
        ref={ref}
        collapsable={false}
        style={styles.album}
        testID="pictionary-export-album"
      >
        <Text style={styles.title}>你画我猜接龙</Text>
        <Text style={styles.text}>
          {getPictionarySeatDisplayName(state, chain.originSeat)} 的画册 · 第 {state.roundNumber} 轮
          {state.phase === 'aborted' ? '（未完成，房主中止）' : ''}
        </Text>
        {chain.entries.map((entry, index) => (
          <View key={entry.id} style={styles.entry}>
            <Text style={styles.text}>
              第 {index + 1} 棒 · {getPictionarySeatDisplayName(state, entry.authorSeat)}
            </Text>
            {entry.kind === 'drawing' ? (
              images?.[entry.id] !== undefined && (
                <Image
                  source={{ uri: images[entry.id] }}
                  style={styles.image}
                  resizeMode="contain"
                  accessibilityLabel={`第 ${index + 1} 棒画作`}
                  onLoad={() =>
                    setLoaded((current) =>
                      current.includes(entry.id) ? current : [...current, entry.id],
                    )
                  }
                  onError={() => {
                    setHasFailed(true);
                    roomScreenLog.warn('Pictionary export image decode failed', {
                      entryId: entry.id,
                    });
                  }}
                />
              )
            ) : (
              <Text selectable style={styles.text}>
                {entry.kind === 'text' ? entry.text : '已交空白'}
              </Text>
            )}
          </View>
        ))}
        {chain.entries.length === 0 && <Text style={styles.text}>本册尚无已提交作品</Text>}
      </View>
    </RoomDialog>
  );
}

const styles = StyleSheet.create({
  text: { ...textStyles.body, color: colors.text },
  title: { ...textStyles.subtitle, color: colors.text },
  album: {
    width: '100%',
    padding: spacing.medium,
    gap: spacing.medium,
    backgroundColor: colors.surface,
  },
  entry: { gap: spacing.small },
  image: { width: '100%', aspectRatio: 4 / 3 },
});
