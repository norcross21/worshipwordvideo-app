import { describe, expect, it } from 'vitest';
import type { WorshipSong } from './worshipSongs';
import { firstPlayableSong } from './songSelection';

const song = (id: string, youtubeId = ''): WorshipSong => ({
  id,
  title: `Song ${id}`,
  artist: 'Test artist',
  youtubeId,
  category: 'Contemporary Worship',
});

describe('firstPlayableSong', () => {
  it('selects the first playable video in a newly filtered list', () => {
    const playable = song('playable', 'abcdefghijk');
    expect(firstPlayableSong([song('unlinked'), playable, song('later', '12345678901')])).toBe(playable);
  });

  it('falls back to the first listing when none has a video', () => {
    const first = song('first');
    expect(firstPlayableSong([first, song('second')])).toBe(first);
  });

  it('returns null for an empty result list', () => {
    expect(firstPlayableSong([])).toBeNull();
  });
});
