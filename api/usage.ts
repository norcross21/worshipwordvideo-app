const USAGE_EVENTS = new Set([
  'visit',
  'search',
  'language_filter',
  'video_preview',
  'playlist_add',
  'projection_open',
  'service_create',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: Record<string, string>, status: number): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Forbidden' }, 403);

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > 1024) return jsonResponse({ error: 'Request too large' }, 413);

  let payload: { event_name?: unknown; session_id?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (typeof payload.event_name !== 'string' || !USAGE_EVENTS.has(payload.event_name)) {
    return jsonResponse({ error: 'Unsupported event' }, 400);
  }
  if (typeof payload.session_id !== 'string' || !UUID_PATTERN.test(payload.session_id)) {
    return jsonResponse({ error: 'Invalid session' }, 400);
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !publishableKey) {
    console.error('Usage analytics is missing its Supabase environment configuration.');
    return jsonResponse({ error: 'Analytics unavailable' }, 503);
  }

  const clientAuthorization = request.headers.get('authorization');
  const authorization = clientAuthorization?.startsWith('Bearer ')
    ? clientAuthorization
    : `Bearer ${publishableKey}`;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/record_app_usage_event`, {
      method: 'POST',
      headers: {
        apikey: publishableKey,
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requested_event_name: payload.event_name,
        requested_session_id: payload.session_id,
      }),
    });

    if (!response.ok) {
      console.error(`Supabase rejected a usage event with status ${response.status}.`);
      return jsonResponse({ error: 'Analytics delivery failed' }, 502);
    }
    return new Response(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown network error';
    console.error(`Usage analytics delivery failed: ${reason}`);
    return jsonResponse({ error: 'Analytics delivery failed' }, 502);
  }
}
