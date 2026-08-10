import { describe, expect, it } from 'vitest';
import {
  RESEARCHED_WORD_COUNTS,
  RESEARCHED_WORD_VIDEO_IDS,
  RESEARCHED_WORD_WORSHIP_SONGS,
} from './researchedWordWorshipSongs';

describe('researched worship word videos', () => {
  it('adds a large, uniquely linked, metadata-checked expansion', () => {
    expect(RESEARCHED_WORD_COUNTS.total).toBeGreaterThanOrEqual(25_000);
    expect(RESEARCHED_WORD_VIDEO_IDS.size).toBe(RESEARCHED_WORD_WORSHIP_SONGS.length);
    expect(RESEARCHED_WORD_COUNTS.languages).toBeGreaterThanOrEqual(100);
  });

  it('retains exact source evidence and clear format labels', () => {
    for (const song of RESEARCHED_WORD_WORSHIP_SONGS) {
      expect(song.youtubeId).toMatch(/^[A-Za-z0-9_-]{11}$/);
      expect(song.title.trim().length).toBeGreaterThan(3);
      expect(song.sourceChannel?.trim().length).toBeGreaterThan(0);
      expect(song.wordEvidence?.trim().length).toBeGreaterThan(2);
      expect(song.qualityCheckedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const reviewedAt = Date.parse(`${song.qualityCheckedOn}T00:00:00Z`);
      expect(Number.isNaN(reviewedAt)).toBe(false);
      expect(reviewedAt).toBeLessThanOrEqual(Date.now());
      expect(song.arrangement).toBeTruthy();
      expect(song.languagePresentation).toBeTruthy();
    }
  });
});
