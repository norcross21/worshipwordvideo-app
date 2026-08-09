import { describe, expect, it } from 'vitest';
import {
  MODERN_WORD_COUNTS,
  MODERN_WORD_VIDEO_EVIDENCE,
  MODERN_WORD_VIDEO_IDS,
  MODERN_WORD_WORSHIP_SONGS,
} from './modernWordWorshipSongs';

describe('modern multilingual word-video collection', () => {
  it('contains a large, deduplicated and source-checked collection', () => {
    expect(MODERN_WORD_COUNTS.evidenceVideos).toBe(599);
    expect(MODERN_WORD_COUNTS.newVideos).toBe(496);
    expect(MODERN_WORD_COUNTS.languages).toBe(20);
    expect(MODERN_WORD_COUNTS.familiarSongs).toBe(55);
    expect(MODERN_WORD_VIDEO_IDS.size).toBe(MODERN_WORD_VIDEO_EVIDENCE.length);
  });

  it('keeps exact source metadata and review evidence for every video', () => {
    for (const video of MODERN_WORD_VIDEO_EVIDENCE) {
      expect(video.youtubeId).toMatch(/^[A-Za-z0-9_-]{11}$/);
      expect(video.sourceTitle.length).toBeGreaterThan(3);
      expect(video.sourceChannel.length).toBeGreaterThan(0);
      expect(video.wordEvidence.length).toBeGreaterThan(2);
      expect(video.durationSeconds).toBeGreaterThanOrEqual(120);
      expect(video.durationSeconds).toBeLessThanOrEqual(900);
      expect(video.checkedOn).toBe('2026-08-08');
    }
  });

  it('does not duplicate the 103 matching videos already in the catalogue', () => {
    expect(MODERN_WORD_VIDEO_EVIDENCE.filter((video) => video.alreadyInCatalogue)).toHaveLength(103);
    expect(MODERN_WORD_WORSHIP_SONGS).toHaveLength(496);
  });

  it('requires Portuguese word or subtitle evidence in the uploader title', () => {
    const portuguese = MODERN_WORD_VIDEO_EVIDENCE.filter((video) => video.language === 'Portuguese');
    expect(portuguese).toHaveLength(85);
    for (const video of portuguese) {
      expect(video.sourceTitle).toMatch(/lyrics?|letras?|legendad[ao]|tradu[cç][aã]o|subtitulado/iu);
    }
  });
});
