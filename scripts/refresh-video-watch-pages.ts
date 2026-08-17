import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getFullSongLibrary } from '../src/data/songLibraryStore';
import { canonicaliseSongLanguage } from '../src/data/songLanguage';
import { inferLanguagePresentation, inferWorshipArrangement } from '../src/data/songPresentation';
import { songFamilyForSong } from '../src/data/songFamilies';
import { videoTitleIndicatesWords } from '../src/data/videoApproval';
import { WORSHIP_VIDEO_AUDIT } from '../src/data/worshipVideoAudit';
import type { WorshipSong } from '../src/data/worshipSongs';

const SITE = 'https://www.worshipwordvideo.org';
const OUTPUT_PATH = resolve(process.cwd(), 'src', 'data', 'videoWatchPages.json');
const TOTAL_TARGET = Number(process.env.WATCH_PAGE_TARGET ?? 160);
const ENGLISH_TOTAL_TARGET = Number(process.env.WATCH_PAGE_ENGLISH_TARGET ?? 36);
const MULTILINGUAL_MIN_PER_LANGUAGE = Number(process.env.WATCH_PAGE_LANGUAGE_MIN ?? 2);
const MAX_CANDIDATE_GROUPS = Number(process.env.WATCH_PAGE_MAX_GROUPS ?? 120);
const FETCH_CONCURRENCY = 3;
const REQUEST_TIMEOUT_MS = 20_000;
const VIDEO_BLOCKLIST = new Set([
  // English Sunday 7pm Choir upload misclassified as Sundanese by an older importer.
  'SuUGPniE1D4',
  '-yUuUMFRBds',
  // Wrong language, secular or non-worship false positives found during watch-page review.
  'atb6Y5U3Acw',
  '_RECSoJ8AyE',
  'q10H4dRJxmg',
  'ajRVIh3srXw',
  'fX4dBtLC_8c',
  '1GQ1FM_zoU8',
  'fnAeZNOhWo4',
  'WTJUIYTtLv4',
  'NXfzqgyKP_s',
  'H8GIsW_jVzM',
  'qAmUvXqr7EA',
  'wKZCdt1yqsk',
  'xqXke2lUFFM',
  'bXhe_SAfoYM',
  '2URFFxOrli0',
  'sDVe8P4iVw4',
  'PNrfwr7jFoE',
  'io6U4lUkUnI',
  'yi0M1cXlEks',
  '6KEOabM8CHw',
  'S5aEHzktu-c',
  'RWMOBuwdbG4',
  'NwC6m-abLwY',
  's0sEv6RaHz4',
  '6qvAiqSjNgc',
  'UJzPhkzjqyI',
  'LzsVkJciwfw',
]);

const LANGUAGE_ALIASES: Record<string, string[]> = {
  'Assyrian / Aramaic': ['assyrian', 'aramaic', 'syriac'],
  'Burmese / Myanmar': ['burmese', 'myanmar'],
  'Mandarin Chinese': ['mandarin', 'chinese', '中文', '汉语', '華語'],
  'Persian / Farsi': ['persian', 'farsi', 'فارسی'],
  'Quechua': ['quechua', 'kichwa'],
  'Tagalog / Filipino': ['tagalog', 'filipino'],
  'Ukrainian and Russian (mixed)': ['ukrainian', 'russian'],
};

