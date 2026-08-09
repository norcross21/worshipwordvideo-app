import type { WorshipSong } from './worshipSongs';
import expandedWordVideoRows from './expandedWordWorshipVideos.json';

type ExpandedWordVideoRow = [
  youtubeId: string,
  sourceTitle: string,
  sourceChannel: string,
  language: string,
  languageCode: string,
  region: string,
  englishTitle: string | null,
  expectedArtist: string | null,
  wordEvidence: string,
  durationSeconds: number,
  viewCountAtReview: number,
  checkedOn: string,
  collectionKind: 'familiar' | 'native',
];

const rows = expandedWordVideoRows as unknown as ExpandedWordVideoRow[];

export const EXPANDED_WORD_VIDEO_EVIDENCE = rows.map(([
  youtubeId,
  sourceTitle,
  sourceChannel,
  language,
  languageCode,
  region,
  englishTitle,
  expectedArtist,
  wordEvidence,
  durationSeconds,
  viewCountAtReview,
  checkedOn,
  collectionKind,
]) => ({
  youtubeId,
  sourceTitle,
  sourceChannel,
  language,
  languageCode,
  region,
  englishTitle,
  expectedArtist,
  wordEvidence,
  durationSeconds,
  viewCountAtReview,
  checkedOn,
  collectionKind,
}));

/**
 * Large, metadata-checked words-video expansion. The app stores YouTube links
 * and uploader metadata only; it does not copy or host song words.
 */
export const EXPANDED_WORD_WORSHIP_SONGS: WorshipSong[] = EXPANDED_WORD_VIDEO_EVIDENCE.map((video, index) => ({
  id: `expanded-words-${String(index + 1).padStart(5, '0')}`,
  title: video.sourceTitle,
  englishTitle: video.englishTitle ?? undefined,
  artist: video.sourceChannel,
  category: video.collectionKind === 'familiar' ? 'Contemporary worship' : 'Gospel and spiritual',
  youtubeId: video.youtubeId,
  language: video.language,
  languageCode: video.languageCode,
  region: video.region,
  searchAliases: [
    video.language,
    `${video.language} worship lyrics subtitles words`,
    video.englishTitle ?? '',
    video.expectedArtist ?? '',
    video.wordEvidence,
  ].filter(Boolean),
  sourceChannel: video.sourceChannel,
  versionType: video.collectionKind === 'familiar'
    ? 'Modern word / subtitle video'
    : 'Lyrics / subtitles indicated',
  catalogueReview: 'Word evidence and embed checked',
  wordEvidence: video.wordEvidence,
  qualityCheckedOn: video.checkedOn,
  durationSeconds: video.durationSeconds,
  viewCountAtReview: video.viewCountAtReview,
}));

export const EXPANDED_WORD_VIDEO_IDS = new Set(
  EXPANDED_WORD_VIDEO_EVIDENCE.map((video) => video.youtubeId),
);

export const EXPANDED_WORD_LANGUAGE_FILTERS = [
  ...new Set(EXPANDED_WORD_VIDEO_EVIDENCE.map((video) => video.language)),
].sort((a, b) => a.localeCompare(b));

export const EXPANDED_WORD_COUNTS = {
  total: EXPANDED_WORD_VIDEO_EVIDENCE.length,
  familiar: EXPANDED_WORD_VIDEO_EVIDENCE.filter((video) => video.collectionKind === 'familiar').length,
  native: EXPANDED_WORD_VIDEO_EVIDENCE.filter((video) => video.collectionKind === 'native').length,
  languages: EXPANDED_WORD_LANGUAGE_FILTERS.length,
  familiarSongs: new Set(EXPANDED_WORD_VIDEO_EVIDENCE.flatMap((video) => video.englishTitle ? [video.englishTitle] : [])).size,
} as const;
