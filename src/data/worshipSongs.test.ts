import { describe, it, expect } from 'vitest';
import { WORSHIP_SONGS, type WorshipSong } from './worshipSongs';
import { ADDITIONAL_WORSHIP_SONGS } from './additionalWorshipSongs';
import { ANCIENT_MODERN_2013 } from './ancientModern2013';
import {
  getFullSongLibrary,
  isWellKnownSong,
  normalizeYouTubeVideoId,
  parseHymnNumberSearch,
  songHymnalReferences,
  songMatchesSearch,
  sortSongResults,
} from './songLibraryStore';
import { CCLI_UK_TOP_100 } from './ccliUkTop100';
import { ARTIST_WORSHIP_SONGS, FEATURED_WORSHIP_ARTISTS } from './artistWorshipSongs';
import { EXPANDED_ARTIST_WORSHIP_SONGS } from './expandedArtistWorshipSongs';
import { BROAD_ARTIST_WORSHIP_SONGS } from './broadArtistWorshipSongs';
import { CLASSIC_HYMNAL_COLLECTIONS } from './classicHymnalCollections';
import { CLASSIC_HYMNAL_VIDEOS } from './classicHymnalVideos';
import { GREGORIAN_CHANTS } from './gregorianChants';
import { TAIZE_SONG_INDEX } from './taizeSongIndex';
import { CATALOGUE_WORD_VIDEO_IDS, videoTitleIndicatesWords } from './videoApproval';
import { WORSHIP_WORD_VIDEO_REPLACEMENTS } from './worshipWordVideoReplacements';
import { WORSHIP_VIDEO_AUDIT } from './worshipVideoAudit';
import { assessWorshipVideo, titleMatchScore } from './videoQuality';

