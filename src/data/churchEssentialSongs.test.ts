import { describe, expect, it } from 'vitest';
import { ARTIST_WORSHIP_SONGS } from './artistWorshipSongs';
import { CHURCH_ESSENTIAL_SONGS } from './churchEssentialSongs';
import { titleMatchScore } from './videoQuality';
import { WORSHIP_VIDEO_AUDIT } from './worshipVideoAudit';

describe('reviewed church essentials', () => {
  it('keeps unique, valid catalogue and video IDs', () => {
    expect(CHURCH_ESSENTIAL_SONGS).toHaveLength(27);
    expect(new Set(CHURCH_ESSENTIAL_SONGS.map((song) => song.id)).size).toBe(CHURCH_ESSENTIAL_SONGS.length);
    expect(new Set(CHURCH_ESSENTIAL_SONGS.map((song) => song.youtubeId)).size).toBe(CHURCH_ESSENTIAL_SONGS.length);
    expect(CHURCH_ESSENTIAL_SONGS.every((song) => /^[A-Za-z0-9_-]{11}$/.test(song.youtubeId))).toBe(true);
  });

  it('links every addition to a recognisably matching YouTube title', () => {
    for (const song of CHURCH_ESSENTIAL_SONGS) {
      const videoTitle = WORSHIP_VIDEO_AUDIT[song.youtubeId]?.title ?? '';
      expect(titleMatchScore(song.title, videoTitle), `${song.title} -> ${videoTitle}`).toBeGreaterThanOrEqual(0.65);
    }
  });

  it('uses a single-song Taize video instead of the former full album', () => {
    const song = ARTIST_WORSHIP_SONGS.find((entry) => entry.id === 'artist-taize-2');
    expect(song?.youtubeId).toBe('ndeCKR9CQjg');
    expect(WORSHIP_VIDEO_AUDIT[song!.youtubeId]?.title).toMatch(/Laudate omnes gentes/i);
  });
});
