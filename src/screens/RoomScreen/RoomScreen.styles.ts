import { StyleSheet, Dimensions } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';

const GRID_COLUMNS = 4;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const TILE_SIZE = (SCREEN_WIDTH - 48) / GRID_COLUMNS;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  loadingSubtext: {
    marginTop: spacing.sm,
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  errorBackButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  errorBackButtonText: {
    color: '#FFFFFF',
    fontSize: typography.base,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: typography.base,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
  },
  headerSpacer: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  tileWrapper: {
    width: TILE_SIZE,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  playerName: {
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
    marginTop: 4,
    width: TILE_SIZE - 8,
  },
  playerTile: {
    width: TILE_SIZE - 8,
    height: TILE_SIZE - 8,
    margin: 4,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  seatedTile: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  mySpotTile: {
    borderColor: colors.success,
    borderWidth: 3,
  },
  wolfTile: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  selectedTile: {
    backgroundColor: '#E91E63',
    borderColor: '#E91E63',
  },
  seatNumber: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.textMuted,
    position: 'absolute',
    top: 8,
    left: 12,
  },
  seatedSeatNumber: {
    color: '#FFFFFF',
  },
  playerIndicator: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  playerAvatar: {
    fontSize: 36,
  },
  avatarContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: borderRadius.lg,
  },
  wolfOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: borderRadius.lg,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(233, 30, 99, 0.4)',
    borderRadius: borderRadius.lg,
  },
  mySeatBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: colors.success,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  emptyIndicator: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  mySeatIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    fontSize: typography.base,
  },
  actionMessage: {
    textAlign: 'center',
    fontSize: typography.base,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  actionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  disabledButton: {
    backgroundColor: colors.textMuted,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: typography.sm,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    minWidth: 300,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalMessage: {
    fontSize: typography.base,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    minWidth: 100,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalConfirmButton: {
    backgroundColor: colors.primary,
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontSize: typography.base,
    fontWeight: '600',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: typography.base,
    fontWeight: '600',
  },
  // Board Info styles
  boardInfoContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  boardInfoTitle: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  boardInfoContent: {
    gap: spacing.xs,
  },
  roleCategory: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  roleCategoryLabel: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    width: 70,
  },
  roleCategoryText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.text,
    lineHeight: 20,
  },
  notViewedText: {
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  actionLogContainer: {
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionLogTitle: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  actionLogItem: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    paddingVertical: 2,
  },
  // Connection Status Bar styles
  connectionStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  connectionStatusLive: {
    backgroundColor: '#E8F5E9',
  },
  connectionStatusSyncing: {
    backgroundColor: '#FFF8E1',
  },
  connectionStatusConnecting: {
    backgroundColor: '#E3F2FD',
  },
  connectionStatusDisconnected: {
    backgroundColor: '#FFEBEE',
  },
  connectionStatusText: {
    fontSize: typography.sm,
    color: colors.text,
    fontWeight: '500',
  },
  forceSyncButton: {
    marginLeft: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
  },
  forceSyncButtonText: {
    fontSize: typography.sm,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
