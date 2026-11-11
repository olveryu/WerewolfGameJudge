/**
 * The Appearance and Unlocks pages share almost every module, so one barrel re-exports both.
 * They ship in the start-up entry since v4 D11 removed route lazy-loading.
 */
export { AppearancePage } from '@/routes/appearance/AppearancePage';
export { UnlocksPage } from '@/routes/unlocks/UnlocksPage';
