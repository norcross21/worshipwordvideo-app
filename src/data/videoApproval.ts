import { MODERN_WORD_VIDEO_IDS } from './modernWordWorshipSongs';
import { EXPANDED_WORD_VIDEO_IDS } from './expandedWordWorshipSongs';
import { RESEARCHED_WORD_VIDEO_IDS as NEW_RESEARCHED_WORD_VIDEO_IDS } from './researchedWordWorshipSongs';

const APPROVED_VIDEOS_KEY = 'liturgy_approved_worship_videos_v1';
const VIDEO_WORDS_KEY = 'liturgy_worship_video_words_v1';

export type VideoWordsStatus = 'words-shown' | 'no-words';

const RESEARCHED_WORD_VIDEO_IDS = [
  'SmqLKr6gF-Q', // Salve Regina, Latin and English text
  '5GrQJGQWfd8', // Veni Creator Spiritus
  'GvBkpCn1cyU', // Victimae paschali laudes
  '0_4WWf9MT9s', // Libera me, Domine
  'icjexnL6rI4', // Orthodox Paschal hymn in English
  'D7AWcPv2zX4', // Agni Parthene, Greek and English words
];

/** True only where the uploader explicitly describes visible lyrics, words or subtitles. */
export function videoTitleIndicatesWords(title: string): boolean {
  return /\b(?:lyrics?|lyric video|with words|words on screen|sing[ -]?along|subtitles?|latin\/english text|congregational words|con letras?|com letras?|paroles|lirik|versuri|napisy)\b|legendad[ao]|subtitulado|sous[- ]?titres?|слова|текст|субтит|كلمات|ترجمة|زیر.?نویس|ترجمه|متن سرود|歌詞|歌词|字幕|가사|자막|lời bài hát|phụ đề/iu.test(title);
}

/** Audited videos whose metadata explicitly identifies visible words. */
export const CATALOGUE_WORD_VIDEO_IDS = new Set([
  ...RESEARCHED_WORD_VIDEO_IDS,
  ...MODERN_WORD_VIDEO_IDS,
  ...EXPANDED_WORD_VIDEO_IDS,
  ...NEW_RESEARCHED_WORD_VIDEO_IDS,
]);

export function getApprovedWorshipVideos(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(APPROVED_VIDEOS_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id)));
  } catch {
    return new Set();
  }
}

export function saveApprovedWorshipVideos(videoIds: ReadonlySet<string>) {
  try {
    localStorage.setItem(APPROVED_VIDEOS_KEY, JSON.stringify([...videoIds].sort()));
  } catch {
    // Approval remains available for the current session when storage is unavailable.
  }
}

export function setWorshipVideoApproved(
  current: ReadonlySet<string>,
  youtubeId: string,
  approved: boolean,
): Set<string> {
  const next = new Set(current);
  if (approved) next.add(youtubeId);
  else next.delete(youtubeId);
  return next;
}

export function getWorshipVideoWords(): Record<string, VideoWordsStatus> {
  try {
    const parsed = JSON.parse(localStorage.getItem(VIDEO_WORDS_KEY) ?? '{}') as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([id, status]) => (
      /^[A-Za-z0-9_-]{11}$/.test(id) && (status === 'words-shown' || status === 'no-words')
    ))) as Record<string, VideoWordsStatus>;
  } catch {
    return {};
  }
}

export function isCatalogueWordVideo(youtubeId: string): boolean {
  return CATALOGUE_WORD_VIDEO_IDS.has(youtubeId);
}

export function effectiveVideoWordsStatus(
  reviews: Record<string, VideoWordsStatus>,
  youtubeId: string,
): VideoWordsStatus | undefined {
  return reviews[youtubeId] ?? (isCatalogueWordVideo(youtubeId) ? 'words-shown' : undefined);
}

export function setWorshipVideoWords(
  current: Record<string, VideoWordsStatus>,
  youtubeId: string,
  status?: VideoWordsStatus,
): Record<string, VideoWordsStatus> {
  const next = { ...current };
  if (status) next[youtubeId] = status;
  else delete next[youtubeId];
  try {
    localStorage.setItem(VIDEO_WORDS_KEY, JSON.stringify(next));
  } catch {
    // The current review still remains available for this session.
  }
  return next;
}
