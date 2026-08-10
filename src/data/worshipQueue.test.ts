import { describe, expect, it } from 'vitest';
import {
  addToWorshipQueue,
  formatPlaybackTime,
  moveWorshipQueueItem,
  nextWorshipQueueIndex,
  parsePlaybackTime,
  playbackTimingError,
  type WorshipQueueItem,
} from './worshipQueue';

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

  it('accepts seconds, minutes and hours for clean playback points', () => {
    expect(parsePlaybackTime('26')).toBe(26);
    expect(parsePlaybackTime('0:26')).toBe(26);
    expect(parsePlaybackTime('1:02:03')).toBe(3723);
    expect(parsePlaybackTime('1:75')).toBeUndefined();
    expect(formatPlaybackTime(238)).toBe('3:58');
  });

  it('rejects a stop point before the start or beyond the known video', () => {
    expect(playbackTimingError(26, 20, 240)).toContain('later than the start');
    expect(playbackTimingError(26, 260, 240)).toContain('beyond');
    expect(playbackTimingError(26, 220, 240)).toBe('');
  });

  it('advances through a service and stops cleanly after the final video', () => {
    expect(nextWorshipQueueIndex(0, 3)).toBe(1);
    expect(nextWorshipQueueIndex(1, 3)).toBe(2);
    expect(nextWorshipQueueIndex(2, 3)).toBeNull();
    expect(nextWorshipQueueIndex(null, 3)).toBeNull();
  });
});
