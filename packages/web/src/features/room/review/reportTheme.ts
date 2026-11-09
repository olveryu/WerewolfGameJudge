/**
 * Report theme — the one visual language of every game's review page. Colors live in
 * review.css (tone → text / swatch / accent, total over `ReviewTone`); this module holds
 * the export size limit.
 */
import { SEGMENTED_CAPTURE_BAND_HEIGHT_PX } from '@/features/room/services/captureElementPng';

/**
 * Tallest page the export accepts, in CSS pixels. A game splits long
 * content into pages by meaning (one album per page); a page beyond this
 * is a document construction error, not something the export slices.
 */
export const REVIEW_PAGE_MAX_HEIGHT = SEGMENTED_CAPTURE_BAND_HEIGHT_PX * 8;
