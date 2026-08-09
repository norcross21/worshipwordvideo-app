import researchedRows from './researchedWordWorshipVideos.json';
import type { LanguagePresentation, WorshipArrangement, WorshipSong } from './worshipSongs';

type ResearchedWordVideoRow = [
  youtubeId: string,
  sourceTitle: string,
  sourceChannel: string,
  language: string,
  languageCode: string,
  region: string,
  arrangement: WorshipArrangement,
  languagePresentation: LanguagePresentation,
  wordEvidence: string,
  durationSeconds: number,
  checkedOn: string,
  englishTitle?: string,
  viewCountAtReview?: number,
];

const rows = researchedRows as unknown as ResearchedWordVideoRow[];

/**
 * Recently researched discovery links. Labels are intentionally conservative:
 * exact uploader titles are retained and inferred labels are identified in UI.
 */
export const RESEARCHED_WORD_WORSHIP_SONGS: WorshipSong[] = rows.map(([
  youtubeId,
  sourceTitle,
  sourceChannel,
  language,
  languageCode,
  region,
  arrangement,
  languagePresentation,
  wordEvidence,
  durationSeconds,
  checkedOn,
  englishTitle,
  viewCountAtReview,
], index) => ({
  id: `researched-words-${String(index + 1).padStart(5, '0')}`,
  title: sourceTitle,
  englishTitle: englishTitle || undefined,
  artist: sourceChannel,
  category: arrangement === 'Traditional hymn' ? 'Traditional hymn' : 'Contemporary worship',
  youtubeId,
  language,
  languageCode,
  region,
  searchAliases: [language, region, arrangement, languagePresentation, wordEvidence, englishTitle ?? ''],
  sourceChannel,
  versionType: 'Lyrics / subtitles indicated',
  catalogueReview: 'Word evidence and metadata checked',
  wordEvidence,
  qualityCheckedOn: checkedOn,
  durationSeconds: durationSeconds || undefined,
  viewCountAtReview: viewCountAtReview || undefined,
  wordsIndicated: true,
  arrangement,
  languagePresentation,
  metadataConfidence: 'Catalogue-inferred',
}));

export const RESEARCHED_WORD_COUNTS = {
  total: RESEARCHED_WORD_WORSHIP_SONGS.length,
  languages: new Set(RESEARCHED_WORD_WORSHIP_SONGS.map((song) => song.language)).size,
} as const;

export const RESEARCHED_WORD_VIDEO_IDS = new Set(RESEARCHED_WORD_WORSHIP_SONGS.map((song) => song.youtubeId));
export const RESEARCHED_WORD_LANGUAGE_FILTERS = [
  ...new Set(RESEARCHED_WORD_WORSHIP_SONGS.map((song) => song.language).filter((language): language is string => Boolean(language))),
].sort((first, second) => first.localeCompare(second));
