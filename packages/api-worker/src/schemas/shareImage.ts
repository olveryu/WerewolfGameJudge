/** Zod schemas for /share/* endpoints */

import { z } from 'zod';

/** Max base64 payload ~3MB (decodes to ~2.25MB) */
const MAX_BASE64_LENGTH = 4 * 1024 * 1024;

/** POST /share/image */
export const shareImageUploadSchema = z.object({
  base64: z.string().min(1).max(MAX_BASE64_LENGTH),
});
