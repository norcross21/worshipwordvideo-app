import { describe, it, expect } from 'vitest';
import { supabase } from './supabase';
import { getWorshipQueue, addToWorshipQueue, worshipQueueItem } from '../data/worshipQueue';

describe('Supabase Auth & Cloud Playlist Integration', () => {
  it('should initialize Supabase client with environment variables', () => {
    expect(supabase).not.toBeNull();
  });

  it('keeps the playlist empty until a member is identified', () => {
    const queue = getWorshipQueue();
    expect(queue).toEqual([]);

    const item = worshipQueueItem({
      id: 'test-1',
      title: 'Amazing Grace',
      artist: 'John Newton',
      youtubeId: 'Jbe7OruLk8I',
    });

    const nextQueue = addToWorshipQueue(queue, item);
    expect(nextQueue).toHaveLength(1);
    expect(nextQueue[0].title).toBe('Amazing Grace');
  });
});
