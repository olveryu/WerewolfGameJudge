import { StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../../constants/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 20,
    color: colors.text,
  },
  title: {
    flex: 1,
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  settingLabel: {
    fontSize: typography.base,
    color: colors.text,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  accountLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  accountValue: {
    fontSize: typography.sm,
    color: colors.text,
    fontFamily: 'monospace',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: spacing.xs,
  },
  statusText: {
    fontSize: typography.xs,
    color: colors.success,
  },
  logoutBtn: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  logoutBtnText: {
    fontSize: typography.sm,
    color: colors.error,
    fontWeight: typography.medium,
  },
  notLoggedIn: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  notLoggedInText: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: typography.sm,
    color: colors.text,
  },
  modeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  modeOnline: {
    backgroundColor: colors.success + '20',
  },
  modeDemo: {
    backgroundColor: colors.warning + '20',
  },
  modeText: {
    fontSize: typography.xs,
    color: colors.text,
  },
  
  // Profile section
  profileSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: spacing.sm,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: typography.bold,
    color: '#fff',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatarEditIcon: {
    fontSize: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  userName: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  editIcon: {
    fontSize: 14,
  },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nameInput: {
    flex: 1,
    height: 40,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    fontSize: typography.base,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  cancelBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontSize: typography.sm,
  },
  
  // Auth form
  authForm: {
    paddingVertical: spacing.md,
  },
  authTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  input: {
    height: 48,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.base,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  authBtn: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  authBtnDisabled: {
    opacity: 0.6,
  },
  authBtnText: {
    color: '#fff',
    fontSize: typography.base,
    fontWeight: typography.semibold,
  },
  switchAuthBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  switchAuthText: {
    color: colors.primary,
    fontSize: typography.sm,
  },
  cancelAuthBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  cancelAuthText: {
    color: colors.textSecondary,
    fontSize: typography.sm,
  },
  
  // Auth options (not logged in)
  authOptions: {
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  authOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  authOptionBtnSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  authOptionIcon: {
    fontSize: 20,
  },
  authOptionText: {
    color: '#fff',
    fontSize: typography.base,
    fontWeight: typography.medium,
  },
  authOptionTextSecondary: {
    color: colors.text,
    fontSize: typography.base,
    fontWeight: typography.medium,
  },
});
