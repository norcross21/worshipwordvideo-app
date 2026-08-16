import { mkdir, writeFile } from 'node:fs/promises';
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
const ENGLISH_TARGET = 24;
const MULTILINGUAL_TARGET = 40;
const FETCH_CONCURRENCY = 6;
const REQUEST_TIMEOUT_MS = 20_000;
const VIDEO_BLOCKLIST = new Set([
  // English Sunday 7pm Choir upload misclassified as Sundanese by an older importer.
  'SuUGPniE1D4',
]);

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
    presentation: inferLanguagePresentation(song),
    uploadDate: metadata.uploadDate,
    durationSeconds: metadata.durationSeconds,
    thumbnailUrl: `https://i.ytimg.com/vi/${song.youtubeId}/hqdefault.jpg`,
    familySlug: family?.slug,
    familyTitle: family?.title,
    checkedAt: new Date().toISOString().slice(0, 10),
  };
}

async function firstPlayable(candidates: WorshipSong[]): Promise<VideoWatchPageRecord | null> {
  for (const song of candidates.slice(0, 6)) {
    const metadata = await fetchYouTubeMetadata(song.youtubeId);
    if (metadata) return toRecord(song, metadata);
  }
  return null;
}

async function refresh(): Promise<void> {
  const songs = getFullSongLibrary()
    .map(canonicaliseSongLanguage)
    .filter((song) => /^[A-Za-z0-9_-]{11}$/.test(song.youtubeId))
    .filter((song) => !VIDEO_BLOCKLIST.has(song.youtubeId))
    .filter(hasWordEvidence)
    .filter((song) => {
      const duration = song.durationSeconds ?? WORSHIP_VIDEO_AUDIT[song.youtubeId]?.durationSeconds ?? 0;
      return duration === 0 || (duration >= 90 && duration <= 900);
    });

  const uniqueSongs = [...new Map(songs.map((song) => [song.youtubeId, song])).values()];
  const sorted = uniqueSongs.sort((left, right) => score(right) - score(left) || left.title.localeCompare(right.title));
  const englishCandidates = sorted.filter((song) => effectiveLanguage(song) === 'English');
  const englishFamilies = new Set<string>();
  const englishGroups = englishCandidates
    .filter((song) => {
      const family = songFamilyForSong(song);
      if (!family || englishFamilies.has(family.slug)) return false;
      englishFamilies.add(family.slug);
      return true;
    })
    .slice(0, ENGLISH_TARGET * 2)
    .map((song) => [song]);

  const byLanguage = new Map<string, WorshipSong[]>();
  for (const song of sorted) {
    const language = effectiveLanguage(song);
    if (language === 'English') continue;
    const group = byLanguage.get(language) ?? [];
    group.push(song);
    byLanguage.set(language, group);
  }
  const multilingualGroups = [...byLanguage.entries()]
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
    .slice(0, MULTILINGUAL_TARGET)
    .map(([, candidates]) => candidates);

  const englishResults = (await mapWithLimit(englishGroups, firstPlayable))
    .filter((record): record is VideoWatchPageRecord => Boolean(record))
    .slice(0, ENGLISH_TARGET);
  const multilingualResults = (await mapWithLimit(multilingualGroups, firstPlayable))
    .filter((record): record is VideoWatchPageRecord => Boolean(record))
    .slice(0, MULTILINGUAL_TARGET);
  const records = [...englishResults, ...multilingualResults]
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
    english: englishResults.length,
    multilingual: multilingualResults.length,
    languages: new Set(records.map((record) => record.language)).size,
    output: OUTPUT_PATH,
  }, null, 2));
}

await refresh();
