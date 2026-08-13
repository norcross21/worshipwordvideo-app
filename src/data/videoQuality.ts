import type { WorshipSong } from './worshipSongs';
import { WORSHIP_VIDEO_AUDIT } from './worshipVideoAudit';
import { videoTitleIndicatesWords } from './videoApproval';

export type VideoQualityLevel = 'strong' | 'check' | 'long' | 'unavailable' | 'unchecked';

export interface VideoQualityAssessment {
  level: VideoQualityLevel;
  label: string;
  detail: string;
  duration?: string;
  channel?: string;
}

const NON_WORSHIP_PROGRAMME = /\b(?:sermons?|debates?|podcasts?|interviews?|bible stud(?:y|ies)|documentar(?:y|ies)|apologetics|q\s*&\s*a|questions? and answers?|lectures?|baptism testimon(?:y|ies)|christian testimon(?:y|ies)|news reports?|worship tutorials?|how to play)\b/i;
const FALSE_POSITIVE_TITLE = /\btalk talk\s*[-–—]\s*it'?s my life\b/i;
const NON_WORSHIP_WORD_VIDEO = /\b(?:scripture reading|bible reading|psalm \d+ reading|spoken word|devotional|meditation|affirmation|prayer for|birthday song|national anthem|school song|military hymn|the marines.? hymn|hymn for the weekend|jingle bells|rudolph|frosty|santa|holly jolly|let it snow|bhakti|shiva|krishna|krishana|vishnu|quran|nasheed|naat|bollywood|romantic song|love song|movie soundtrack|film song|god gave me you|there you.ll be|jesus,? take the wheel|something in the water|god.s country|praise jah in the moonlight|praise to the man|500 miles|rahman baba|sacred madness|allah loves praise|am i god|church of almighty god|ai[- ]generated|ai\s+(?:cover|rumba|gospel|worship|christian|music|lyric)|ai\s+20\d{2}|lyrics? video ai|suno|created with ai|lyrics? in (?:the )?description|lyrics? below|audio only|without words|lds primary|latter[- ]day saints?|lds|hindu goddess|hindu temple|buddhist worship|oh buddha|long black train|how to interpret scriptures|decision vs commitment|deliverance from sin|paul washer|what jesus said about muhammad|syrian kurds open first church|jesus calls and sends 12 apostles|present your bodies as a living sacrifice|love story lyrics and chords|seri makhluk[- ]makhluk rohani|papal regina coeli|angelus|the gospel truth i[-–—]ii[-–—]iii|take me home,? country roads|the savior arabic with italian subtitles)\b|la luce di ges[uù].*mellifluous|jesus\W+samoan translation\W+part|\bneed god\??\s*(?:\||$)|bah[aá][’'i]|abdu.?l[- ]bah[aá]|全能神教会|全能神教會/i;
const NON_WORSHIP_CHANNEL = /\b(?:worship jamz|szabo music|worship rehearsal videos|top gospel mix|christian love songs|almightygod|almighty god church|efy karaoke|islamic naat|buddhist worship|hari priya positivity|divineechoes|modern tunes|ai ncm zone|ai gospel music|the bible with ai|account appena hackerato|sportskillers tv|jr videos|ern3sto|god lyrics)\b|ang iglesia ng makapangyarihang diyos|ibandla likankulunkulu usomandla|god.?s words/i;
const SECULAR_FALSE_POSITIVE = /(?:drake.*god.?s plan|god.?s plan.*drake|hozier.*take me to church|take me to church.*hozier|ghost.*mary on a cross|mary on a cross.*ghost|ariana grande.*god is a woman|god is a woman.*ariana grande|tupac.*only god can judge me|only god can judge me.*tupac|christian nodal|christian french|rotting christ|sabaton.*gott mit uns|gott mit uns.*sabaton|gott erhalte.*(?:austria|kaiser|franz|imperial|anthem)|we are the world|morgan wallen.*man made a bar|man made a bar.*morgan wallen|anti[- ]flag.*christian nationalist|christian nationalist.*anti[- ]flag|(?:a7x|avenged sevenfold).*dear god|dear god.*(?:a7x|avenged sevenfold)|amber run.*worship|worship.*amber run|laces.*worship|worship.*laces|lord huron.*the night we met|the night we met.*lord huron|don williams.*lord,? i hope this day is good|lord,? i hope this day is good.*don williams|aaron lewis.*everybody talks to god|everybody talks to god.*aaron lewis|red clay strays.*god does|god does.*red clay strays|genghis khan|taylor swift.*love story|march of the templars)/i;
const AMBIGUOUS_SPOKEN_PROGRAMME = /\b(?:film|testimon(?:y|ies)|gospel video|gospel message|christian message|my story with god)\b/i;
const EXPLICIT_MUSIC_TITLE = /\b(?:song|music|hymn|psalm|chant|karaoke|choir|lyrics?|lyric video|sing[ -]?along)\b|песн|пісн|суруд|ترنيمة|تسبيح|찬양|예배|歌詞|歌词|賛美|礼拝|เพลง|आराधना|উপাসনা|ஆராதனை|ఆరాధన|ആരാധന/i;

/**
 * The public catalogue only contains playable, service-length worship videos.
 * Automated discoveries must also contain clear word/subtitle evidence and are
 * rejected when their metadata identifies preaching, debate or another spoken
 * programme rather than congregational song.
 */
export function isUsableWorshipVideoListing(song: WorshipSong): boolean {
  if (!/^[A-Za-z0-9_-]{11}$/.test(song.youtubeId?.trim() ?? '')) return false;
  const audit = WORSHIP_VIDEO_AUDIT[song.youtubeId];
  if (audit && (!audit.available || audit.embeddable === false)) return false;

  const metadata = [song.title, song.artist, song.sourceChannel, audit?.title, audit?.channel].filter(Boolean).join(' ');
  if (NON_WORSHIP_PROGRAMME.test(metadata) || NON_WORSHIP_WORD_VIDEO.test(metadata) || NON_WORSHIP_CHANNEL.test(metadata) || SECULAR_FALSE_POSITIVE.test(metadata) || FALSE_POSITIVE_TITLE.test(metadata)) return false;
  if (AMBIGUOUS_SPOKEN_PROGRAMME.test(song.title) && !EXPLICIT_MUSIC_TITLE.test(song.title)) return false;
  if (/carrie underwood\s*[-–—]\s*church bells|the star\s*[-–—]\s*mariah carey|mariah carey.*the star|celine dion.*(?:wonderful jesus|living god)/i.test(metadata)) return false;
  if (song.language === 'French' && /\baustin french\b/i.test(metadata)) return false;
  if (/\bpreaching\b/i.test(metadata) && !/\b(?:song|hymn|lyrics?|worship music)\b/i.test(metadata)) return false;
  if (/\bconference\s*20\d{2}\b/i.test(song.title) && !/\b(?:song|hymn|lyrics?|lyric video|worship|praise)\b/i.test(song.title)) return false;

  const duration = song.durationSeconds ?? audit?.durationSeconds;
  if (duration != null && (duration < 45 || duration > 15 * 60)) return false;

  if (song.catalogueReview) {
    const wordsAreEvidenced = song.wordsIndicated === true
      || Boolean(song.wordEvidence)
      || videoTitleIndicatesWords(song.title)
      || videoTitleIndicatesWords(audit?.title ?? '')
      || /lyrics?|words|subtitles?|translation/i.test(song.versionType ?? '');
    if (!wordsAreEvidenced) return false;
  }

  return true;
}

const STOP_WORDS = new Set(['a', 'an', 'and', 'for', 'from', 'in', 'is', 'my', 'of', 'o', 'our', 'the', 'to', 'we', 'with', 'you', 'your']);

function words(value: string): string[] {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(?:official|audio|video|lyrics?|lyric video|live|hd)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

export function titleMatchScore(songTitle: string, videoTitle: string): number {
  const actual = new Set(words(videoTitle));
  const variants = [
    songTitle,
    songTitle.replace(/\([^)]*\)/g, ' '),
    ...[...songTitle.matchAll(/\(([^)]*)\)/g)].map((match) => match[1]),
  ];
  return Math.max(0, ...variants.map((variant) => {
    const expected = words(variant);
    return expected.length ? expected.filter((word) => actual.has(word)).length / expected.length : 0;
  }));
}

