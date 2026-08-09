import { describe, expect, it } from 'vitest';
import {
  EXPANDED_WORD_COUNTS,
  EXPANDED_WORD_LANGUAGE_FILTERS,
  EXPANDED_WORD_VIDEO_EVIDENCE,
  EXPANDED_WORD_VIDEO_IDS,
  EXPANDED_WORD_WORSHIP_SONGS,
} from './expandedWordWorshipSongs';

describe('expanded international word-video collection', () => {
  it('ships the checked expansion at the researched size', () => {
    expect(EXPANDED_WORD_COUNTS.total).toBe(5_548);
    expect(EXPANDED_WORD_COUNTS.familiar).toBe(2_202);
    expect(EXPANDED_WORD_COUNTS.native).toBe(3_346);
    expect(EXPANDED_WORD_COUNTS.languages).toBe(78);
    expect(EXPANDED_WORD_COUNTS.familiarSongs).toBe(232);
    expect(EXPANDED_WORD_WORSHIP_SONGS).toHaveLength(5_548);
  });

  it('uses exact unique YouTube IDs and source metadata', () => {
    expect(EXPANDED_WORD_VIDEO_IDS.size).toBe(EXPANDED_WORD_VIDEO_EVIDENCE.length);
    for (const video of EXPANDED_WORD_VIDEO_EVIDENCE) {
      expect(video.youtubeId).toMatch(/^[A-Za-z0-9_-]{11}$/);
      expect(video.sourceTitle.length).toBeGreaterThan(3);
      expect(video.sourceChannel.length).toBeGreaterThan(0);
      expect(video.wordEvidence.length).toBeGreaterThan(2);
      expect(video.durationSeconds).toBeGreaterThanOrEqual(120);
      expect(video.durationSeconds).toBeLessThanOrEqual(900);
      expect(video.checkedOn).toBe('2026-08-09');
    }
  });

  it('adds broad language coverage without duplicate filter labels', () => {
    expect(new Set(EXPANDED_WORD_LANGUAGE_FILTERS).size).toBe(78);
    expect(EXPANDED_WORD_LANGUAGE_FILTERS).toEqual([...EXPANDED_WORD_LANGUAGE_FILTERS].sort((a, b) => a.localeCompare(b)));
    expect(EXPANDED_WORD_LANGUAGE_FILTERS).toContain('Arabic');
    expect(EXPANDED_WORD_LANGUAGE_FILTERS).toContain('Khmer');
    expect(EXPANDED_WORD_LANGUAGE_FILTERS).toContain('Māori');
    expect(EXPANDED_WORD_LANGUAGE_FILTERS).toContain('Zulu');
  });
});
