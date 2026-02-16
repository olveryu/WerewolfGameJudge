import type { VercelRequest, VercelResponse } from '@vercel/node';

import { handleCors } from './_lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  return res.status(200).json({
    ok: true,
    env: {
      hasUrl: !!process.env.SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    node: process.version,
  });
}
