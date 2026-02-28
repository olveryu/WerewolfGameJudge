/**
 * CORS Headers for Edge Functions
 *
 * Edge Function URL 是跨域的（*.supabase.co vs 前端域名），
 * 所有响应需要 CORS headers。与 groq-proxy 中的 CORS 处理方式一致。
 * 仅包含 CORS 常量与 preflight helper，不包含业务逻辑。
 */

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Build a JSON Response with CORS headers */
export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
