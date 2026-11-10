/**
 * The Appearance and Unlocks pages ship as one lazy chunk: they share almost every module,
 * and one chunk keeps the start-up entry's preload map to one entry for both (home budget).
 */
export { AppearancePage } from '@/routes/appearance/AppearancePage';
export { UnlocksPage } from '@/routes/unlocks/UnlocksPage';
