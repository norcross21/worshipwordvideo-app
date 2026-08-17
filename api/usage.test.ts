import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './usage';

const originalUrl = process.env.VITE_SUPABASE_URL;
const originalKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function usageRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://www.worshipwordvideo.org/api/usage', {
    method: 'POST',
    headers: {
      Origin: 'https://www.worshipwordvideo.org',
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  process.env.VITE_SUPABASE_URL = originalUrl;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalKey;
});

describe('usage analytics endpoint', () => {
  it('rejects cross-origin submissions', async () => {
    const request = usageRequest({
      event_name: 'visit',
      session_id: '10000000-0000-4000-8000-000000000001',
    }, { Origin: 'https://example.com' });

    expect((await POST(request)).status).toBe(403);
  });

  it('rejects unknown event names', async () => {
    const response = await POST(usageRequest({
      event_name: 'video_title_or_other_content',
      session_id: '10000000-0000-4000-8000-000000000001',
    }));

    expect(response.status).toBe(400);
  });

  it('forwards only an allowlisted event and the existing bearer token', async () => {
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'publishable-test-key';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    const response = await POST(usageRequest({
      event_name: 'video_preview',
      session_id: '10000000-0000-4000-8000-000000000001',
    }, { Authorization: 'Bearer signed-in-token' }));

    expect(response.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/rpc/record_app_usage_event',
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'publishable-test-key',
          Authorization: 'Bearer signed-in-token',
        }),
        body: JSON.stringify({
          requested_event_name: 'video_preview',
          requested_session_id: '10000000-0000-4000-8000-000000000001',
        }),
      }),
    );
  });
});
