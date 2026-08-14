import type { HymnalCode, HymnalReference, LanguagePresentation, WorshipArrangement, WorshipSong } from './worshipSongs';
import { inferLanguagePresentation, inferWorshipArrangement } from './songPresentation';
import { canonicaliseSongLanguage, canonicalLanguageName } from './songLanguage';

const CUSTOM_SONGS_KEY = 'liturgy_custom_worship_songs';
const SONG_OVERRIDES_KEY = 'liturgy_worship_song_overrides';
const APPROVED_VIDEOS_KEY = 'liturgy_approved_worship_videos_v1';

export const HYMNAL_COLLECTION_OPTIONS: Array<{ code: HymnalCode; name: string; shortName: string; tradition: string }> = [
  { code: 'AM2013', name: 'Ancient & Modern 2013', shortName: 'AM', tradition: 'Anglican' },
  { code: 'SOF1995', name: 'Songs of Fellowship (1995)', shortName: 'SoF', tradition: 'Anglican' },
  { code: 'RS1900', name: 'Redemption Songs', shortName: 'RS', tradition: 'Gospel and shape-note' },
  { code: 'EH1906', name: 'The English Hymnal (1906)', shortName: 'EH', tradition: 'Anglican' },
  { code: 'AAHH2001', name: 'African American Heritage Hymnal', shortName: 'AAHH', tradition: 'Black church' },
  { code: 'LEVS1993', name: 'Lift Every Voice and Sing II', shortName: 'LEVS', tradition: 'Black church' },
  { code: 'GP22000', name: 'Global Praise 2', shortName: 'GP2', tradition: 'Global' },
  { code: 'GC2', name: 'Gather Comprehensive, Second Edition', shortName: 'Gather', tradition: 'Catholic' },
  { code: 'NEH1985', name: 'The New English Hymnal', shortName: 'NEH', tradition: 'Anglican' },
  { code: 'OSH1960', name: 'Original Sacred Harp (Denson Revision)', shortName: 'Sacred Harp', tradition: 'Gospel and shape-note' },
  { code: 'CH4', name: 'Church Hymnary, Fourth Edition', shortName: 'CH4', tradition: 'Scottish and ecumenical' },
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

interface LegacyRuntimeCatalogue {
  version: number;
  songs: WorshipSong[];
}

interface CompactCatalogueDictionaries {
  artist?: string[];
  category: string[];
  language: string[];
  region: string[];
  arrangement: string[];
  languagePresentation: string[];
}

type CompactSongRow = [
  id: string,
  title: string,
  artist: string | number,
  categoryIndex: number,
  youtubeId: string,
  languageIndex: number,
  regionIndex: number,
  englishTitle: string,
  ccliUkRank: number,
  flags: number,
  arrangementIndex: number,
  presentationIndex: number,
  durationSeconds: number,
  hymnalReferences: HymnalReference[] | 0,
  transliteration: string,
];

interface CompactRuntimeCatalogue {
  version: 2;
  checkedOn: string;
  dictionaries: CompactCatalogueDictionaries;
  songs: CompactSongRow[];
}

let cataloguePromise: Promise<WorshipSong[]> | null = null;
let starterCataloguePromise: Promise<WorshipSong[]> | null = null;

function readStoredValue<T>(key: string, fallback: T): T {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function dictionaryValue(dictionary: string[], compactIndex: number): string | undefined {
  return compactIndex > 0 ? dictionary[compactIndex - 1] : undefined;
}

function decodeCompactSong(row: CompactSongRow, payload: CompactRuntimeCatalogue): WorshipSong {
  const [
    id,
    title,
    artistValue,
    categoryIndex,
    youtubeId,
    languageIndex,
    regionIndex,
    englishTitle,
    ccliUkRank,
    flags,
    arrangementIndex,
    presentationIndex,
    durationSeconds,
    hymnalReferences,
    transliteration,
  ] = row;
  const catalogueReviewed = Boolean(flags & 2);
  const artist = typeof artistValue === 'number'
    ? dictionaryValue(payload.dictionaries.artist ?? [], artistValue) ?? ''
    : artistValue;
  return {
    id,
    title,
    artist,
    category: dictionaryValue(payload.dictionaries.category, categoryIndex) as WorshipSong['category'],
    youtubeId,
    language: canonicalLanguageName(dictionaryValue(payload.dictionaries.language, languageIndex)),
    region: dictionaryValue(payload.dictionaries.region, regionIndex),
    englishTitle: englishTitle || undefined,
    ccliUkRank: ccliUkRank || undefined,
    wordsIndicated: Boolean(flags & 1),
    arrangement: dictionaryValue(payload.dictionaries.arrangement, arrangementIndex) as WorshipArrangement | undefined,
    languagePresentation: dictionaryValue(payload.dictionaries.languagePresentation, presentationIndex) as LanguagePresentation | undefined,
    catalogueReview: catalogueReviewed ? 'Metadata and embed checked' : undefined,
    qualityCheckedOn: catalogueReviewed ? payload.checkedOn : undefined,
    metadataConfidence: flags & 4 ? 'Uploader-stated' : 'Catalogue-inferred',
    durationSeconds: durationSeconds || undefined,
    hymnalReferences: hymnalReferences || undefined,
    transliteration: transliteration || undefined,
  };
}

function decodeCatalogue(payload: LegacyRuntimeCatalogue | CompactRuntimeCatalogue): WorshipSong[] {
  if (payload.version === 2 && 'dictionaries' in payload && Array.isArray(payload.songs)) {
    return (payload as CompactRuntimeCatalogue).songs.map((row) => decodeCompactSong(row, payload as CompactRuntimeCatalogue));
  }
  if (payload.version === 1 && Array.isArray(payload.songs)) {
    return (payload as LegacyRuntimeCatalogue).songs.map(canonicaliseSongLanguage);
  }
  throw new Error('The catalogue response was not recognised.');
}

function applyPersonalCatalogueData(decodedSongs: WorshipSong[]): WorshipSong[] {
  const overrides = readStoredValue<Record<string, Partial<WorshipSong>>>(SONG_OVERRIDES_KEY, {});
  const custom = readStoredValue<WorshipSong[]>(CUSTOM_SONGS_KEY, []);
  const maintained = decodedSongs.map((song) => canonicaliseSongLanguage(overrides[song.id] ? { ...song, ...overrides[song.id] } : song));
  return [...maintained, ...custom.map(canonicaliseSongLanguage)].filter((song) => Boolean(song.id && song.title && song.youtubeId));
}

function fetchCatalogue(path: string): Promise<WorshipSong[]> {
  return fetch(path)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Catalogue request failed (${response.status}).`);
      const payload = await response.json() as LegacyRuntimeCatalogue | CompactRuntimeCatalogue;
      return applyPersonalCatalogueData(decodeCatalogue(payload));
    });
}

/** Load a small, language-diverse first page while the complete catalogue downloads. */
export function loadRuntimeStarterLibrary(): Promise<WorshipSong[]> {
  if (starterCataloguePromise) return starterCataloguePromise;
  starterCataloguePromise = fetchCatalogue('/catalogue/worship-songs-starter.json')
    .catch((error: unknown) => {
      starterCataloguePromise = null;
      throw error;
    });
  return starterCataloguePromise;
}

/** Load the complete catalogue once, then retain the decoded search index for this visit. */
export function loadRuntimeSongLibrary(): Promise<WorshipSong[]> {
  if (cataloguePromise) return cataloguePromise;
  cataloguePromise = fetchCatalogue('/catalogue/worship-songs.json')
    .catch((error: unknown) => {
      cataloguePromise = null;
      throw error;
    });
  return cataloguePromise;
}

export interface LanguageFilterOption {
  language: string;
  count: number;
}

export function languageFilterOptionsForSongs(songs: WorshipSong[]): LanguageFilterOption[] {
  const counts = new Map<string, number>();
  for (const song of songs) {
    const language = canonicalLanguageName(song.language);
    if (language === 'Language not stated') continue;
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }
  return [...counts].sort(([left], [right]) => {
    if (left === 'English') return -1;
    if (right === 'English') return 1;
    if (left === 'Persian / Farsi') return -1;
    if (right === 'Persian / Farsi') return 1;
    return left.localeCompare(right);
  }).map(([language, count]) => ({ language, count }));
}

export function languageFiltersForSongs(songs: WorshipSong[]): string[] {
  return languageFilterOptionsForSongs(songs).map(({ language }) => language);
}

export function getApprovedRuntimeVideos(): Set<string> {
  const saved = readStoredValue<unknown>(APPROVED_VIDEOS_KEY, []);
  if (!Array.isArray(saved)) return new Set();
  return new Set(saved.filter((id): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id)));
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

export function parseHymnNumberSearch(rawQuery: string): HymnNumberSearch | null {
  const query = rawQuery.trim();
  const bareNumber = query.match(/^#?(\d+[a-z]?)$/i);
  if (bareNumber) return { number: bareNumber[1].toLowerCase() };
  const qualified = query.match(/^(.+?)\s*#?\s*(\d+[a-z]?)$/i);
  if (!qualified) return null;
  const hymnal = HYMNAL_ALIASES.get(normaliseLookup(qualified[1]));
  return hymnal ? { hymnal, number: qualified[2].toLowerCase() } : null;
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

/** Familiar current songs or hymns represented in more than one maintained book. */
export function isWellKnownSong(song: WorshipSong): boolean {
  return song.ccliUkRank != null || songHymnalReferences(song).length >= 2;
}

export function songMusicStyle(song: WorshipSong): MusicStyle {
  const identity = `${song.artist} ${song.title} ${song.tune ?? ''}`.toLowerCase();
  if (MUSIC_STYLES.includes(song.category as MusicStyle)) return song.category as MusicStyle;
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

function normaliseSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface SongSearchIndex {
  title: string;
  englishTitle: string;
  artist: string;
  aliases: string[];
  searchable: string;
}

const SONG_SEARCH_INDEX = new WeakMap<WorshipSong, SongSearchIndex>();
const SONG_USEFULNESS_SCORE = new WeakMap<WorshipSong, number>();

function songSearchIndex(song: WorshipSong): SongSearchIndex {
  const cached = SONG_SEARCH_INDEX.get(song);
  if (cached) return cached;
  const aliases = (song.searchAliases ?? []).map(normaliseSearchText);
  const index: SongSearchIndex = {
    title: normaliseSearchText(song.title),
    englishTitle: normaliseSearchText(song.englishTitle ?? ''),
    artist: normaliseSearchText(song.artist),
    aliases,
    searchable: normaliseSearchText([
      song.title,
      song.englishTitle,
      song.transliteration,
      song.artist,
      song.tune,
      song.language,
      song.region,
      inferWorshipArrangement(song),
      inferLanguagePresentation(song),
      ...(song.searchAliases ?? []),
    ].filter(Boolean).join(' ')),
  };
  SONG_SEARCH_INDEX.set(song, index);
  return index;
}

export function songMatchesSearch(song: WorshipSong, rawQuery: string, hymnal?: HymnalCode): boolean {
  const query = normaliseSearchText(rawQuery);
  if (!query) return true;
  const numberSearch = parseHymnNumberSearch(rawQuery);
  const targetHymnal = numberSearch?.hymnal ?? hymnal;
  const references = targetHymnal
    ? songHymnalReferences(song).filter((reference) => reference.hymnal === targetHymnal)
    : songHymnalReferences(song);
  if (numberSearch) return references.some((reference) => reference.number.toLowerCase() === numberSearch.number);
  const index = songSearchIndex(song);
  const queryTokens = query.split(' ').filter(Boolean);
  return index.searchable.includes(query)
    || (queryTokens.length > 1 && queryTokens.every((token) => index.searchable.includes(token)))
    || references.some((reference) => reference.number.toLowerCase().includes(query))
    || references.some((reference) => reference.tune?.toLowerCase().includes(query))
    || references.some((reference) => `${reference.shortName} ${reference.number}`.toLowerCase().includes(query));
}

function catalogueUsefulnessScore(song: WorshipSong): number {
  const cached = SONG_USEFULNESS_SCORE.get(song);
  if (cached != null) return cached;
  let score = 0;
  if (song.id.startsWith('custom-ws-')) score += 2_000;
  if (song.youtubeId) score += 800;
  if (song.ccliUkRank != null) score += 2_000 + (101 - song.ccliUkRank) * 10;
  if (song.catalogueReview) score += 500;
  if (song.wordEvidence) score += 150;
  if (song.viewCountAtReview) score += Math.min(300, Math.log10(song.viewCountAtReview + 1) * 50);
  SONG_USEFULNESS_SCORE.set(song, score);
  return score;
}

function searchRelevanceScore(song: WorshipSong, rawQuery: string): number {
  const query = normaliseSearchText(rawQuery);
  if (!query) return 0;
  const { title, englishTitle, artist, aliases, searchable } = songSearchIndex(song);
  let titleScore = 0;
  let englishTitleScore = 0;
  let aliasScore = 0;
  let artistScore = 0;
  if (title === query) titleScore = 20_000;
  else if (title.startsWith(query)) titleScore = 12_000;
  else if (title.includes(query)) titleScore = 8_000;
  if (englishTitle === query) englishTitleScore = 18_000;
  else if (englishTitle.startsWith(query)) englishTitleScore = 10_000;
  else if (englishTitle.includes(query)) englishTitleScore = 7_000;
  if (aliases.some((alias) => alias === query)) aliasScore = 9_000;
  else if (aliases.some((alias) => alias.includes(query))) aliasScore = 5_000;
  if (artist === query) artistScore = 4_000;
  else if (artist.includes(query)) artistScore = 2_000;
  let score = Math.max(titleScore, englishTitleScore, aliasScore, artistScore);
  score += query.split(' ').filter((token) => searchable.includes(token)).length * 250;
  return score;
}

export function sortSongResults(songs: WorshipSong[], rawQuery = ''): WorshipSong[] {
  return songs
    .map((song, originalIndex) => ({ song, originalIndex, score: searchRelevanceScore(song, rawQuery) + catalogueUsefulnessScore(song) }))
    .sort((left, right) => right.score - left.score
      || left.song.title.localeCompare(right.song.title, undefined, { sensitivity: 'base' })
      || left.originalIndex - right.originalIndex)
    .map(({ song }) => song);
}
