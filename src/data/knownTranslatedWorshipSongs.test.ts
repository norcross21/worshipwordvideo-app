import { describe, expect, it } from 'vitest';
import { KNOWN_TRANSLATED_COUNTS, KNOWN_TRANSLATED_WORSHIP_SONGS } from './knownTranslatedWorshipSongs';

describe('familiar translated worship collection', () => {
  it('adds a substantial source-checked collection across every international language group', () => {
    expect(KNOWN_TRANSLATED_WORSHIP_SONGS.length).toBeGreaterThanOrEqual(240);
    expect(KNOWN_TRANSLATED_COUNTS.languages).toBe(29);
    expect(KNOWN_TRANSLATED_COUNTS.familiarSongs).toBe(5);
  });

  it('keeps the familiar English song identity searchable', () => {
    const titles = new Set(KNOWN_TRANSLATED_WORSHIP_SONGS.map((song) => song.englishTitle));
    expect(titles).toEqual(new Set([
      'Goodness of God',
      'Way Maker',
      'The Blessing',
      'What a Beautiful Name',
      'Oceans Where Feet May Fail',
    ]));
  });

  it('has unique checked video links and complete provenance', () => {
    const ids = KNOWN_TRANSLATED_WORSHIP_SONGS.map((song) => song.youtubeId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const song of KNOWN_TRANSLATED_WORSHIP_SONGS) {
      expect(song.youtubeId).toMatch(/^[A-Za-z0-9_-]{11}$/);
      expect(song.sourceChannel).toBeTruthy();
      expect(song.language).toBeTruthy();
      expect(song.region).toBeTruthy();
      expect(song.englishTitle).toBeTruthy();
      expect(song.catalogueReview).toBe('Metadata and embed checked');
    }
  });

  it('preserves the uploader word or subtitle signal used by catalogue quality checks', () => {
    const wordVideos = KNOWN_TRANSLATED_WORSHIP_SONGS.filter((song) => song.wordsIndicated);
    expect(wordVideos.length).toBeGreaterThan(50);
    expect(wordVideos.every((song) => song.wordEvidence)).toBe(true);
  });
});
