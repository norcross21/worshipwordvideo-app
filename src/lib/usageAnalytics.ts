import { supabase } from './supabase';

export type UsageEventName =
  | 'visit'
  | 'search'
  | 'language_filter'
  | 'video_preview'
  | 'playlist_add'
  | 'projection_open'
  | 'service_create';

const pageSessionId = crypto.randomUUID();
const sessionEvents = new Set<string>();
const pendingEvents = new Set<string>();
let accessToken: string | null = null;
let analyticsSuppressed = false;

export interface UsageAnalyticsContext {
  accessToken?: string | null;
  suppressed?: boolean;
}

/**
 * Supplies the already-restored auth context without asking the Supabase auth
 * client for it again. That avoids analytics waiting behind the SDK's auth
 * session lock during application startup.
 */
export function configureUsageAnalytics(context: UsageAnalyticsContext): void {
  accessToken = context.accessToken ?? null;
  analyticsSuppressed = context.suppressed === true;
}

async function sendUsageEvent(eventName: UsageEventName, dedupeKey: string): Promise<void> {
  if (analyticsSuppressed) return;
  if (dedupeKey) pendingEvents.add(dedupeKey);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch('/api/usage/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        event_name: eventName,
        session_id: pageSessionId,
      }),
      keepalive: true,
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`request returned ${response.status}`);
    if (dedupeKey) sessionEvents.add(dedupeKey);
  } catch (error) {
    // Do not permanently suppress an event that failed to reach the database.
    // The message contains no search text, video identifier or account data.
    const reason = error instanceof Error ? error.message : 'unknown delivery error';
    console.warn(`Usage analytics event was not recorded: ${reason}`);
  } finally {
    window.clearTimeout(timeout);
    if (dedupeKey) pendingEvents.delete(dedupeKey);
  }
}

/**
 * Records a deliberately small, content-free event. Search terms, video IDs,
 * playlist names and IP addresses are never sent by the app.
 */
export function recordUsageEvent(eventName: UsageEventName, oncePerSessionKey?: string): void {
  if (analyticsSuppressed) return;
  const dedupeKey = oncePerSessionKey ? `${eventName}:${oncePerSessionKey}` : '';
  if (dedupeKey && (sessionEvents.has(dedupeKey) || pendingEvents.has(dedupeKey))) return;
  void sendUsageEvent(eventName, dedupeKey);
}

export interface UsageMetrics {
  days: number;
  totals: {
    visits: number;
    browser_sessions: number;
    signed_in_sessions: number;
    searches: number;
    language_filters: number;
    video_previews: number;
    playlist_adds: number;
    projection_opens: number;
    services_created: number;
  };
  daily: Array<{
    date: string;
    browser_sessions: number;
    visits: number;
    video_previews: number;
  }>;
}

export async function loadAdminUsageMetrics(days: number): Promise<UsageMetrics> {
  if (!supabase) throw new Error('Usage metrics are unavailable.');
  const { data, error } = await supabase.rpc('get_admin_usage_metrics', { days_back: days });
  if (error) throw error;
  return data as UsageMetrics;
}
