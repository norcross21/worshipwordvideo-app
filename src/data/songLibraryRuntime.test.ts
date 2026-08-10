import { describe, expect, it } from 'vitest';
import type { WorshipSong } from './worshipSongs';
import {
  languageFiltersForSongs,
  parseHymnNumberSearch,
  songMatchesSearch,
  sortSongResults,
} from './songLibraryRuntime';

function song(id: string, title: string, extra: Partial<WorshipSong> = {}): WorshipSong {
  return {
    id,
    title,
    artist: 'Example Worship',
    category: 'Contemporary Worship',
    youtubeId: `video-${id}`,
    ...extra,
  };
}

describe('runtime song catalogue helpers', () => {
  it('keeps English and Farsi prominent while sorting other language filters', () => {
    expect(languageFiltersForSongs([
      song('1', 'One', { language: 'Zulu' }),
      song('2', 'Two', { language: 'English' }),
      song('3', 'Three', { language: 'Persian / Farsi' }),
      song('4', 'Four', { language: 'Arabic' }),
    ])).toEqual(['English', 'Persian / Farsi', 'Arabic', 'Zulu']);
  });

  it('understands qualified hymn numbers in the deferred catalogue', () => {
    expect(parseHymnNumberSearch('AM 55')).toEqual({ hymnal: 'AM2013', number: '55' });
    const hymn = song('5', 'Amazing Grace', {
      hymnalReferences: [{ hymnal: 'AM2013', hymnalName: 'Ancient & Modern 2013', shortName: 'AM', number: '55', sourceUrl: 'https://example.test' }],
    });
    expect(songMatchesSearch(hymn, 'AM 55')).toBe(true);
  });

  it('ranks an exact familiar title ahead of partial and artist matches', () => {
    const exact = song('exact', 'Goodness of God', { ccliUkRank: 1 });
    const partial = song('partial', 'Goodness of God (Acoustic)');
    const artist = song('artist', 'Another Song', { artist: 'Goodness of God Choir' });
    expect(sortSongResults([artist, partial, exact], 'goodness of god').map((entry) => entry.id))
      .toEqual(['exact', 'partial', 'artist']);
  });
});
