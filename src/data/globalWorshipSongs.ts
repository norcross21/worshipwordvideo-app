import type { WorshipSong } from './worshipSongs';
import globalVideoRows from './globalWorshipVideos.json';

type GlobalVideoRow = [
  youtubeId: string,
  sourceTitle: string,
  sourceChannel: string,
  language: string,
  languageCode: string,
  region: string,
  wordsIndicated: boolean,
  durationSeconds: number,
  viewCountAtReview: number,
];

const rows = globalVideoRows as unknown as GlobalVideoRow[];

/**
 * International discovery catalogue researched on 8 August 2026. Each link
 * passed a YouTube oEmbed availability check and metadata-based worship filter.
 * Native speakers should still review language, theology and on-screen words.
 */
export const GLOBAL_WORSHIP_SONGS: WorshipSong[] = rows.map(([
  youtubeId,
  sourceTitle,
  sourceChannel,
  language,
  languageCode,
  region,
  wordsIndicated,
  durationSeconds,
  viewCountAtReview,
], index) => ({
  id: `global-${languageCode}-${String(index + 1).padStart(4, '0')}`,
  title: sourceTitle,
  artist: sourceChannel,
  category: 'Gospel and spiritual',
  youtubeId,
  language,
  languageCode,
  region,
  searchAliases: [
    `${language} Christian worship`,
    `${language} worship with words`,
    region,
  ],
  sourceChannel,
  versionType: wordsIndicated ? 'Lyrics / subtitles indicated' : 'Native-language worship',
  catalogueReview: 'Metadata and embed checked',
  durationSeconds,
  viewCountAtReview,
}));

export const GLOBAL_LANGUAGE_FILTERS = [...new Set(GLOBAL_WORSHIP_SONGS.map((song) => song.language!))]
  .sort((first, second) => first.localeCompare(second));

export const GLOBAL_CATALOGUE_COUNTS = {
  total: GLOBAL_WORSHIP_SONGS.length,
  languages: GLOBAL_LANGUAGE_FILTERS.length,
  wordsIndicated: GLOBAL_WORSHIP_SONGS.filter((song) => song.versionType === 'Lyrics / subtitles indicated').length,
} as const;
