import type { WorshipSong } from './worshipSongs';
import modernWordVideoRows from './modernWordWorshipVideos.json';

export type ModernWordEvidence =
  | 'lyrics'
  | 'words'
  | 'subtitles'
  | 'Spanish words'
  | 'Portuguese words'
  | 'French words'
  | 'Indonesian words'
  | 'Romanian words'
  | 'Polish words'
  | 'Slavic words'
  | 'Arabic words'
  | 'Farsi words'
  | 'Chinese words'
  | 'Korean words'
  | 'Japanese words'
  | 'Vietnamese words'
  | 'Swahili words';

type ModernWordVideoRow = [
  youtubeId: string,
  sourceTitle: string,
  sourceChannel: string,
  language: string,
  languageCode: string,
  region: string,
  englishTitle: string,
  wordEvidence: ModernWordEvidence,
  durationSeconds: number,
  viewCountAtReview: number,
  alreadyInCatalogue: boolean,
  checkedOn: string,
];

const rows = modernWordVideoRows as unknown as ModernWordVideoRow[];

/**
 * Exact YouTube videos whose own title identifies lyrics, visible words or
 * subtitles. Every row also passed a fresh YouTube metadata/embed check.
 */
export const MODERN_WORD_VIDEO_EVIDENCE = rows.map(([
  youtubeId,
  sourceTitle,
  sourceChannel,
  language,
  languageCode,
  region,
  englishTitle,
  wordEvidence,
  durationSeconds,
  viewCountAtReview,
  alreadyInCatalogue,
  checkedOn,
]) => ({
  youtubeId,
  sourceTitle,
  sourceChannel,
  language,
  languageCode,
  region,
  englishTitle,
  wordEvidence,
  durationSeconds,
  viewCountAtReview,
  alreadyInCatalogue,
  checkedOn,
}));

/** New catalogue entries; matching videos already present elsewhere are not duplicated. */
export const MODERN_WORD_WORSHIP_SONGS: WorshipSong[] = MODERN_WORD_VIDEO_EVIDENCE
  .filter((video) => !video.alreadyInCatalogue)
  .map((video, index) => ({
    id: `modern-words-${String(index + 1).padStart(4, '0')}`,
    title: video.sourceTitle,
    englishTitle: video.englishTitle,
    artist: video.sourceChannel,
    category: 'Contemporary worship',
    youtubeId: video.youtubeId,
    language: video.language,
    languageCode: video.languageCode,
    region: video.region,
    searchAliases: [
      video.englishTitle,
      `${video.englishTitle} ${video.language}`,
      `${video.language} lyrics subtitles words`,
      video.wordEvidence,
    ],
    sourceChannel: video.sourceChannel,
    versionType: 'Modern word / subtitle video',
    catalogueReview: 'Word evidence and embed checked',
    wordEvidence: video.wordEvidence,
    qualityCheckedOn: video.checkedOn,
    durationSeconds: video.durationSeconds,
    viewCountAtReview: video.viewCountAtReview,
  }));

export const MODERN_WORD_VIDEO_IDS = new Set(
  MODERN_WORD_VIDEO_EVIDENCE.map((video) => video.youtubeId),
);

export const MODERN_WORD_COUNTS = {
  evidenceVideos: MODERN_WORD_VIDEO_EVIDENCE.length,
  newVideos: MODERN_WORD_WORSHIP_SONGS.length,
  languages: new Set(MODERN_WORD_VIDEO_EVIDENCE.map((video) => video.language)).size,
  familiarSongs: new Set(MODERN_WORD_VIDEO_EVIDENCE.map((video) => video.englishTitle)).size,
} as const;
