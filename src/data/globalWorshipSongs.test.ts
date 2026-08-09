import { describe, expect, it } from 'vitest';
import { GLOBAL_CATALOGUE_COUNTS, GLOBAL_LANGUAGE_FILTERS, GLOBAL_WORSHIP_SONGS } from './globalWorshipSongs';

describe('global worship discovery catalogue', () => {
  it('contains at least 1,000 available multilingual videos', () => {
    expect(GLOBAL_WORSHIP_SONGS.length).toBeGreaterThanOrEqual(1000);
    expect(GLOBAL_CATALOGUE_COUNTS.total).toBe(GLOBAL_WORSHIP_SONGS.length);
  });

  it('covers a wide range of church language communities', () => {
    expect(GLOBAL_LANGUAGE_FILTERS.length).toBeGreaterThanOrEqual(25);
    expect(GLOBAL_LANGUAGE_FILTERS).toEqual(expect.arrayContaining([
      'Arabic', 'Bengali', 'French', 'Hindi', 'Korean', 'Mandarin Chinese',
      'Portuguese', 'Spanish', 'Swahili', 'Tamil', 'Urdu', 'Vietnamese', 'Yoruba',
    ]));
  });

  it('has unique, well-formed, source-labelled entries', () => {
    const ids = GLOBAL_WORSHIP_SONGS.map((song) => song.youtubeId);
    expect(new Set(ids).size).toBe(ids.length);

    for (const song of GLOBAL_WORSHIP_SONGS) {
      expect(song.youtubeId).toMatch(/^[A-Za-z0-9_-]{11}$/);
      expect(song.title.trim().length).toBeGreaterThan(2);
      expect(song.sourceChannel?.trim().length).toBeGreaterThan(1);
      expect(song.language?.trim().length).toBeGreaterThan(1);
      expect(song.region?.trim().length).toBeGreaterThan(1);
      expect(song.durationSeconds).toBeGreaterThanOrEqual(120);
      expect(song.durationSeconds).toBeLessThanOrEqual(900);
      expect(song.catalogueReview).toBe('Metadata and embed checked');
    }
  });
});
