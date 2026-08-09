import { describe, expect, it } from 'vitest';
import { FARSI_CATALOGUE_COUNTS, FARSI_WORSHIP_SONGS } from './farsiWorshipSongs';

describe('Farsi worship catalogue', () => {
  it('contains the researched vocal and translation collections', () => {
    expect(FARSI_CATALOGUE_COUNTS).toEqual({
      total: 140,
      vocal: 101,
      translationResources: 39,
    });
  });

  it('has valid, unique YouTube IDs and an English title for every entry', () => {
    const videoIds = FARSI_WORSHIP_SONGS.map((song) => song.youtubeId);
    expect(new Set(videoIds).size).toBe(videoIds.length);
    expect(videoIds.every((id) => /^[A-Za-z0-9_-]{11}$/.test(id))).toBe(true);
    expect(FARSI_WORSHIP_SONGS.every((song) => song.englishTitle?.trim())).toBe(true);
    expect(FARSI_WORSHIP_SONGS.every((song) => song.languageCode === 'fa')).toBe(true);
  });
});
