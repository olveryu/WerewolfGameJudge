/**
 * gemini-proxy - Supabase Edge Function
 *
 * 透明代理 Gemini API（OpenAI 兼容层），服务端注入 API key，避免客户端暴露。
 * 支持普通请求和 SSE 流式响应。
 *
 * 部署: supabase functions deploy gemini-proxy
 * 密钥: supabase secrets set GEMINI_API_KEY=AIza...
 */

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  try {
    const body = await req.json();

    // Whitelist safe fields — prevent injection of arbitrary Gemini API parameters.
    const MAX_TOKENS_CAP = 4096;
    const sanitizedBody = {
      messages: body.messages,
      model: body.model,
      stream: body.stream,
      ...(body.temperature != null && { temperature: body.temperature }),
      ...(body.max_tokens != null && {
        max_tokens: Math.min(Number(body.max_tokens) || MAX_TOKENS_CAP, MAX_TOKENS_CAP),
      }),
    };

    const geminiResponse = await fetch(`${GEMINI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${geminiApiKey}`,
      },
      body: JSON.stringify(sanitizedBody),
    });

    // Streaming: forward SSE response as-is
    if (sanitizedBody.stream) {
      return new Response(geminiResponse.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        status: geminiResponse.status,
      });
    }

    // Non-streaming: forward JSON response
    const data = await geminiResponse.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: geminiResponse.status,
    });
  } catch (error) {
    console.error('[gemini-proxy] Unhandled error:', error);
    // Return generic error to client — never expose internal error details.
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
