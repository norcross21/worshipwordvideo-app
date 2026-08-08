import { describe, it, expect } from 'vitest';
import { supabase } from './supabase';
import { getWorshipQueue, addToWorshipQueue, worshipQueueItem } from '../data/worshipQueue';

describe('Supabase Auth & Cloud Playlist Integration', () => {
  it('should initialize Supabase client with environment variables', () => {
    expect(supabase).not.toBeNull();
  });

  it('should support local guest queue fallback when unauthenticated', () => {
    const queue = getWorshipQueue();
    expect(Array.isArray(queue)).toBe(true);

    const item = worshipQueueItem({
      id: 'test-1',
      title: 'Amazing Grace',
      artist: 'John Newton',
      youtubeId: 'Jbe7OruLk8I',
    });

    const nextQueue = addToWorshipQueue(queue, item);
    expect(nextQueue.length).toBeGreaterThan(0);
    expect(nextQueue[0].title).toBe('Amazing Grace');
  });
});
