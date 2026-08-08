import { WORSHIP_SONGS, type HymnalCode, type HymnalReference, type WorshipSong } from './worshipSongs';
import { ADDITIONAL_WORSHIP_SONGS } from './additionalWorshipSongs';
import { ANCIENT_MODERN_2013 } from './ancientModern2013';
import { ANCIENT_MODERN_VIDEOS } from './ancientModernVideos';
import { CCLI_UK_CHART_ADDITIONS, CCLI_UK_TOP_100 } from './ccliUkTop100';
import { ARTIST_WORSHIP_SONGS } from './artistWorshipSongs';
import { EXPANDED_ARTIST_WORSHIP_SONGS } from './expandedArtistWorshipSongs';
import { BROAD_ARTIST_WORSHIP_SONGS } from './broadArtistWorshipSongs';
import { CLASSIC_HYMN_ESSENTIALS } from './classicHymnEssentials';
import { CLASSIC_HYMNAL_COLLECTIONS } from './classicHymnalCollections';
import { CLASSIC_HYMNAL_VIDEOS } from './classicHymnalVideos';
import { CHURCH_ESSENTIAL_SONGS } from './churchEssentialSongs';
import { GREGORIAN_CHANTS } from './gregorianChants';
import { EASTERN_CHRISTIAN_WORD_VIDEOS } from './easternChristianVideos';
import { WORSHIP_WORD_VIDEO_REPLACEMENTS } from './worshipWordVideoReplacements';

const CUSTOM_SONGS_KEY = 'liturgy_custom_worship_songs';
const SONG_OVERRIDES_KEY = 'liturgy_worship_song_overrides';

export const HYMNAL_COLLECTION_OPTIONS: Array<{ code: HymnalCode; name: string; shortName: string; tradition: string; entryCount: number }> = [
  { code: 'AM2013', name: 'Ancient & Modern 2013', shortName: 'AM', tradition: 'Anglican', entryCount: ANCIENT_MODERN_2013.length },
  ...CLASSIC_HYMNAL_COLLECTIONS.map(({ code, name, shortName, tradition, entries }) => ({
    code,
    name,
    shortName,
    tradition,
    entryCount: entries.length,
  })),
];

export const MUSIC_STYLES = [
  'Contemporary worship',
  'Traditional hymn',
  'Gospel and spiritual',
  'Children and family',
  'Simple song and chant',
  'Gregorian chant',
  'Eastern Christian chant',
  'Sung liturgy',
  'Metrical psalm',
  'Hymn-book index',
] as const;

export type MusicStyle = typeof MUSIC_STYLES[number];

/** A practical familiar-song filter: current CCLI staples or hymns shared by several books. */
export function isWellKnownSong(song: WorshipSong): boolean {
  return song.ccliUkRank != null || songHymnalReferences(song).length >= 2;
}

