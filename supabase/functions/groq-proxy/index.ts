/**
 * groq-proxy - Supabase Edge Function
 *
 * 透明代理 Groq API，服务端注入 API key，避免客户端暴露。
 * 支持普通请求和 SSE 流式响应。
 *
 * 部署: supabase functions deploy groq-proxy
 * 密钥: supabase secrets set GROQ_API_KEY=gsk_...
 */

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const groqApiKey = Deno.env.get('GROQ_API_KEY');
  if (!groqApiKey) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  try {
    const body = await req.json();

    // 输入白名单：固定模型 + 限制 max_tokens，防止客户端覆写模型/参数（成本攻击）
    const ALLOWED_MODEL = 'gemma2-9b-it';
    const MAX_ALLOWED_TOKENS = 2048;
    const sanitizedBody = {
      model: ALLOWED_MODEL,
      messages: Array.isArray(body.messages) ? body.messages : [],
      stream: !!body.stream,
      max_tokens: Math.min(
        typeof body.max_tokens === 'number' && body.max_tokens > 0
          ? body.max_tokens
          : MAX_ALLOWED_TOKENS,
        MAX_ALLOWED_TOKENS,
      ),
      temperature:
        typeof body.temperature === 'number'
          ? Math.min(Math.max(body.temperature, 0), 2)
          : undefined,
    };

    const groqResponse = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify(sanitizedBody),
    });

    // Streaming: forward SSE response as-is
    if (sanitizedBody.stream) {
      return new Response(groqResponse.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        status: groqResponse.status,
      });
    }

    // Non-streaming: forward JSON response
    const data = await groqResponse.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: groqResponse.status,
    });
  } catch (error) {
    console.error('[groq-proxy] Unhandled error:', error);
    // Return generic error to client — never expose internal error details.
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
