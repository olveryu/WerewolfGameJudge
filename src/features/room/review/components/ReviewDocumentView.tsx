/**
 * One review page. The in-room dialog and the exported image render this
 * same view, so the two cannot drift; `export` mode adds only the image
 * chrome — the share title, the page position of a multi-page document
 * and rounded corners. The dialog already titles the screen, so only the
 * export receives a share title.
 */

import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, spacing, typography } from '@/theme';

import { REPORT_PALETTE } from '../reportTheme';
import type { RoomReviewDocument } from '../types';
import { ReviewTag } from './ReviewAtoms';
import { ReviewBlockView } from './ReviewBlockView';

export type ReviewDocumentViewProps = {
  readonly document: RoomReviewDocument;
  readonly pageIndex: number;
} & (
  | { readonly mode: 'screen' }
  | {
      readonly mode: 'export';
      /** `formatReviewShareTitle` of the room, printed in the image masthead. */
      readonly shareTitle: string;
    }
);

export function ReviewDocumentView(props: ReviewDocumentViewProps) {
  const { document, pageIndex } = props;
  const page = document.pages[pageIndex];
  if (page === undefined) {
    throw new Error(`[FAIL-FAST] Review ${document.fileStem} has no page ${pageIndex}`);
  }
  const isExport = props.mode === 'export';
  return (
    <View style={[styles.page, isExport ? styles.exportPage : null]}>
      <View style={styles.chrome}>
        <View style={styles.accentBar} />
        <View style={styles.masthead}>
          <View style={styles.mastheadLead}>
            <Text style={styles.kicker}>{document.kicker}</Text>
            {document.isAborted && <ReviewTag text="未完成" tone="out" />}
          </View>
          {props.mode === 'export' && <Text style={styles.mastheadTitle}>{props.shareTitle}</Text>}
        </View>
        {isExport && page.label !== null && (
          <Text style={styles.pageLabel}>
            {`${page.label} · ${pageIndex + 1}/${document.pages.length}`}
          </Text>
        )}
      </View>
      <View style={styles.body}>
        {page.blocks.map((block, index) => (
          <ReviewBlockView key={index} block={block} blockId={`${page.key}/${index}`} />
        ))}
        <Text style={styles.footer}>{document.footer}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: REPORT_PALETTE.background,
  },
  exportPage: {
    borderRadius: borderRadius.xlarge,
    overflow: 'hidden',
  },
  chrome: {
    gap: spacing.medium,
  },
  accentBar: {
    height: spacing.small,
    backgroundColor: REPORT_PALETTE.accent,
  },
  masthead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.small,
    paddingHorizontal: spacing.large,
    paddingTop: spacing.small,
  },
  mastheadLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    flexShrink: 1,
  },
  kicker: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.bold,
    color: REPORT_PALETTE.text,
  },
  mastheadTitle: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
    color: REPORT_PALETTE.textMuted,
  },
  pageLabel: {
    paddingHorizontal: spacing.large,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: REPORT_PALETTE.textMuted,
  },
  body: {
    paddingHorizontal: spacing.large,
    paddingTop: spacing.medium,
    paddingBottom: spacing.large,
    gap: spacing.medium,
  },
  footer: {
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    color: REPORT_PALETTE.textFaint,
    textAlign: 'center',
  },
});