export function formatVideoDuration(seconds?: number): string | undefined {
  if (seconds == null || !Number.isFinite(seconds)) return undefined;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
    : `${minutes}:${String(remaining).padStart(2, '0')}`;
}

export function assessWorshipVideo(
  song: Pick<WorshipSong, 'title' | 'youtubeId'>,
  manuallyApproved = false,
): VideoQualityAssessment {
  if (!song.youtubeId) {
    return { level: 'unchecked', label: 'No video', detail: 'No YouTube video is linked.' };
  }

  const audit = WORSHIP_VIDEO_AUDIT[song.youtubeId];
  if (!audit || audit.auditError) {
    return { level: 'unchecked', label: 'Not yet checked', detail: 'Preview this video before using it in a service.' };
  }
  if (!audit.available || audit.embeddable === false) {
    return {
      level: 'unavailable',
      label: audit.available ? 'YouTube only' : 'Unavailable',
      detail: audit.available
        ? 'The uploader does not allow this video to play inside the app.'
        : 'This video was unavailable during the latest catalogue check.',
      duration: formatVideoDuration(audit.durationSeconds),
      channel: audit.channel,
    };
  }

  const duration = formatVideoDuration(audit.durationSeconds);
  if (manuallyApproved) {
    return {
      level: 'strong',
      label: 'Approved by you',
      detail: 'You previewed this exact video and marked it as good for your service use.',
      duration,
      channel: audit.channel,
    };
  }
  const isLong = (audit.durationSeconds ?? 0) >= 15 * 60
    || /\b(?:full album|compilation|one hour|1 hour|continuous|playlist|medley)\b/i.test(audit.title ?? '');
  if (isLong) {
    return {
      level: 'long',
      label: 'Long or compilation',
      detail: 'This may contain several songs or extended repetition. Choose a shorter single-song version for a service.',
      duration,
      channel: audit.channel,
    };
  }

  const score = titleMatchScore(song.title, audit.title ?? '');
  const normalLength = (audit.durationSeconds ?? 0) >= 45 && (audit.durationSeconds ?? 0) <= 12 * 60;
  if (score >= 0.75 && normalLength) {
    return {
      level: 'strong',
      label: 'Strong title match',
      detail: 'The title and length look suitable. Still preview the whole video and confirm permission before the service.',
      duration,
      channel: audit.channel,
    };
  }

  return {
    level: 'check',
    label: 'Check before service',
    detail: !audit.durationSeconds
      ? 'The link and title were found, but the running time could not be checked automatically. Preview it before the service.'
      : score < 0.75
      ? 'The YouTube title does not closely match the catalogue title.'
      : 'The video is unusually short or long for a congregational song.',
    duration,
    channel: audit.channel,
  };
}
