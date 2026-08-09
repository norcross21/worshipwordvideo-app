import { describe, expect, it } from 'vitest';
import { assessWorshipVideo, formatVideoDuration, isUsableWorshipVideoListing, titleMatchScore } from './videoQuality';

describe('video quality helpers', () => {
  it('matches a song title while ignoring common video words', () => {
    expect(titleMatchScore('O Lord, Hear My Prayer', 'O Lord Hear My Prayer | Taize | Choir with Lyrics')).toBe(1);
  });

  it('scores an unrelated title poorly', () => {
    expect(titleMatchScore('Laudate Omnes Gentes', 'The Best of Taize Full Album')).toBeLessThan(0.5);
  });

  it('formats short and long durations', () => {
    expect(formatVideoDuration(201)).toBe('3:21');
    expect(formatVideoDuration(4404)).toBe('1:13:24');
  });

  it('promotes a manually approved exact video into Strong', () => {
    const result = assessWorshipVideo({ title: 'Goodness of God', youtubeId: '-f4MUUMWMV4' }, true);
    expect(result.level).toBe('strong');
    expect(result.label).toBe('Approved by you');
  });

  it('keeps lyric videos but rejects missing links and spoken-content false positives', () => {
    expect(isUsableWorshipVideoListing({
      id: 'good-lyrics',
      title: 'Goodness of God | Farsi worship with lyrics',
      artist: 'Example worship channel',
      category: 'Contemporary Worship',
      youtubeId: 'abcdefghijk',
      wordsIndicated: true,
    })).toBe(true);
    expect(isUsableWorshipVideoListing({
      id: 'missing-link',
      title: 'Goodness of God',
      artist: 'Example',
      category: 'Contemporary Worship',
      youtubeId: '',
    })).toBe(false);
    expect(isUsableWorshipVideoListing({
      id: 'spoken-content',
      title: 'Christian debate and sermon',
      artist: 'Example ministry',
      category: 'Gospel and spiritual',
      youtubeId: 'lmnopqrstuv',
      wordsIndicated: true,
    })).toBe(false);
    expect(isUsableWorshipVideoListing({
      id: 'spoken-channel',
      title: 'Old hymn with lyrics',
      artist: 'Archive upload',
      sourceChannel: 'Christian Sermons and Audio Books',
      category: 'Traditional hymn',
      youtubeId: 'mnopqrstuvw',
      wordsIndicated: true,
    })).toBe(false);
  });
});