const LANGUAGE_SCRIPT_PATTERNS: Record<string, RegExp> = {
  Amharic: /[\u1200-\u137f]/,
  Arabic: /[\u0600-\u06ff]/,
  Armenian: /[\u0530-\u058f]/,
  Bengali: /[\u0980-\u09ff]/,
  'Burmese / Myanmar': /[\u1000-\u109f]/,
  Georgian: /[\u10a0-\u10ff]/,
  Gujarati: /[\u0a80-\u0aff]/,
  Hebrew: /[\u0590-\u05ff]/,
  Hindi: /[\u0900-\u097f]/,
  Japanese: /[\u3040-\u30ff]/,
  Kannada: /[\u0c80-\u0cff]/,
  Khmer: /[\u1780-\u17ff]/,
  Korean: /[\uac00-\ud7af]/,
  Lao: /[\u0e80-\u0eff]/,
  Malayalam: /[\u0d00-\u0d7f]/,
  'Mandarin Chinese': /[\u3400-\u9fff]/,
  Marathi: /[\u0900-\u097f]/,
  Nepali: /[\u0900-\u097f]/,
  Odia: /[\u0b00-\u0b7f]/,
  'Persian / Farsi': /[\u0600-\u06ff]/,
  Punjabi: /[\u0a00-\u0a7f]/,
  Sinhala: /[\u0d80-\u0dff]/,
  Tamil: /[\u0b80-\u0bff]/,
  Telugu: /[\u0c00-\u0c7f]/,
  Thai: /[\u0e00-\u0e7f]/,
  Tigrinya: /[\u1200-\u137f]/,
  Urdu: /[\u0600-\u06ff]/,
};

interface VideoWatchPageRecord {
  youtubeId: string;
  path: string;
  catalogueTitle: string;
  videoTitle: string;
  channel: string;
  language: string;
  languageCode: string;
  region?: string;
  arrangement: string;
  presentation: string;
  uploadDate: string;
  durationSeconds: number;
  thumbnailUrl: string;
  familySlug?: string;
  familyTitle?: string;
  checkedAt: string;
}

interface YouTubeMetadata {
  title: string;
  channel: string;
  uploadDate: string;
  durationSeconds: number;
}

function effectiveLanguage(song: WorshipSong): string {
  return song.language && song.language !== 'Language not stated' ? song.language : 'English';
}

function hasWordEvidence(song: WorshipSong): boolean {
  return song.wordsIndicated === true
    || Boolean(song.wordEvidence)
    || videoTitleIndicatesWords(song.title)
    || videoTitleIndicatesWords(WORSHIP_VIDEO_AUDIT[song.youtubeId]?.title ?? '');
}

function looksLikeNonWorshipContent(song: WorshipSong): boolean {
  const identity = `${song.title} ${song.englishTitle ?? ''} ${song.artist} ${song.sourceChannel ?? ''}`.toLowerCase();
  return /\b(sermon|preaching|debate|podcast|testimony|bible study|interview|reaction|tutorial|lesson|documentary|news report)\b/.test(identity);
}

function metadataLooksLikeNonWorshipContent(metadata: YouTubeMetadata): boolean {
  const identity = `${metadata.title} ${metadata.channel}`.toLowerCase();
  return /\b(sermon|preaching|debate|podcast|testimony|bible study|interview|reaction|tutorial|lesson|documentary|news report|slayer|dakinis)\b|\bjesus\s+vs\b|\bmuslim response\b|\bworld metal\b/.test(identity);
}

