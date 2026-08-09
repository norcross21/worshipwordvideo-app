import type { WorshipSong } from './worshipSongs';
import { FARSI_WORSHIP_SONGS } from './farsiWorshipSongs';
import { GLOBAL_LANGUAGE_FILTERS, GLOBAL_WORSHIP_SONGS } from './globalWorshipSongs';
import { KNOWN_TRANSLATED_WORSHIP_SONGS } from './knownTranslatedWorshipSongs';
import { MODERN_WORD_WORSHIP_SONGS } from './modernWordWorshipSongs';
import { EXPANDED_WORD_LANGUAGE_FILTERS, EXPANDED_WORD_WORSHIP_SONGS } from './expandedWordWorshipSongs';
import { RESEARCHED_WORD_LANGUAGE_FILTERS, RESEARCHED_WORD_WORSHIP_SONGS } from './researchedWordWorshipSongs';

/** Source-checked international starter collection. No lyrics are copied. */
export const INTERNATIONAL_WORSHIP_SONGS: WorshipSong[] = [
  ...EXPANDED_WORD_WORSHIP_SONGS,
  ...RESEARCHED_WORD_WORSHIP_SONGS,
  ...MODERN_WORD_WORSHIP_SONGS,
  ...FARSI_WORSHIP_SONGS,
  ...KNOWN_TRANSLATED_WORSHIP_SONGS,
  ...GLOBAL_WORSHIP_SONGS,
  { id: 'intl-yo-1', title: 'Awa Yin O', artist: 'Noble Omoniyi', category: 'Gospel and spiritual', youtubeId: 'a0zS0Z6fU7w', language: 'Yoruba', languageCode: 'yo', region: 'Nigeria', searchAliases: ['Yoruba praise', 'Nigerian worship', 'Awa Yin o'], sourceChannel: 'Noble Omoniyi' },
  { id: 'intl-yo-2', title: 'Ogo Medley', artist: 'Noble Omoniyi', category: 'Gospel and spiritual', youtubeId: 'zlgVzBXY1C8', language: 'Yoruba', languageCode: 'yo', region: 'Nigeria', searchAliases: ['Yoruba worship', 'Nigerian worship', 'English translation'], sourceChannel: 'Noble Omoniyi' },
  { id: 'intl-ur-1', title: 'Holi Holi Kil Laween', artist: 'M. Ali / Worship of Christ Ministry', category: 'Gospel and spiritual', youtubeId: '_7ae4j6m9vA', language: 'Urdu / Punjabi', languageCode: 'ur', region: 'Pakistan', searchAliases: ['Masihi geet', 'Urdu Christian worship', 'Pakistani gospel', 'Punjabi Christian worship'], sourceChannel: 'Masihi Geet Khazana' },
];

const ALL_LANGUAGE_FILTERS = [
  'English',
  'Persian / Farsi',
  ...GLOBAL_LANGUAGE_FILTERS,
  ...EXPANDED_WORD_LANGUAGE_FILTERS,
  ...RESEARCHED_WORD_LANGUAGE_FILTERS,
  'Urdu / Punjabi',
].filter((language, index, languages) => languages.indexOf(language) === index);

export const LANGUAGE_FILTERS = [
  'English',
  'Persian / Farsi',
  ...ALL_LANGUAGE_FILTERS
    .filter((language) => language !== 'English' && language !== 'Persian / Farsi')
    .sort((a, b) => a.localeCompare(b)),
];
