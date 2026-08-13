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

/**
 * Records a deliberately small, content-free event. Search terms, video IDs,
 * playlist names and IP addresses are never sent by the app.
 */
export function recordUsageEvent(eventName: UsageEventName, oncePerSessionKey?: string): void {
  if (!supabase) return;
  const dedupeKey = oncePerSessionKey ? `${eventName}:${oncePerSessionKey}` : '';
  if (dedupeKey && sessionEvents.has(dedupeKey)) return;
  if (dedupeKey) sessionEvents.add(dedupeKey);
  void supabase.rpc('record_app_usage_event', {
    requested_event_name: eventName,
    requested_session_id: pageSessionId,
  });
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