function metadataSupportsLanguage(song: WorshipSong, metadata: YouTubeMetadata): boolean {
  const language = effectiveLanguage(song);
  if (language === 'English') return true;
  const title = metadata.title.toLocaleLowerCase('en-GB');
  const aliases = LANGUAGE_ALIASES[language]
    ?? language.split(/\s*\/\s*|\s+and\s+|\s*\([^)]*\)\s*/i).map((value) => value.trim()).filter(Boolean);
  const named = aliases.some((alias) => {
    const lowered = alias.toLocaleLowerCase('en-GB');
    if (!/^[a-z\s-]+$/.test(lowered)) return title.includes(lowered);
    const escaped = lowered.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^a-z])${escaped}(?:$|[^a-z])`, 'i').test(title);
  });
  return named || Boolean(LANGUAGE_SCRIPT_PATTERNS[language]?.test(metadata.title));
}

function conservativePresentationForTitle(language: string, titleValue: string, englishFallback: string): string {
  if (language === 'English') return englishFallback;
  const title = titleValue.toLocaleLowerCase('en-GB');
  if (/\b(bilingual|two languages)\b/.test(title)) return 'Bilingual vocal or subtitles';
  if (/english\s*(?:&|and|\+)\s*[^|()]{1,30}\s*(?:subtitles|lyrics|translation)/i.test(titleValue)) return 'Bilingual vocal or subtitles';
  if (/\b(?:with\s+)?english\s+(?:subtitles|translation|lyrics)\b|\btranslated\s+(?:into|to)\s+english\b/i.test(titleValue)) return 'Native-language vocal with English subtitles';
  return 'Words or subtitles indicated';
}

function conservativePresentation(song: WorshipSong, metadata: YouTubeMetadata): string {
  return conservativePresentationForTitle(effectiveLanguage(song), metadata.title, inferLanguagePresentation(song));
}

function score(song: WorshipSong): number {
  const audit = WORSHIP_VIDEO_AUDIT[song.youtubeId];
  const family = songFamilyForSong(song);
  const identity = `${song.title} ${song.sourceChannel ?? song.artist}`.toLowerCase();
  const presentation = inferLanguagePresentation(song);
  return (song.ccliUkRank ? 9_000 - song.ccliUkRank * 40 : 0)
    + (family ? 4_000 : 0)
    + (song.catalogueReview ? 1_500 : 0)
    + (song.metadataConfidence === 'Uploader-stated' ? 900 : 0)
    + (audit?.available === true && audit.embeddable === true ? 1_200 : 0)
    + (presentation.includes('English subtitles') ? 1_000 : 0)
    + (presentation.includes('translated subtitles') ? 850 : 0)
    + (song.viewCountAtReview ? Math.min(1_200, Math.log10(song.viewCountAtReview + 1) * 180) : 0)
    + (/official|ministry|worship|church|vevo/.test(identity) ? 500 : 0)
    + ((song.durationSeconds ?? audit?.durationSeconds ?? 0) >= 120 ? 200 : 0);
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function decodeJsonString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return undefined;
  }
}

function extractJsonString(source: string, property: string): string | undefined {
  const match = source.match(new RegExp(`"${property}":"((?:\\\\.|[^"\\\\])*)"`));
  return decodeJsonString(match?.[1]);
}

async function fetchYouTubeMetadata(youtubeId: string): Promise<YouTubeMetadata | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}&hl=en`, {
      headers: {
        'Accept-Language': 'en-GB,en;q=0.9',
        'User-Agent': `Mozilla/5.0 (compatible; WorshipWordVideo/1.0; +${SITE})`,
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const html = await response.text();
    if (!/"playabilityStatus":\{"status":"OK"/.test(html)) return null;
    if (!/"playableInEmbed":true/.test(html)) return null;

    const detailsStart = html.indexOf('"videoDetails":');
    const details = detailsStart >= 0 ? html.slice(detailsStart, detailsStart + 80_000) : html;
    const title = extractJsonString(details, 'title');
    const channel = extractJsonString(details, 'ownerChannelName');
    const uploadDate = extractJsonString(details, 'uploadDate') ?? extractJsonString(html, 'uploadDate');
    const durationSeconds = Number(extractJsonString(details, 'lengthSeconds'));
    if (!title || !channel || !uploadDate || !Number.isFinite(durationSeconds) || durationSeconds < 30) return null;
    if (!/^\d{4}-\d{2}-\d{2}T/.test(uploadDate)) return null;
    return { title, channel, uploadDate, durationSeconds };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithLimit<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, items.length) }, run));
  return results;
}

function toRecord(song: WorshipSong, metadata: YouTubeMetadata): VideoWatchPageRecord {
  const family = songFamilyForSong(song);
  const language = effectiveLanguage(song);
  const catalogueTitle = family?.title ?? song.englishTitle ?? song.title;
  const idSuffix = song.youtubeId.replace(/[^A-Za-z0-9]/g, '').slice(-8).toLowerCase();
  const routeSlug = `${slugify(`${catalogueTitle} ${language}`) || slugify(language)}-${idSuffix}`;
  return {
    youtubeId: song.youtubeId,
    path: `/videos/${routeSlug}/`,
    catalogueTitle,
    videoTitle: metadata.title,
    channel: metadata.channel,
    language,
    languageCode: song.languageCode ?? (language === 'English' ? 'en' : 'und'),
    region: song.region,
    arrangement: inferWorshipArrangement(song),
    presentation: conservativePresentation(song, metadata),
    uploadDate: metadata.uploadDate,
    durationSeconds: metadata.durationSeconds,
    thumbnailUrl: `https://i.ytimg.com/vi/${song.youtubeId}/hqdefault.jpg`,
    familySlug: family?.slug,
    familyTitle: family?.title,
    checkedAt: new Date().toISOString().slice(0, 10),
  };
}

