import type { WorshipSong } from './worshipSongs';
import translatedVideoRows from './knownTranslatedWorshipVideos.json';
import depthVideoRows from './knownTranslatedWorshipVideoDepth.json';

type TranslatedVideoRow = [
  youtubeId: string,
  sourceTitle: string,
  sourceChannel: string,
  language: string,
  languageCode: string,
  region: string,
  englishTitle: string,
  wordsIndicated: boolean,
  durationSeconds: number,
  viewCountAtReview: number,
  languagePresentation?: WorshipSong['languagePresentation'],
  vocalLanguage?: string,
  subtitleLanguage?: string,
  arrangement?: WorshipSong['arrangement'],
];

const rows = [...new Map(
  ([...translatedVideoRows, ...depthVideoRows] as unknown as TranslatedVideoRow[])
    .map((row) => [row[0], row] as const),
).values()];

/** Familiar modern worship songs in local-language, translated or subtitled versions. */
export const KNOWN_TRANSLATED_WORSHIP_SONGS: WorshipSong[] = rows.map(([
  youtubeId,
  sourceTitle,
  sourceChannel,
  language,
  languageCode,
  region,
  englishTitle,
  wordsIndicated,
  durationSeconds,
  viewCountAtReview,
  languagePresentation,
  vocalLanguage,
  subtitleLanguage,
  arrangement,
], index) => ({
  id: `known-${languageCode}-${String(index + 1).padStart(3, '0')}`,
  title: sourceTitle,
  englishTitle,
  artist: sourceChannel,
  category: 'Contemporary worship',
  youtubeId,
  language,
  languageCode,
  region,
  searchAliases: [
    englishTitle,
    `${englishTitle} ${language}`,
    `${language} worship translation`,
    wordsIndicated ? 'lyrics or subtitles indicated by source' : 'language version',
  ],
  sourceChannel,
  versionType: 'Familiar-song language version',
  catalogueReview: 'Metadata and embed checked',
  wordsIndicated,
  wordEvidence: wordsIndicated ? 'Lyrics or subtitles indicated by the uploader' : undefined,
  durationSeconds,
  viewCountAtReview,
  languagePresentation,
  vocalLanguage,
  subtitleLanguage,
  arrangement,
}));

export const KNOWN_TRANSLATED_COUNTS = {
  total: KNOWN_TRANSLATED_WORSHIP_SONGS.length,
  languages: new Set(KNOWN_TRANSLATED_WORSHIP_SONGS.map((song) => song.language)).size,
  familiarSongs: new Set(KNOWN_TRANSLATED_WORSHIP_SONGS.map((song) => song.englishTitle)).size,
} as const;
