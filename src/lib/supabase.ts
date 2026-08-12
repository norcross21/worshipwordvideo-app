import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WorshipQueueItem } from '../data/worshipQueue';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ?? import.meta.env.VITE_SUPABASE_ANON_KEY
) as string | undefined;

export const supabase: SupabaseClient | null = url && publishableKey
  ? createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export interface SavedUserPlaylist {
  id: string;
  user_id: string;
  title: string;
  items: WorshipQueueItem[];
  service_date: string | null;
  notes: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberProfile {
  user_id: string;
  email: string | null;
  display_name: string | null;
  church_name: string | null;
  created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  terms_version: string | null;
  terms_accepted_at: string | null;
  account_emails_acknowledged_at: string | null;
  kairos_marketing_opt_in: boolean;
  kairos_marketing_opt_in_at: string | null;
  kairos_marketing_opt_out_at: string | null;
}

export function supabaseErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}