async function firstPlayable(candidates: WorshipSong[]): Promise<VideoWatchPageRecord | null> {
  for (const song of candidates.slice(0, 4)) {
    const metadata = await fetchYouTubeMetadata(song.youtubeId);
    if (metadata && !metadataLooksLikeNonWorshipContent(metadata) && metadataSupportsLanguage(song, metadata)) return toRecord(song, metadata);
  }
  return null;
}

async function readExistingRecords(): Promise<VideoWatchPageRecord[]> {
  try {
    const parsed = JSON.parse(await readFile(OUTPUT_PATH, 'utf8')) as VideoWatchPageRecord[];
    return Array.isArray(parsed)
      ? parsed
        .filter((record) => !VIDEO_BLOCKLIST.has(record.youtubeId))
        .map((record) => record.checkedAt === new Date().toISOString().slice(0, 10)
          ? {
            ...record,
            presentation: conservativePresentationForTitle(record.language, record.videoTitle, record.presentation),
          }
          : record)
      : [];
  } catch {
    return [];
  }
}

async function refresh(): Promise<void> {
  const existingRecords = await readExistingRecords();
  const existingIds = new Set(existingRecords.map((record) => record.youtubeId));
  const songs = getFullSongLibrary()
    .map(canonicaliseSongLanguage)
    .filter((song) => /^[A-Za-z0-9_-]{11}$/.test(song.youtubeId))
    .filter((song) => !VIDEO_BLOCKLIST.has(song.youtubeId))
    .filter((song) => !existingIds.has(song.youtubeId))
    .filter(hasWordEvidence)
    .filter((song) => !looksLikeNonWorshipContent(song))
    .filter((song) => {
      const audit = WORSHIP_VIDEO_AUDIT[song.youtubeId];
      return audit?.available !== false && audit?.embeddable !== false;
    })
    .filter((song) => {
      const duration = song.durationSeconds ?? WORSHIP_VIDEO_AUDIT[song.youtubeId]?.durationSeconds ?? 0;
      return duration === 0 || (duration >= 90 && duration <= 900);
    });

  const uniqueSongs = [...new Map(songs.map((song) => [song.youtubeId, song])).values()];
  const sorted = uniqueSongs.sort((left, right) => score(right) - score(left) || left.title.localeCompare(right.title));
  const byLanguage = new Map<string, WorshipSong[]>();
  for (const song of sorted) {
    const language = effectiveLanguage(song);
    if (language === 'English') continue;
    const group = byLanguage.get(language) ?? [];
    group.push(song);
    byLanguage.set(language, group);
  }
  const existingLanguageCounts = new Map<string, number>();
  for (const record of existingRecords) {
    existingLanguageCounts.set(record.language, (existingLanguageCounts.get(record.language) ?? 0) + 1);
  }
  const claimedCandidateIds = new Set<string>();
  const candidateGroups: WorshipSong[][] = [];
  const addCandidateGroup = (candidates: WorshipSong[], limit = 4) => {
    const group = candidates
      .filter((song) => !claimedCandidateIds.has(song.youtubeId))
      .slice(0, limit);
    if (!group.length) return;
    group.forEach((song) => claimedCandidateIds.add(song.youtubeId));
    candidateGroups.push(group);
  };

  const multilingualLanguages = [...byLanguage.entries()]
    .sort((left, right) => {
      const leftCount = existingLanguageCounts.get(left[0]) ?? 0;
      const rightCount = existingLanguageCounts.get(right[0]) ?? 0;
      return leftCount - rightCount || right[1].length - left[1].length || left[0].localeCompare(right[0]);
    });

  // First represent languages that do not yet have a dedicated watch page.
  multilingualLanguages
    .filter(([language]) => (existingLanguageCounts.get(language) ?? 0) === 0)
    .forEach(([, candidates]) => addCandidateGroup(candidates));

  // Then deepen smaller language collections to at least two verified pages.
  multilingualLanguages
    .filter(([language]) => (existingLanguageCounts.get(language) ?? 0) > 0 && (existingLanguageCounts.get(language) ?? 0) < MULTILINGUAL_MIN_PER_LANGUAGE)
    .forEach(([, candidates]) => addCandidateGroup(candidates));

  // Add distinct familiar English songs without replacing the already verified set.
  const existingEnglishFamilies = new Set(existingRecords.filter((record) => record.language === 'English').map((record) => record.familySlug).filter(Boolean));
  const englishCandidates = sorted.filter((song) => effectiveLanguage(song) === 'English');
  const newEnglishFamilies = new Set<string>();
  for (const song of englishCandidates) {
    const family = songFamilyForSong(song);
    if (!family || existingEnglishFamilies.has(family.slug) || newEnglishFamilies.has(family.slug)) continue;
    newEnglishFamilies.add(family.slug);
    addCandidateGroup([song]);
    if ((existingLanguageCounts.get('English') ?? 0) + newEnglishFamilies.size >= ENGLISH_TOTAL_TARGET) break;
  }

  // Finally add another strong candidate per multilingual language, then global high-scoring fallbacks.
  multilingualLanguages.forEach(([, candidates]) => addCandidateGroup(candidates));
  sorted.filter((song) => effectiveLanguage(song) !== 'English').forEach((song) => addCandidateGroup([song], 1));

  const needed = Math.max(0, TOTAL_TARGET - existingRecords.length);
  const attemptedGroups = candidateGroups.slice(0, MAX_CANDIDATE_GROUPS);
  const additions = (await mapWithLimit(attemptedGroups, firstPlayable))
    .filter((record): record is VideoWatchPageRecord => Boolean(record))
    .filter((record) => !existingIds.has(record.youtubeId))
    .slice(0, needed);
  const records = [...existingRecords, ...additions]
    .sort((left, right) => left.language.localeCompare(right.language) || left.catalogueTitle.localeCompare(right.catalogueTitle));

  if (records.length < 48) {
    throw new Error(`Only ${records.length} verified, embeddable watch-page videos were found; expected at least 48.`);
  }
  if (new Set(records.map((record) => record.youtubeId)).size !== records.length) {
    throw new Error('Duplicate YouTube IDs found in watch-page records.');
  }
  if (new Set(records.map((record) => record.path)).size !== records.length) {
    throw new Error('Duplicate watch-page paths found.');
  }

  await mkdir(resolve(OUTPUT_PATH, '..'), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    watchPages: records.length,
    retained: existingRecords.length,
    added: additions.length,
    attemptedGroups: attemptedGroups.length,
    english: records.filter((record) => record.language === 'English').length,
    multilingual: records.filter((record) => record.language !== 'English').length,
    languages: new Set(records.map((record) => record.language)).size,
    output: OUTPUT_PATH,
  }, null, 2));
}

await refresh();
