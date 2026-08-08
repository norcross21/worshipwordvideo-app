import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WorshipQueueItem } from '../data/worshipQueue';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && anonKey
  ? createClient(url, anonKey, {
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
  created_at: string;
  updated_at: string;
}
