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
    expect(isUsableWorshipVideoListing({
      id: 'secular-title',
      title: 'God Gave Me You (Lyrics)',
      artist: 'Country lyrics channel',
      category: 'Contemporary Worship',
      youtubeId: 'qrstuvwxyz0',
      wordsIndicated: true,
    })).toBe(false);
    expect(isUsableWorshipVideoListing({
      id: 'non-christian-title',
      title: 'Allah Loves Praise with Lyrics',
      artist: 'Religious music channel',
      category: 'Contemporary Worship',
      youtubeId: 'rstuvwxyz01',
      wordsIndicated: true,
    })).toBe(false);
    expect(isUsableWorshipVideoListing({
      id: 'description-only-words',
      title: 'Wonderful Merciful Saviour — lyrics in description',
      artist: 'Example church',
      category: 'Contemporary Worship',
      youtubeId: 'stuvwxyz012',
      wordsIndicated: true,
    })).toBe(false);
    expect(isUsableWorshipVideoListing({
      id: 'ai-cover',
      title: 'New worship song — AI cover lyrics',
      artist: 'Example worship channel',
      category: 'Contemporary Worship',
      youtubeId: 'tuvwxyz0123',
      wordsIndicated: true,
    })).toBe(false);
    expect(isUsableWorshipVideoListing({
      id: 'lds-source',
      title: 'Peace in Christ — sing along lyrics',
      artist: 'EFY Karaoke',
      category: 'Contemporary Worship',
      youtubeId: 'uvwxyz01234',
      wordsIndicated: true,
    })).toBe(false);
  });

  it.each([
    ["Drake - God's Plan (Lyrics)", 'Premier Lyrics'],
    ['Hozier - Take Me To Church (Lyrics)', 'Unique Sound'],
    ['Ghost - Mary On A Cross (Official Lyric Video)', 'Ghost'],
    ['Christian Nodal - Adiós Amor (Official Lyric Video)', 'ChristianNodalVEVO'],
    ['Morgan Wallen - Man Made A Bar (Lyric Video) ft. Eric Church', 'MorganWallenVEVO'],
  ])('rejects secular false matches: %s', (title, artist) => {
    expect(isUsableWorshipVideoListing({
      id: `secular-${artist}`,
      title,
      artist,
      category: 'Contemporary Worship',
      youtubeId: 'vwxyz012345',
      wordsIndicated: true,
    })).toBe(false);
  });
});
