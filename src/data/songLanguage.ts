import type { WorshipSong } from './worshipSongs';

const LANGUAGE_ALIASES: Record<string, string> = {
  Burmese: 'Burmese / Myanmar',
  Farsi: 'Persian / Farsi',
  Persian: 'Persian / Farsi',
  Filipino: 'Tagalog / Filipino',
  Tagalog: 'Tagalog / Filipino',
  'Ukrainian / Russian': 'Ukrainian and Russian (mixed)',
  'Urdu / Punjabi': 'Urdu and Punjabi (mixed)',
};

/** Keep equivalent language names together without guessing ambiguous metadata. */
export function canonicalLanguageName(language?: string): string {
  const value = language?.trim() || 'English';
  return LANGUAGE_ALIASES[value] ?? value;
}

export function canonicaliseSongLanguage(song: WorshipSong): WorshipSong {
  const language = canonicalLanguageName(song.language);
  if (language === (song.language ?? 'English')) return song;
  return { ...song, language };
}

