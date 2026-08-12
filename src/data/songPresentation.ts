import type { LanguagePresentation, WorshipArrangement, WorshipSong } from './worshipSongs';

export const WORSHIP_ARRANGEMENTS: WorshipArrangement[] = [
  'Contemporary worship',
  'Live worship',
  'Choir / choral',
  'Gospel',
  'Country / bluegrass',
  'Acoustic / unplugged',
  'Traditional hymn',
  'Children / family',
  'A cappella',
  'Orchestral / instrumental',
  'Chant / liturgical',
  'Arrangement not stated',
];

export const LANGUAGE_PRESENTATIONS: LanguagePresentation[] = [
  'English vocal with English words',
  'English vocal with translated subtitles',
  'Native-language vocal with English subtitles',
  'Native-language vocal with native words',
  'Bilingual vocal or subtitles',
  'Words or subtitles indicated',
];

const ENGLISH_SUBTITLE_PATTERN = /english\s+(subtitles?|captions?|translation|lyrics?|words)|eng\s*sub|subtitled\s+in\s+english/i;
const BILINGUAL_PATTERN = /bilingual|two languages|dual language|english\s*(?:and|[+/&])\s*\p{L}+|\p{L}+\s*(?:and|[+/&])\s*english/iu;
const TRANSLATED_SUBTITLE_PATTERN = /translated|translation|subtitles?|captions?|subtitulado|legendado|sous[- ]titres|untertitel|napisy|tekst|terjemahan|traduction|tradu[cç][aã]o|traducci[oó]n|t[lł]umaczenie|перевод|z[eé]r[eé]n[eê]vis|ترجمة|ترجمه|زیرنویس|مترجم|번역|자막|翻訳|翻译|字幕/i;

export function inferWorshipArrangement(song: Pick<WorshipSong, 'arrangement' | 'title' | 'artist' | 'category' | 'tune'>): WorshipArrangement {
  if (song.arrangement) return song.arrangement;
  const identity = `${song.title} ${song.artist} ${song.tune ?? ''}`.toLowerCase();
  if (/a\s*cappella|acapella|unaccompanied/.test(identity)) return 'A cappella';
  if (/country|bluegrass|southern gospel|nashville/.test(identity)) return 'Country / bluegrass';
  if (/choir|choral|chorale|chorus|schola|cantorei|cantata/.test(identity)) return 'Choir / choral';
  if (/acoustic|unplugged|piano only|guitar only/.test(identity)) return 'Acoustic / unplugged';
  if (/orchestra|orchestral|symphon|instrumental/.test(identity)) return 'Orchestral / instrumental';
  if (/children|kids|family worship|school worship/.test(identity)) return 'Children / family';
  if (/gregorian|chant|taiz[eé]|byzantine|liturgy|liturgical/.test(identity)) return 'Chant / liturgical';
  if (/gospel|spiritual|gaither/.test(identity) || song.category === 'Gospel and spiritual') return 'Gospel';
  if (/\blive\b|concert|worship night|conference/.test(identity)) return 'Live worship';
  if (/hymn|organ|traditional/.test(identity) || /Traditional [Hh]ymn/.test(song.category)) return 'Traditional hymn';
  if (/Contemporary [Ww]orship/.test(song.category)) return 'Contemporary worship';
  return 'Arrangement not stated';
}

export function inferLanguagePresentation(song: Pick<WorshipSong, 'languagePresentation' | 'language' | 'versionType' | 'title' | 'wordEvidence'>): LanguagePresentation {
  if (song.languagePresentation) return song.languagePresentation;
  const language = song.language ?? 'English';
  const evidence = `${song.title} ${song.wordEvidence ?? ''}`;
  const isEnglish = language.toLowerCase() === 'english';

  if (BILINGUAL_PATTERN.test(evidence)) return 'Bilingual vocal or subtitles';
  if (!isEnglish && ENGLISH_SUBTITLE_PATTERN.test(evidence)) return 'Native-language vocal with English subtitles';
  if (!isEnglish && song.versionType === 'Farsi translation / subtitles') return 'English vocal with translated subtitles';
  if (!isEnglish && TRANSLATED_SUBTITLE_PATTERN.test(evidence) && /english|original|translation|translated|terjemahan|traduction|tradu[cç][aã]o|traducci[oó]n|t[lł]umaczenie|перевод|ترجمة|ترجمه|번역|翻訳|翻译/i.test(evidence)) {
    return 'English vocal with translated subtitles';
  }
  if (!isEnglish && (
    song.versionType === 'Farsi vocal'
    || song.versionType === 'Native-language worship'
    || song.versionType === 'Familiar-song language version'
    || /lyrics?|words|letra|paroles|текст|слова|كلمات|가사|歌詞|歌词|lời bài hát/i.test(evidence)
  )) return 'Native-language vocal with native words';
  if (isEnglish && /lyrics?|words|subtitles?|captions?/i.test(evidence)) return 'English vocal with English words';
  return 'Words or subtitles indicated';
}

export function enrichSongPresentation(song: WorshipSong): WorshipSong {
  const arrangement = inferWorshipArrangement(song);
  const languagePresentation = inferLanguagePresentation(song);
  return {
    ...song,
    arrangement,
    languagePresentation,
    metadataConfidence: song.metadataConfidence ?? 'Catalogue-inferred',
  };
}

export function shortPresentationLabel(presentation: LanguagePresentation): string {
  switch (presentation) {
    case 'English vocal with English words': return 'English vocal + words';
    case 'English vocal with translated subtitles': return 'English vocal + translated subtitles';
    case 'Native-language vocal with English subtitles': return 'Native vocal + English subtitles';
    case 'Native-language vocal with native words': return 'Native vocal + native words';
    case 'Bilingual vocal or subtitles': return 'Bilingual';
    default: return 'Words / subtitles indicated';
  }
}
