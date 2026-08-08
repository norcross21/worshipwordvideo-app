import { describe, expect, it } from 'vitest';
import { assessWorshipVideo, formatVideoDuration, titleMatchScore } from './videoQuality';

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
});