function normaliseLookup(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

const HYMNAL_ALIASES = new Map<string, HymnalCode>();
for (const collection of HYMNAL_COLLECTION_OPTIONS) {
  for (const alias of [collection.code, collection.shortName, collection.name]) {
    HYMNAL_ALIASES.set(normaliseLookup(alias), collection.code);
  }
}

export interface HymnNumberSearch {
  number: string;
  hymnal?: HymnalCode;
}

/** Understand bare numbers and familiar forms such as AM 55, AM#55 or Gather 55. */
export function parseHymnNumberSearch(rawQuery: string): HymnNumberSearch | null {
  const query = rawQuery.trim();
  const bareNumber = query.match(/^#?(\d+[a-z]?)$/i);
  if (bareNumber) return { number: bareNumber[1].toLowerCase() };

  const qualified = query.match(/^(.+?)\s*#?\s*(\d+[a-z]?)$/i);
  if (!qualified) return null;
  const hymnal = HYMNAL_ALIASES.get(normaliseLookup(qualified[1]));
  return hymnal ? { hymnal, number: qualified[2].toLowerCase() } : null;
}

export function songTraditions(song: WorshipSong): string[] {
  const traditions = new Set<string>();
  for (const reference of songHymnalReferences(song)) {
    const collection = HYMNAL_COLLECTION_OPTIONS.find((option) => option.code === reference.hymnal);
    if (collection) traditions.add(collection.tradition);
  }

  const identity = `${song.artist} ${song.title}`.toLowerCase();
  if (identity.includes('taize')) traditions.add('Contemplative and simple song');
  if (identity.includes('gregorian')) traditions.add('Western chant');
  if (/orthodox|byzantine|coptic|syriac|ethiopian/.test(identity)) traditions.add('Eastern Christian');
  if (/spiritual|gospel|gaither/.test(identity)) traditions.add('Gospel and spiritual');
  if (/kids|children|duggie|ishmael/.test(identity)) traditions.add('Children and schools');
  if (song.category === 'Contemporary Worship') traditions.add('Contemporary worship');
  return [...traditions];
}

export function songMusicStyle(song: WorshipSong): MusicStyle {
  const identity = `${song.artist} ${song.title} ${song.tune ?? ''}`.toLowerCase();
  if (identity.includes('gregorian')) return 'Gregorian chant';
  if (/orthodox|byzantine|coptic|syriac|ethiopian/.test(identity)) return 'Eastern Christian chant';
  if (identity.includes('taize')) return 'Simple song and chant';
  if (/kids|children|duggie|ishmael/.test(identity)) return 'Children and family';
  if (/spiritual|gospel|gaither/.test(identity)) return 'Gospel and spiritual';
  if (/psalm|psalter/.test(identity) && song.category === 'Hymnal Index') return 'Metrical psalm';
  if (song.category === 'Traditional Hymn') return 'Traditional hymn';
  if (song.category === 'Contemporary Worship') return 'Contemporary worship';
  if (song.category === 'Sung Liturgy') return 'Sung liturgy';
  return 'Hymn-book index';
}

/** Extract a safe YouTube video ID from an ID or common YouTube URL. */
export function normalizeYouTubeVideoId(value: string): string | null {
  const input = value.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;

  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let candidate = '';
    if (host === 'youtu.be') candidate = url.pathname.split('/').filter(Boolean)[0] ?? '';
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      candidate = url.searchParams.get('v') ?? '';
      if (!candidate) {
        const parts = url.pathname.split('/').filter(Boolean);
        if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) candidate = parts[1] ?? '';
      }
    }
    return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function getCustomSongs(): WorshipSong[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SONGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomSongs(songs: WorshipSong[]) {
  try {
    localStorage.setItem(CUSTOM_SONGS_KEY, JSON.stringify(songs));
  } catch (e) {
    console.error('Failed to save custom songs to localStorage', e);
  }
}

export function getSongOverrides(): Record<string, Partial<WorshipSong>> {
  try {
    const raw = localStorage.getItem(SONG_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSongOverrides(overrides: Record<string, Partial<WorshipSong>>) {
  try {
    localStorage.setItem(SONG_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.error('Failed to save song overrides to localStorage', e);
  }
}

function titleKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function exactTitleKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildMaintainedCatalogue(): WorshipSong[] {
  const curatedBase = [
    ...WORSHIP_SONGS.slice(0, 100),
    ...CLASSIC_HYMN_ESSENTIALS,
    ...ADDITIONAL_WORSHIP_SONGS,
    ...CCLI_UK_CHART_ADDITIONS,
    ...ARTIST_WORSHIP_SONGS,
    ...EXPANDED_ARTIST_WORSHIP_SONGS,
    ...BROAD_ARTIST_WORSHIP_SONGS,
    ...CHURCH_ESSENTIAL_SONGS,
    ...EASTERN_CHRISTIAN_WORD_VIDEOS,
  ];
  const baseTitles = new Set(curatedBase.map((song) => exactTitleKey(song.title)));
  const curatedCore: WorshipSong[] = [
    ...curatedBase,
    ...GREGORIAN_CHANTS.filter((song) => song.youtubeId && !baseTitles.has(exactTitleKey(song.title))),
  ];
  // Chant titles only join the usable catalogue when they have a selected word
  // video. The complete source indexes remain in their data files for research.
  const curated: WorshipSong[] = curatedCore;
  const chartRankByTitle = new Map(CCLI_UK_TOP_100.map((entry) => [exactTitleKey(entry.catalogueTitle), entry.rank]));
  const hymnalByTitle = new Map<string, typeof ANCIENT_MODERN_2013>();
  for (const hymn of ANCIENT_MODERN_2013) {
    const key = titleKey(hymn.title);
    const matches = hymnalByTitle.get(key) ?? [];
    matches.push(hymn);
    hymnalByTitle.set(key, matches);
  }

  const claimedNumbers = new Set<string>();
  const claimedChartRanks = new Set<number>();
  const enriched = curated.map((song) => {
    const matchingRank = chartRankByTitle.get(exactTitleKey(song.title));
    const ccliUkRank = matchingRank != null && !claimedChartRanks.has(matchingRank) ? matchingRank : undefined;
    if (ccliUkRank != null) claimedChartRanks.add(ccliUkRank);
    const rankedSong = { ...song, ccliUkRank };
    const match = hymnalByTitle.get(titleKey(song.title))?.find((hymn) => !claimedNumbers.has(hymn.number));
    if (!match) return rankedSong;
    claimedNumbers.add(match.number);
    return {
      ...rankedSong,
      youtubeId: rankedSong.youtubeId || ANCIENT_MODERN_VIDEOS[match.number]?.youtubeId || '',
      hymnal: 'AM2013' as const,
      hymnalNumber: match.number,
      tune: match.tune,
      sourceUrl: match.sourceUrl,
      hymnalReferences: [{
        hymnal: 'AM2013' as const,
        hymnalName: 'Ancient & Modern 2013',
        shortName: 'AM',
        number: match.number,
        tune: match.tune,
        sourceUrl: match.sourceUrl,
      }],
    };
  });

  const remainingHymnal: WorshipSong[] = ANCIENT_MODERN_2013
    .filter((hymn) => !claimedNumbers.has(hymn.number))
    .map((hymn) => ({
      id: `am2013-${hymn.number}`,
      title: hymn.title,
      artist: 'Ancient & Modern 2013',
      category: 'Hymnal Index',
      youtubeId: ANCIENT_MODERN_VIDEOS[hymn.number]?.youtubeId ?? '',
      hymnal: 'AM2013',
      hymnalNumber: hymn.number,
      tune: hymn.tune,
      sourceUrl: hymn.sourceUrl,
      hymnalReferences: [{
        hymnal: 'AM2013',
        hymnalName: 'Ancient & Modern 2013',
        shortName: 'AM',
        number: hymn.number,
        tune: hymn.tune,
        sourceUrl: hymn.sourceUrl,
      }],
    }));

  return addClassicHymnalCollections([...enriched, ...remainingHymnal]).map((song) => {
    const video = CLASSIC_HYMNAL_VIDEOS[song.id];
    return !song.youtubeId && video ? { ...song, youtubeId: video.youtubeId } : song;
  });
}

function addClassicHymnalCollections(sourceSongs: WorshipSong[]): WorshipSong[] {
  const songs: WorshipSong[] = sourceSongs.map((song) => ({
    ...song,
    hymnalReferences: song.hymnalReferences ? [...song.hymnalReferences] : [],
  }));
  const songsByTitle = new Map<string, WorshipSong[]>();
  for (const song of songs) {
    const key = titleKey(song.title);
    songsByTitle.set(key, [...(songsByTitle.get(key) ?? []), song]);
  }

  for (const collection of CLASSIC_HYMNAL_COLLECTIONS) {
    for (const entry of collection.entries) {
      const reference: HymnalReference = {
        hymnal: collection.code,
        hymnalName: collection.name,
        shortName: collection.shortName,
        number: entry.number,
        tune: entry.tune,
        sourceUrl: entry.sourceUrl,
      };
      const key = titleKey(entry.title);
      const existing = songsByTitle.get(key)?.[0];
      if (existing) {
        existing.hymnalReferences = [...(existing.hymnalReferences ?? []), reference];
        const indexedVideo = CLASSIC_HYMNAL_VIDEOS[`${collection.code.toLowerCase()}-${entry.number}`];
        if (!existing.youtubeId && indexedVideo) existing.youtubeId = indexedVideo.youtubeId;
        continue;
      }

      const song: WorshipSong = {
        id: `${collection.code.toLowerCase()}-${entry.number}`,
        title: entry.title,
        artist: collection.shortName,
        category: 'Hymnal Index',
        youtubeId: '',
        hymnalReferences: [reference],
      };
      songs.push(song);
      songsByTitle.set(key, [song]);
    }
  }

  return songs;
}

export function songHymnalReferences(song: WorshipSong): HymnalReference[] {
  if (song.hymnalReferences?.length) return song.hymnalReferences;
  if (!song.hymnal || !song.hymnalNumber || !song.sourceUrl) return [];
  return [{
    hymnal: song.hymnal,
    hymnalName: 'Ancient & Modern 2013',
    shortName: 'AM',
    number: song.hymnalNumber,
    tune: song.tune,
    sourceUrl: song.sourceUrl,
  }];
}

export function songMatchesSearch(song: WorshipSong, rawQuery: string, hymnal?: HymnalCode): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  const numberSearch = parseHymnNumberSearch(rawQuery);
  const targetHymnal = numberSearch?.hymnal ?? hymnal;
  const references = targetHymnal
    ? songHymnalReferences(song).filter((reference) => reference.hymnal === targetHymnal)
    : songHymnalReferences(song);
  if (numberSearch) {
    return references.some((reference) => reference.number.toLowerCase() === numberSearch.number);
  }
  return song.title.toLowerCase().includes(query)
    || song.artist.toLowerCase().includes(query)
    || song.tune?.toLowerCase().includes(query)
    || references.some((reference) => reference.number.toLowerCase().includes(query))
    || references.some((reference) => reference.tune?.toLowerCase().includes(query))
    || references.some((reference) => `${reference.shortName} ${reference.number}`.toLowerCase().includes(query));
}

export function getFullSongLibrary(): WorshipSong[] {
  const custom = getCustomSongs();
  const overrides = getSongOverrides();

  // Generated source rows after 100 contain duplicate titles and invented artist
  // pairings. The maintained catalogue is expanded with the numbered AM2013 index.
  const curatedDefaults = buildMaintainedCatalogue().map((song) => {
    const replacement = WORSHIP_WORD_VIDEO_REPLACEMENTS[song.id];
    return replacement ? { ...song, youtubeId: replacement.youtubeId } : song;
  });
  const mappedDefaults = curatedDefaults.map((song) => {
    const override = overrides[song.id];
    if (override) {
      return { ...song, ...override };
    }
    return song;
  });

  return [...mappedDefaults, ...custom];
}

export function addCustomSong(song: Omit<WorshipSong, 'id'>): WorshipSong {
  const custom = getCustomSongs();
  const newSong: WorshipSong = {
    ...song,
    id: `custom-ws-${Date.now()}`
  };
  custom.push(newSong);
  saveCustomSongs(custom);
  return newSong;
}

export function updateSong(songId: string, updates: Partial<WorshipSong>) {
  if (songId.startsWith('custom-ws-')) {
    // Update custom song
    const custom = getCustomSongs();
    const index = custom.findIndex((s) => s.id === songId);
    if (index !== -1) {
      custom[index] = { ...custom[index], ...updates };
      saveCustomSongs(custom);
    }
  } else {
    // Override default song
    const overrides = getSongOverrides();
    overrides[songId] = { ...overrides[songId], ...updates };
    saveSongOverrides(overrides);
  }
}

export function deleteSong(songId: string) {
  if (songId.startsWith('custom-ws-')) {
    const custom = getCustomSongs();
    const filtered = custom.filter((s) => s.id !== songId);
    saveCustomSongs(filtered);
  }
}
