import { describe, it, expect } from 'vitest';
import { supabase } from './supabase';
import { getWorshipQueue, addToWorshipQueue, worshipQueueItem } from '../data/worshipQueue';

describe('Legacy Supabase client and public playlist integration', () => {
  it('should initialize Supabase client with environment variables', () => {
    expect(supabase).not.toBeNull();
  });

  it('starts with an empty public playlist when this browser has no saved queue', () => {
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
