import { describe, expect, it } from 'vitest';
import { addToWorshipQueue, moveWorshipQueueItem, type WorshipQueueItem } from './worshipQueue';

const item = (number: number): WorshipQueueItem => ({
  id: `song-${number}`,
  title: `Song ${number}`,
  artist: 'Artist',
  youtubeId: `video0000${number}`,
});

describe('worship queue', () => {
  it('limits the queue to ten unique videos', () => {
    const queue = Array.from({ length: 10 }, (_, index) => item(index));
    expect(addToWorshipQueue(queue, item(10))).toHaveLength(10);
    expect(addToWorshipQueue(queue, item(2))).toEqual(queue);
  });

  it('moves a song without mutating the original queue', () => {
    const queue = [item(1), item(2), item(3)];
    expect(moveWorshipQueueItem(queue, 1, -1).map((entry) => entry.id)).toEqual(['song-2', 'song-1', 'song-3']);
    expect(queue.map((entry) => entry.id)).toEqual(['song-1', 'song-2', 'song-3']);
  });
});