describe('Worship Songs Database', () => {
  it('retains the source catalogue while presenting only maintained entries', () => {
    expect(WORSHIP_SONGS.length).toBe(500);
    expect(getFullSongLibrary().length).toBeGreaterThanOrEqual(15_000);
    expect(getFullSongLibrary().some((song) => song.title.startsWith('Worship Song Ref #'))).toBe(false);
  });

  it('should have correct properties on each song', () => {
    WORSHIP_SONGS.forEach((song) => {
      expect(song.id).toBeDefined();
      expect(song.title).toBeDefined();
      expect(song.artist).toBeDefined();
      expect(song.category).toBeDefined();
      expect(song.youtubeId).toBeDefined();
      expect(typeof song.youtubeId).toBe('string');
    });
  });

  it('should merge overrides and custom songs from local storage', () => {
    const library = getFullSongLibrary();
    expect(library.length).toBeGreaterThanOrEqual(1_000);
  });

  it('ships popular songs with playable YouTube links', () => {
    const playable = getFullSongLibrary().filter((song) => song.youtubeId);
    expect(playable.length).toBeGreaterThanOrEqual(12_000);
    expect(new Set(playable.map((song) => song.youtubeId)).size).toBe(playable.length);
    expect(playable.slice(0, 10).every((song) => normalizeYouTubeVideoId(song.youtubeId))).toBe(true);
    expect(ADDITIONAL_WORSHIP_SONGS).toHaveLength(100);
    expect(ADDITIONAL_WORSHIP_SONGS.every((song) => normalizeYouTubeVideoId(song.youtubeId))).toBe(true);
  });

  it('includes the numbered Songs of Fellowship and Redemption Songs collections', () => {
    const library = getFullSongLibrary();
    const songsOfFellowship = CLASSIC_HYMNAL_COLLECTIONS.find((collection) => collection.code === 'SOF1995');
    const redemptionSongs = CLASSIC_HYMNAL_COLLECTIONS.find((collection) => collection.code === 'RS1900');
    expect(songsOfFellowship?.entries).toHaveLength(655);
    expect(redemptionSongs?.entries).toHaveLength(1_219);
    expect(library.length).toBeGreaterThanOrEqual(3_250);
    expect(library.filter((song) => songHymnalReferences(song).some((reference) => reference.hymnal === 'SOF1995')).length)
      .toBeGreaterThanOrEqual(625);
    expect(library.filter((song) => songHymnalReferences(song).some((reference) => reference.hymnal === 'RS1900')).length)
      .toBeGreaterThanOrEqual(1_000);
  });

  it('adds more than one thousand distinct hymns from Anglican, Black church, Episcopal and global collections', () => {
    const library = getFullSongLibrary();
    const expectedCollections = [
      { code: 'EH1906', entries: 655, distinct: 640 },
      { code: 'AAHH2001', entries: 584, distinct: 550 },
      { code: 'LEVS1993', entries: 281, distinct: 260 },
      { code: 'GP22000', entries: 127, distinct: 115 },
    ] as const;

    expect(library.length).toBeGreaterThanOrEqual(4_350);
    for (const expected of expectedCollections) {
      const collection = CLASSIC_HYMNAL_COLLECTIONS.find((item) => item.code === expected.code);
      const indexedSongs = library.filter((song) =>
        songHymnalReferences(song).some((reference) => reference.hymnal === expected.code));
      expect(collection?.entries).toHaveLength(expected.entries);
      expect(indexedSongs.length).toBeGreaterThanOrEqual(expected.distinct);
    }
  });

  it('adds Catholic, Anglo-Catholic, shape-note, Scottish and contemplative traditions', () => {
    const library = getFullSongLibrary();
    const expectedCollections = [
      { code: 'GC2', entries: 893, distinct: 760 },
      { code: 'NEH1985', entries: 643, distinct: 550 },
      { code: 'OSH1960', entries: 553, distinct: 450 },
      { code: 'CH4', entries: 877, distinct: 800 },
    ] as const;

    expect(library.length).toBeGreaterThanOrEqual(5_900);
    for (const expected of expectedCollections) {
      const collection = CLASSIC_HYMNAL_COLLECTIONS.find((item) => item.code === expected.code);
      const indexedSongs = library.filter((song) =>
        songHymnalReferences(song).some((reference) => reference.hymnal === expected.code));
      expect(collection?.entries).toHaveLength(expected.entries);
      expect(indexedSongs.length).toBeGreaterThanOrEqual(expected.distinct);
    }

    expect(TAIZE_SONG_INDEX.length).toBeGreaterThanOrEqual(150);
    expect(library.filter((song) => song.artist.toLowerCase().includes('taize'))
      .every((song) => Boolean(song.youtubeId))).toBe(true);
    expect(GREGORIAN_CHANTS.length).toBeGreaterThanOrEqual(80);
    expect(library.some((song) => song.title === 'Salve Regina' && song.artist === 'Gregorian chant' && song.youtubeId)).toBe(true);
    expect(library.some((song) => song.artist === 'Gregorian chant' && !song.youtubeId)).toBe(false);
    expect(library.some((song) => song.title.includes('Paschal Troparion') && song.youtubeId)).toBe(true);
    expect(library.some((song) => song.title.includes('Agni Parthene') && song.youtubeId)).toBe(true);
  });

  it('adds hundreds of unique validated videos to the classic hymn collections', () => {
    const videos = Object.values(CLASSIC_HYMNAL_VIDEOS);
    expect(videos.length).toBeGreaterThanOrEqual(1_000);
    expect(videos.every((video) => normalizeYouTubeVideoId(video.youtubeId))).toBe(true);
    expect(new Set(videos.map((video) => video.youtubeId)).size).toBe(videos.length);
    expect(CATALOGUE_WORD_VIDEO_IDS.size).toBeGreaterThanOrEqual(2_000);
  });

  it('ships retrospectively audited word-video replacements for weaker links', () => {
    const libraryById = new Map(getFullSongLibrary().map((song) => [song.id, song]));
    const replacements = Object.entries(WORSHIP_WORD_VIDEO_REPLACEMENTS);

    expect(replacements.length).toBeGreaterThanOrEqual(250);
    expect(new Set(replacements.map(([, replacement]) => replacement.youtubeId)).size).toBe(replacements.length);
    for (const [songId, replacement] of replacements) {
      const song = libraryById.get(songId);
      const audit = WORSHIP_VIDEO_AUDIT[replacement.youtubeId];
      expect(song?.youtubeId).toBe(replacement.youtubeId);
      expect(audit?.available).toBe(true);
      expect(audit?.embeddable).not.toBe(false);
      expect(videoTitleIndicatesWords(audit?.title ?? '')).toBe(true);
      expect(titleMatchScore(song?.title ?? '', audit?.title ?? '')).toBeGreaterThanOrEqual(0.75);
      expect(song && assessWorshipVideo(song).level).toBe('strong');
    }
  });

  it('identifies familiar chart songs and hymns shared by several books', () => {
    const library = getFullSongLibrary();
    expect(library.filter(isWellKnownSong).length).toBeGreaterThanOrEqual(1_000);
    expect(library.some((song) => song.ccliUkRank === 1 && isWellKnownSong(song))).toBe(true);
    expect(library.some((song) => songHymnalReferences(song).length >= 3 && isWellKnownSong(song))).toBe(true);
  });

  it('includes familiar traditional and contemporary versions of the requested hymns', () => {
    const library = getFullSongLibrary();
    expect(library.some((song) => song.title === 'Because He Lives' && song.artist.includes('Gaither') && song.youtubeId)).toBe(true);
    expect(library.some((song) => song.title === 'Because He Lives (Amen)' && song.youtubeId)).toBe(true);
    expect(library.some((song) => song.title === 'It Is Well With My Soul' && song.youtubeId)).toBe(true);
    expect(library.some((song) => song.title === 'It Is Well' && song.artist.includes('Bethel') && song.youtubeId)).toBe(true);
  });

  it('finds exact hymn numbers without treating them as partial numbers', () => {
    const redemptionSongs = getFullSongLibrary()
      .filter((song) => songHymnalReferences(song).some((reference) => reference.hymnal === 'RS1900'));
    const matches = redemptionSongs.filter((song) => songMatchesSearch(song, '55', 'RS1900'));
    expect(matches.some((song) => song.title === 'O bliss of the purified! bliss of the free!')).toBe(true);
    expect(matches.every((song) => songHymnalReferences(song).some((reference) => reference.number === '55'))).toBe(true);
  });

  it('understands bare and collection-qualified hymn numbers', () => {
    const library = getFullSongLibrary();
    expect(parseHymnNumberSearch('55')).toEqual({ number: '55' });
    expect(parseHymnNumberSearch('#55')).toEqual({ number: '55' });
    expect(parseHymnNumberSearch('AM #55')).toEqual({ hymnal: 'AM2013', number: '55' });
    expect(parseHymnNumberSearch('Ancient & Modern 2013 55')).toEqual({ hymnal: 'AM2013', number: '55' });
    expect(parseHymnNumberSearch('Gather 55')).toEqual({ hymnal: 'GC2', number: '55' });
    expect(parseHymnNumberSearch('Psalm 55')).toBeNull();

    const amMatches = library.filter((song) => songMatchesSearch(song, 'AM 55'));
    expect(amMatches.length).toBeGreaterThan(0);
    expect(amMatches.every((song) => songHymnalReferences(song)
      .some((reference) => reference.hymnal === 'AM2013' && reference.number === '55'))).toBe(true);
  });

  it('ranks exact, playable and reviewed search results first', () => {
    const candidates: WorshipSong[] = [
      { id: 'partial', title: 'The Goodness of God Medley', artist: 'Example', category: 'Contemporary Worship', youtubeId: '' },
      { id: 'exact', title: 'Goodness of God', artist: 'Example', category: 'Contemporary Worship', youtubeId: 'abcdefghijk', catalogueReview: 'Word evidence and embed checked' },
      { id: 'artist', title: 'Another Song', artist: 'Goodness of God Choir', category: 'Contemporary Worship', youtubeId: 'lmnopqrstuv' },
    ];

    expect(sortSongResults(candidates, 'goodness of god').map((song) => song.id)).toEqual(['exact', 'partial', 'artist']);
  });

  it('matches combined song and language words even when metadata order differs', () => {
    const library = getFullSongLibrary();
    expect(library.some((song) => songMatchesSearch(song, 'Goodness of God Farsi'))).toBe(true);
  });

  it('includes every song in the CCLI UK Top 100 snapshot with a playable video', () => {
    const chartSongs = getFullSongLibrary()
      .filter((song) => song.ccliUkRank != null)
      .sort((a, b) => (a.ccliUkRank ?? 999) - (b.ccliUkRank ?? 999));

    expect(CCLI_UK_TOP_100).toHaveLength(100);
    expect(chartSongs).toHaveLength(100);
    expect(chartSongs.map((song) => song.ccliUkRank)).toEqual(Array.from({ length: 100 }, (_, index) => index + 1));
    expect(chartSongs.every((song) => normalizeYouTubeVideoId(song.youtubeId))).toBe(true);
  });

  it('ships the expanded artist catalogue with playable, uniquely linked videos', () => {
    expect(FEATURED_WORSHIP_ARTISTS.length).toBeGreaterThanOrEqual(50);
    expect(ARTIST_WORSHIP_SONGS.length).toBeGreaterThanOrEqual(55);
    expect(ARTIST_WORSHIP_SONGS.every((song) => normalizeYouTubeVideoId(song.youtubeId))).toBe(true);
    for (const artist of FEATURED_WORSHIP_ARTISTS) {
      expect(getFullSongLibrary().some((song) => song.artist.toLowerCase().includes(artist.toLowerCase()))).toBe(true);
    }
  });

  it('ships a deeper words-video catalogue without repeated video IDs', () => {
    expect(EXPANDED_ARTIST_WORSHIP_SONGS.length).toBeGreaterThanOrEqual(150);
    expect(EXPANDED_ARTIST_WORSHIP_SONGS.every((song) => normalizeYouTubeVideoId(song.youtubeId))).toBe(true);
    expect(new Set(EXPANDED_ARTIST_WORSHIP_SONGS.map((song) => song.youtubeId)).size)
      .toBe(EXPANDED_ARTIST_WORSHIP_SONGS.length);
  });

  it('ships a broad artist audit with clean, uniquely linked words videos', () => {
    expect(BROAD_ARTIST_WORSHIP_SONGS.length).toBeGreaterThanOrEqual(500);
    expect(BROAD_ARTIST_WORSHIP_SONGS.every((song) => normalizeYouTubeVideoId(song.youtubeId))).toBe(true);
    expect(BROAD_ARTIST_WORSHIP_SONGS.every((song) => !/\b(?:official|lyrics?|video)\b/i.test(song.title))).toBe(true);
    expect(new Set(BROAD_ARTIST_WORSHIP_SONGS.map((song) => song.youtubeId)).size)
      .toBe(BROAD_ARTIST_WORSHIP_SONGS.length);
  });

  it('preserves every Ancient & Modern number and lettered tune variant', () => {
    const ancientModern = getFullSongLibrary().filter((song) => song.hymnal === 'AM2013');
    expect(ANCIENT_MODERN_2013).toHaveLength(940);
    expect(ancientModern).toHaveLength(940);
    expect(ancientModern.filter((song) => song.youtubeId).length).toBeGreaterThanOrEqual(800);
    expect(new Set(ancientModern.map((song) => song.hymnalNumber)).size).toBe(940);
    expect(ancientModern.some((song) => song.hymnalNumber === '14a')).toBe(true);
    expect(ancientModern.some((song) => song.hymnalNumber === '14b')).toBe(true);
  });

  it('accepts common YouTube links but rejects malformed video identifiers', () => {
    expect(normalizeYouTubeVideoId('qLy8kBp2c5U')).toBe('qLy8kBp2c5U');
    expect(normalizeYouTubeVideoId('https://youtu.be/qLy8kBp2c5U?t=20')).toBe('qLy8kBp2c5U');
    expect(normalizeYouTubeVideoId('https://www.youtube.com/watch?v=qLy8kBp2c5U&list=abc')).toBe('qLy8kBp2c5U');
    expect(normalizeYouTubeVideoId('https://www.youtube.com/shorts/qLy8kBp2c5U')).toBe('qLy8kBp2c5U');
    expect(normalizeYouTubeVideoId('https://www.youtube-nocookie.com/embed/qLy8kBp2c5U')).toBe('qLy8kBp2c5U');
    expect(normalizeYouTubeVideoId('not-a-valid-video-id')).toBeNull();
  });
});
